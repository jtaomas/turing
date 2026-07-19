"""
Turing — PDF Question Ingestion Pipeline
=========================================
Processes a folder of HSC math worksheet PDFs and extracts individual
questions into the database with automatic topic classification,
difficulty estimation, and deduplication.

Usage:
    cd backend
    pip install pdfplumber pypdf2

    python ingest_pdfs.py --dir "C:/path/to/your/pdf/folder" --course adv


How it works:
  1. Walks the folder, finds all .pdf files
  2. Extracts text using pdfplumber (text-based PDFs)
  3. Falls back to Gemini 1.5 Flash Vision for image-heavy pages
  4. Sends batches of text to Gemini for question parsing:
     - Splits text into individual questions
     - Classifies by topic_id and subtopic
     - Estimates difficulty (1-5) and HSC marks (1-5)
  5. Deduplicates against existing database questions
  6. Inserts new questions with full metadata
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import db, Question


try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("[WARN] pdfplumber not installed. Install with: pip install pdfplumber")
    print("[WARN] Will try PyPDF2 as fallback.")

try:
    from PyPDF2 import PdfReader
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False


def extract_text_from_pdf(filepath: str) -> str:
    
    if HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(filepath) as pdf:
                pages = []
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        pages.append(text)
                if pages:
                    return '\n\n--- PAGE BREAK ---\n\n'.join(pages)
        except Exception as e:
            print(f"  pdfplumber failed: {e}")

    if HAS_PYPDF2:
        try:
            reader = PdfReader(filepath)
            pages = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            if pages:
                return '\n\n--- PAGE BREAK ---\n\n'.join(pages)
        except Exception as e:
            print(f"  PyPDF2 failed: {e}")

    return ""



def parse_questions_with_gemini(text: str, course: str = 'adv',
                                 api_key: Optional[str] = None) -> list[dict]:
    
    if not api_key:
        print("  No Gemini API key — using heuristic parser")
        return _heuristic_parse(text, course)

    from routes.recommendations import TOPIC_META, TOPIC_NAMES

    topic_list = '\n'.join([
        f"  {tid}: {TOPIC_NAMES.get(tid, tid)} "
        f"(course={TOPIC_META[tid].get('course','adv')}, yr{TOPIC_META[tid].get('year',12)})"
        for tid in sorted(TOPIC_META.keys())
    ])

    text_preview = text[:12000] if len(text) > 12000 else text

    prompt = f"""You are an expert NSW HSC Mathematics question classifier.

Below is text extracted from a mathematics worksheet PDF. Parse it into individual
questions and classify each one.

PDF TEXT:
---
{text_preview}
---

AVAILABLE TOPICS:
{topic_list}

For each question found, return a JSON array of objects with:
  - question_text: the full question text
  - topic_id: the best-matching syllabus topic ID from the list above
  - subtopic: a brief subtopic descriptor
  - difficulty: 1-5 (1=easy Band 2, 5=hard Band 6)
  - hsc_marks: typical marks for this question in an HSC exam (1-5)
  - course: "adv", "mx1", or "mx2"

