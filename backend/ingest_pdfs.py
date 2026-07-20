import sys, os, json, argparse
sys.path.insert(0, os.path.dirname(__file__))

import pdfplumber
from google import genai
from google.genai import types as genai_types
from app import create_app
from models import db, Question

TOPIC_NAMES = [
    'Functions', 'Trigonometry', 'Differentiation', 'Exponential and Logarithmic',
    'Probability and Statistics', 'Financial Mathematics', 'Graph Transformations',
    'Combinatorics', 'Proof by Induction', 'Vectors', 'Inverse Trigonometry',
    'Further Calculus', 'Binomial Distribution', 'Complex Numbers', 'Integration',
    'Mechanics', '3D Vectors',
]

def extract_text_from_pdf(filepath):
    pages = []
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                pages.append({'page': i + 1, 'text': text})
    return pages

def extract_questions_with_gemini(pages, course_name):
    api_key = os.getenv('GEMINI_API_KEY', '')
    if not api_key:
        print('ERROR: GEMINI_API_KEY not set in .env')
        return []

    client = genai.Client(api_key=api_key)

    all_text = ''
    for p in pages:
        all_text += f'\n--- Page {p["page"]} ---\n{p["text"]}'

    prompt = f"""You are a mathematics question extraction system. Extract all individual math questions from the following text extracted from a PDF worksheet.

The course is: {course_name}

For each question:
1. Extract the COMPLETE question text, preserving all mathematical notation
2. Convert ALL mathematical expressions to proper LaTeX format using $...$ for inline math and $$...$$ for display math
3. Assign ONE topic from this list: {', '.join(TOPIC_NAMES)}
4. Assign a difficulty from 1.0 to 5.0 (where 5.0 is hardest Extension 2 level)

Return ONLY a JSON array. Each element must have these fields:
- "text": the complete question with LaTeX math
- "topic": one of the allowed topic names
- "difficulty": number from 1.0 to 5.0

Do NOT include answer keys, solutions, or working out. Only extract the questions themselves.
Skip any text that is clearly not a question (headers, footers, page numbers, instructions).

Return format:
[{{"text": "Find $\\int x\\ln x\\,dx$ using integration by parts.", "topic": "Integration", "difficulty": 4.0}}]

Here is the PDF text:

{all_text[:50000]}"""

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=8192,
            ),
        )
        raw = response.text or ''
        start = raw.find('[')
        end = raw.rfind(']')
        if start >= 0 and end > start:
            raw = raw[start:end + 1]
        data = json.loads(raw)
        return data
    except Exception as e:
        print(f'  Gemini error: {e}')
        return []

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', default='pdf_input')
    parser.add_argument('--course', default='Extension 2', help='Advanced, Extension 1, or Extension 2')
    args = parser.parse_args()

    pdf_dir = os.path.join(os.path.dirname(__file__), args.dir)
    pdfs = [f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf')]
    if not pdfs:
        print(f'No PDFs found in {pdf_dir}')
        return

    print(f'Found {len(pdfs)} PDF(s)')
    print(f'Course: {args.course}')
    print()

    app = create_app()
    with app.app_context():
        total = 0
        for pdf_file in pdfs:
            path = os.path.join(pdf_dir, pdf_file)
            print(f'Processing: {pdf_file}')
            pages = extract_text_from_pdf(path)
            print(f'  Extracted {len(pages)} pages of text')

            questions = extract_questions_with_gemini(pages, args.course)
            for q_data in questions:
                text = (q_data.get('text') or '').strip()
                if len(text) < 20:
                    continue
                q = Question(
                    topic_id=q_data.get('topic', 'Functions'),
                    question_text=text,
                    course=args.course,
                    difficulty=float(q_data.get('difficulty', 3.0)),
                    hsc_marks=3.0,
                    hsc_exam_weight=5.0,
                    year_level=12,
                )
                db.session.add(q)
                total += 1

            print(f'  Gemini extracted {len(questions)} questions')

        db.session.commit()
        print(f'\nTotal: {total} questions ingested')

        for c in ['Advanced', 'Extension 1', 'Extension 2']:
            count = Question.query.filter_by(course=c).count()
            if count:
                print(f'  {c}: {count}')

if __name__ == '__main__':
    main()
