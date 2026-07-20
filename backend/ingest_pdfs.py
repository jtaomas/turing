import sys, os, json, re, argparse
sys.path.insert(0, os.path.dirname(__file__))

import pdfplumber
from app import create_app
from models import db, Question

TOPIC_IDS = {
    'advanced': {
        'functions': 'ma-f1', 'trig': 'ma-t1', 'calculus': 'ma-c1',
        'exponential': 'ma-e1', 'probability': 'ma-s1', 'transformations': 'ma-f2',
        'trig graphs': 'ma-t2', 'calculus advanced': 'ma-c234', 'financial': 'ma-m1',
        'statistics': 'ma-s23',
    },
    'extension1': {
        'functions ext': 'me-f1', 'trig ext': 'me-t12', 'calculus ext': 'me-c1',
        'combinatorics': 'me-a1', 'induction': 'me-p1', 'vectors 2d': 'me-v1',
        'inverse trig': 'me-t3', 'calculus further': 'me-c23', 'binomial': 'me-s1',
    },
    'extension2': {
        'proof': 'mex-p12', 'vectors 3d': 'mex-v1', 'complex': 'mex-n12',
        'integration': 'mex-c1', 'mechanics': 'mex-m1',
    },
}

COURSE_IDS = {'advanced': 'adv', 'extension1': 'mx1', 'extension2': 'mx2'}

def guess_topic(text, course_hint):
    text_lower = text.lower()
    if course_hint == 'extension2':
        if any(w in text_lower for w in ['complex', 'argand', 'de moivre', 'modulus', 'argument', 'locus', 'loci', 'imaginary', 'cis', 'euler']):
            return 'mex-n12'
        if any(w in text_lower for w in ['integration by parts', 'partial fraction', 'reduction formula', 'integral', 'substitution']):
            return 'mex-c1'
        if any(w in text_lower for w in ['proof', 'contradiction', 'contrapositive', 'induction', 'inequality', 'am-gm']):
            return 'mex-p12'
        if any(w in text_lower for w in ['3d vector', 'plane', 'skew', 'cross product', 'line in 3d']):
            return 'mex-v1'
        if any(w in text_lower for w in ['mechanics', 'projectile', 'resisted', 'circular motion', 'simple harmonic', 'shm', 'banked']):
            return 'mex-m1'
    if course_hint in ('extension1', 'extension2'):
        if any(w in text_lower for w in ['combinatorics', 'permutation', 'combination', 'binomial theorem', 'pigeonhole', 'arrangement']):
            return 'me-a1'
        if any(w in text_lower for w in ['induction', 'prove that', 'mathematical induction']):
            return 'me-p1'
        if any(w in text_lower for w in ['vector', 'dot product', 'scalar product', 'projection']):
            return 'me-v1'
        if any(w in text_lower for w in ['inverse trig', 'arcsin', 'arccos', 'arctan', 'auxiliary angle']):
            return 'me-t3'
        if any(w in text_lower for w in ['related rate', 'implicit differentiation', 'differential equation']):
            return 'me-c1'
        if any(w in text_lower for w in ['binomial distribution', 'normal approximation', 'bernoulli']):
            return 'me-s1'
    if any(w in text_lower for w in ['function', 'domain', 'range', 'inverse', 'graph', 'transform']):
        return 'ma-f1'
    if any(w in text_lower for w in ['trig', 'sine', 'cosine', 'tangent', 'radian', 'sector']):
        return 'ma-t1'
    if any(w in text_lower for w in ['derivative', 'differentiate', 'tangent', 'normal', 'chain rule', 'product rule', 'quotient rule']):
        return 'ma-c1'
    if any(w in text_lower for w in ['exponential', 'logarithm', 'ln', 'growth', 'decay']):
        return 'ma-e1'
    if any(w in text_lower for w in ['probability', 'venn', 'random variable', 'expect', 'variance']):
        return 'ma-s1'
    if any(w in text_lower for w in ['integral', 'area between', 'volume', 'solid of revolution']):
        return 'ma-c234'
    if any(w in text_lower for w in ['arithmetic', 'geometric', 'series', 'annuity', 'compound interest']):
        return 'ma-m1'
    return None

def split_into_questions(text):
    lines = text.split('\n')
    questions = []
    current = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                questions.append(' '.join(current))
                current = []
            continue
        if re.match(r'^\d+[.)]\s', stripped):
            if current:
                questions.append(' '.join(current))
                current = []
        current.append(stripped)
    if current:
        questions.append(' '.join(current))
    return [q for q in questions if len(q) > 20]

def clean_text(text):
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    text = re.sub(r'[·•‚„†‡•]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def wrap_math(text):
    if '$' in text:
        return text
    text = re.sub(r'(?<!\$)\\?(sqrt|frac|int|sum|log|ln|sin|cos|tan|pi|theta|infty|cdot|times|leq|geq|pm|alpha|beta|gamma)(?!\$)', r'$\\\1$', text)
    text = re.sub(r'(?<!\$)([a-zA-Z]\^\{?-?\d+\}?)(?!\$)', r'$\1$', text)
    text = re.sub(r'(?<!\$)([a-zA-Z]_\{[a-zA-Z0-9]+\})(?!\$)', r'$\1$', text)
    return text

def ingest_pdf(filepath, course_hint):
    results = []
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue
                text = clean_text(text)
                questions = split_into_questions(text)
                for q_text in questions:
                    if len(q_text) < 25:
                        continue
                    q_text = wrap_math(q_text)
                    topic_id = guess_topic(q_text, course_hint)
                    course = COURSE_IDS.get(course_hint, 'adv')
                    if topic_id and topic_id.startswith('ma-'):
                        course = 'adv'
                    elif topic_id and topic_id.startswith('me-'):
                        course = 'mx1'
                    elif topic_id and topic_id.startswith('mex-'):
                        course = 'mx2'
                    results.append({
                        'text': q_text,
                        'topic_id': topic_id or 'ma-f1',
                        'course': course,
                    })
    except Exception as e:
        print(f'  Error reading {filepath}: {e}')
    return results

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', default='pdf_input')
    parser.add_argument('--course', default='extension2', choices=['advanced','extension1','extension2'])
    args = parser.parse_args()

    pdf_dir = os.path.join(os.path.dirname(__file__), args.dir)
    pdfs = [f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf')]
    if not pdfs:
        print(f'No PDFs found in {pdf_dir}')
        return

    print(f'Found {len(pdfs)} PDF(s) in {pdf_dir}')
    print(f'Course hint: {args.course}')
    print()

    app = create_app()
    with app.app_context():
        total = 0
        for pdf_file in pdfs:
            path = os.path.join(pdf_dir, pdf_file)
            print(f'Processing: {pdf_file}')
            results = ingest_pdf(path, args.course)
            for r in results:
                q = Question(
                    topic_id=r['topic_id'],
                    question_text=r['text'],
                    course=r['course'],
                    difficulty=3.0,
                    hsc_marks=3.0,
                    hsc_exam_weight=5.0,
                    year_level=12,
                )
                db.session.add(q)
                total += 1
            print(f'  Extracted {len(results)} questions')

        db.session.commit()
        print(f'\nTotal questions ingested: {total}')

        for c in ['adv','mx1','mx2']:
            count = Question.query.filter_by(course=c).count()
            print(f'  {c}: {count}')

if __name__ == '__main__':
    main()