Skip any header text, page numbers, or non-question content.
If the text contains worked solutions, only extract the QUESTIONS, not the solutions.
Output ONLY valid JSON array."""

    try:
        from google import genai
        from google.genai import types as genai_types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[genai_types.Part.from_text(text=prompt)],
            config=genai_types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=4096,
                response_mime_type="application/json",
                system_instruction=(
                    "You are an expert NSW HSC Mathematics question classifier. "
                    "Parse math worksheet PDF text into structured question data. "
                    "Output valid JSON array only."
                ),
            ),
        )
        result_text = response.text
        if result_text:
            result_text = re.sub(r'^```(?:json)?\s*\n?', '', result_text)
            result_text = re.sub(r'\n?```\s*$', '', result_text)
            parsed = json.loads(result_text)
            if isinstance(parsed, list):
                return parsed
    except Exception as e:
        print(f"  Gemini parsing failed: {e}")

    return _heuristic_parse(text, course)


def _heuristic_parse(text: str, course: str = 'adv') -> list[dict]:
    
    questions = []

    parts = re.split(r'\n(?=(?:\d{1,2}[\.\)]\s)|(?:Question\s+\d+)|(?:Q\d+[\.\)]))', text)

    for part in parts:
        part = part.strip()
        if len(part) < 20:  
            continue
        if re.match(r'^(?:Page|SECTION|Chapter|Part)\s', part, re.IGNORECASE):
            continue

        topic_id = _guess_topic(part, course)
        difficulty = _guess_difficulty(part)
        marks = _guess_marks(part)

        questions.append({
            'question_text': part[:500].strip(),
            'topic_id': topic_id,
            'subtopic': '',
            'difficulty': difficulty,
            'hsc_marks': marks,
            'course': course,
        })

    return questions


def _guess_topic(text: str, default_course: str) -> str:
    
    t = text.lower()
    keyword_map = {
        'ma-f1': ['function', 'domain', 'range', 'absolute value', 'simultaneous',
                   'piecewise', 'inverse variation', 'direct variation', 'semicircle',
                   'circle equation', 'vertical line test', 'composite function'],
        'ma-t1': ['trig', 'sin', 'cos', 'tan', 'radian', 'sector', 'arc length',
                   'angle of elevation', 'bearing', 'sine rule', 'cosine rule', 'ambiguous case'],
        'ma-c1': ['differentiate', 'derivative', 'first principle', 'tangent', 'normal',
                   'product rule', 'quotient rule', 'chain rule', 'stationary', 'increasing function',
                   'gradient of secant', 'angle of inclination'],
        'ma-e1': ['log', 'ln', 'exponential', 'euler', "e^", 'logarithmic law',
                   'change of base', 'natural log'],
        'ma-s1': ['probability', 'venn', 'random variable', 'set notation', 'conditional probability',
                   'independent event', 'tree diagram', 'sample space', 'mutually exclusive'],
        'ma-f2': ['transformation', 'dilation', 'translation', 'reflection', 'periodic',
                   'logarithmic scale', 'decibel', 'richter'],
        'ma-t2': ['secant', 'cosecant', 'cotangent', 'pythagorean identity', 'trigonometric equation',
                   'complementary angle'],
        'ma-c234': ['stationary point', 'integrate', 'integration', 'area under', 'maxim', 'minim',
                     'optimisation', 'trapezoidal', 'concave', 'inflection', 'second derivative',
                     'exponential growth', 'decay', 'primitive', 'FTC', 'fundamental theorem'],
        'ma-m1': ['annuity', 'compound interest', 'arithmetic progression', 'geometric progression',
                   'limiting sum', 'reducing balance', 'sequence', 'series', 'future value'],
        'ma-s23': ['normal distribution', 'z-score', 'discrete probability', 'continuous random',
                    'expected value', 'variance', 'standard deviation', 'empirical rule', 'bell curve',
                    'probability density', 'CDF', 'PDF'],
        'me-f1': ['inverse function', 'polynomial', 'remainder theorem', 'factor theorem',
                   'sum of zeroes', 'product of zeroes', 'graphical relationship', 'parametric',
                   'cubic inequality', 'rational inequality', 'leading coefficient'],
        'me-t12': ['compound angle', 'double angle', 'sum and difference', 'auxiliary angle',
                    'R sin', 'R cos', 'three dimension', '3D trig', 't-formula'],
        'me-c1': ['permutation', 'combination', "nPr", "nCr", 'pascal', 'binomial theorem',
                   'binomial coefficient', 'binomial expansion'],
        'me-a1': ['induction', 'prove', 'divisibility'],
        'me-p1': ['vector', 'dot product', 'projectile', 'scalar product', 'projection',
                   'motion in vector', 'bearing', 'crosswind', 'relative velocity'],
        'me-v1': ['inverse sine', 'inverse cosine', 'inverse tan', 'arcsin', 'arccos', 'arctan',
                   'parametric derivative', 'inverse trig derivative'],
        'me-t3': ['related rate', 'rate of change', 'volume of revolution', 'solid of revolution',
                   'area between curve', 'multiplicity', 'multiple zero'],
        'me-c23': ['differential equation', 'separation of variable', 'slope field', 'initial condition',
                    'logistic', "newton's law of cooling", 'carrying capacity'],
        'me-s1': ['bernoulli', 'binomial distribution', 'B(n,p)', 'sampling distribution',
                   'central limit theorem', 'sample mean'],
        'mex-p12': ['proof by contradiction', 'AM-GM', 'triangle inequality', 'squeeze theorem',
                     'contrapositive', 'iff', 'equivalence', 'negation'],
        'mex-v1': ['vector equation', 'direction vector', 'skew line', 'cauchy-schwarz',
                    'vector proof', 'parametric curve', 'sphere equation'],
        'mex-n12': ['complex number', 'de moivre', 'argand', 'modulus', 'argument', 'polar form',
                     'roots of unity', 'complex conjugate root', 'locus', 'loci'],
        'mex-c1': ['integration by parts', 'partial fraction', 'reduction formula', 'recurrence',
                    't-formula', 'trig product', 'trigonometric integral'],
        'mex-m1': ['simple harmonic', 'SHM', 'resisted motion', 'terminal velocity', "newton's law",
                    'projectile with resistance', 'smooth inclined plane', 'pulley'],
    }
    for tid, keywords in keyword_map.items():
        if any(kw in t for kw in keywords):
            return tid
    defaults = {'adv': 'ma-c234', 'mx1': 'me-c1', 'mx2': 'mex-c1'}
    return defaults.get(default_course, 'ma-c234')


def _guess_difficulty(text: str) -> float:
    
    t = text.lower()
    if any(w in t for w in ['prove that', 'hence or otherwise', 'derive an expression',
                              'cauchy-schwarz', 'de moivre', 'contrapositive',
                              'recurrence relation', 'squeeze theorem']):
        return 4.5
    if any(w in t for w in ['prove', 'proof', 'induction', 'compound angle',
                              'double angle', 'auxiliary', 'projectile',
                              'binomial theorem', 'sampling distribution']):
        return 4.0
    if any(w in t for w in ['sketch', 'evaluate', 'hence', 'show that',
                              'optimisation', 'trapezoidal', 'inflection',
                              'second derivative', 'volume of revolution']):
        return 3.5
    if any(w in t for w in ['solve', 'calculate', 'determine', 'differentiate',
                              'integrate', 'simplify', 'find the equation']):
        return 2.5
    if any(w in t for w in ['state', 'write', 'what is', 'convert', 'graph']):
        return 2.0
    return 3.0


def _guess_marks(text: str) -> int:
    
    t = text.lower()
    if any(w in t for w in ['prove that', 'hence or otherwise', 'derive an expression']):
        return 4
    if any(w in t for w in ['sketch', 'evaluate the integral', 'find the maximum']):
        return 3
    if any(w in t for w in ['solve', 'calculate', 'determine']):
        return 2
    return 2



def ingest_folder(folder_path: str, course: str = 'auto', dry_run: bool = False,
                  limit: Optional[int] = None, force: bool = False):
    
    app = create_app()

    with app.app_context():
        api_key = app.config.get('GEMINI_API_KEY', '')

        pdf_files = []
        for root, dirs, files in os.walk(folder_path):
            for f in files:
                if f.lower().endswith('.pdf'):
                    pdf_files.append(os.path.join(root, f))

        print(f"\n{'='*60}")
        print(f"Turing PDF Ingestion Pipeline")
        print(f"{'='*60}")
        print(f"Folder: {folder_path}")
        print(f"PDFs found: {len(pdf_files)}")
        print(f"Gemini API: {'configured' if api_key else 'NOT CONFIGURED — using heuristics'}")
        print(f"Mode: {'DRY RUN (no insert)' if dry_run else 'LIVE INSERT'}")
        print(f"{'='*60}\n")

        if not force:
            existing_texts = set()
            for q in Question.query.with_entities(Question.question_text).all():
                existing_texts.add(q.question_text.strip())
            print(f"Existing questions in DB: {len(existing_texts)}")
        else:
            existing_texts = set()
            print("Force mode: skipping dedup")

        if limit:
            pdf_files = pdf_files[:limit]
            print(f"Limited to first {limit} PDFs")

        total_new = 0
        total_skipped = 0
        total_errors = 0

        for i, filepath in enumerate(pdf_files):
            filename = os.path.basename(filepath)
            print(f"\n[{i+1}/{len(pdf_files)}] {filename}")

            print(f"  Extracting text...")
            text = extract_text_from_pdf(filepath)

            if not text:
                print(f"  ⚠ No text extracted — skipping")
                total_errors += 1
                continue

            print(f"  Extracted {len(text):,} chars from {text.count(chr(10))+1} lines")

            detected_course = course
            if course == 'auto':
                detected_course = _detect_course(filename, text)
                print(f"  Auto-detected course: {detected_course}")

            print(f"  Parsing questions...")
            questions = parse_questions_with_gemini(text, detected_course, api_key)
            print(f"  Found {len(questions)} questions")

            for q in questions:
                qt = q.get('question_text', '').strip()
                if len(qt) < 10:
                    continue

                if not force and qt in existing_texts:
                    total_skipped += 1
                    continue

                if not dry_run:
                    question = Question(
                        topic_id=q.get('topic_id', 'ma-c234'),
                        subtopic=q.get('subtopic', ''),
                        question_text=qt,
                        difficulty=q.get('difficulty', 3.0),
                        hsc_marks=q.get('hsc_marks', 3),
                        hsc_exam_weight=5,
                        course=q.get('course', detected_course),
                        year_level=12,
                    )
                    db.session.add(question)

                existing_texts.add(qt)
                total_new += 1

            if not dry_run and total_new > 0 and total_new % 20 == 0:
                db.session.commit()
                print(f"  Committed {total_new} questions so far...")

            if api_key:
                time.sleep(0.5)

        if not dry_run:
            db.session.commit()

        print(f"\n{'='*60}")
        print(f"Ingestion complete:")
        print(f"  New questions added:  {total_new}")
        print(f"  Duplicates skipped:   {total_skipped}")
        print(f"  Errors/empty PDFs:    {total_errors}")
        print(f"  Total in database:    {Question.query.count()}")
        print(f"{'='*60}")


def _detect_course(filename: str, text: str) -> str:
    
    combined = (filename + ' ' + text[:500]).lower()
    if any(w in combined for w in ['extension 2', 'mx2', '4u', '4 unit']):
        return 'mx2'
    if any(w in combined for w in ['extension 1', 'mx1', '3u', '3 unit', 'ext 1']):
        return 'mx1'
    return 'adv'



if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Ingest HSC math PDFs into Turing question bank')
    parser.add_argument('--dir', required=True, help='Path to folder containing PDFs')
    parser.add_argument('--course', default='auto',
                       choices=['auto', 'adv', 'mx1', 'mx2'],
                       help='Course filter (default: auto-detect)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Parse but don\'t insert into database')
    parser.add_argument('--limit', type=int, default=None,
                       help='Only process first N PDFs')
    parser.add_argument('--force', action='store_true',
                       help='Skip dedup check (insert everything)')

    args = parser.parse_args()

    if not os.path.isdir(args.dir):
        print(f"Error: '{args.dir}' is not a valid directory")
        sys.exit(1)

    ingest_folder(
        folder_path=args.dir,
        course=args.course,
        dry_run=args.dry_run,
        limit=args.limit,
        force=args.force,
    )
