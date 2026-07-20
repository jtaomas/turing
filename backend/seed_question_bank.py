import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

from openai import OpenAI
from app import create_app
from models import db, Question

COURSES = {
    'Extension 2': [
        ('Complex Numbers', 'Complex numbers, Argand diagram, modulus, argument, polar form, De Moivre, roots of unity, polynomial roots, loci'),
        ('Integration', 'Integration by parts, partial fractions, reduction formulae, definite integrals, volumes, substitution'),
        ('Proof', 'Proof by contradiction, contrapositive, mathematical induction, inequalities, AM-GM, strong induction'),
        ('Mechanics', 'Resisted motion, projectiles with resistance, circular motion, banked tracks, simple harmonic motion, work and energy'),
        ('3D Vectors', '3D coordinates, vector equations of lines and planes, skew lines, intersections, distances, angles between planes'),
    ],
    'Extension 1': [
        ('Functions', 'Inverse functions, polynomials, remainder and factor theorems, rational functions, graphing, absolute value'),
        ('Trigonometry', 'Reciprocal trig functions, compound angles, double angles, t-formulae, inverse trig, auxiliary angle method'),
        ('Calculus', 'Related rates, implicit differentiation, integration by substitution, volumes of revolution, differential equations, SHM'),
        ('Combinatorics', 'Permutations, combinations, circular arrangements, Pigeonhole principle, binomial theorem, binomial identities'),
        ('Proof by Induction', 'Mathematical induction for series, divisibility, inequalities, recursive sequences'),
        ('Vectors', '2D vectors, scalar/dot product, projection, vector geometry, projectile motion'),
        ('Binomial Distribution', 'Binomial probability, mean and variance, normal approximation, sample proportions'),
    ],
    'Advanced': [
        ('Functions', 'Domain and range, inverse functions, graphing techniques, transformations, piecewise and absolute value functions'),
        ('Trigonometry', 'Radian measure, arc length, sector area, trig functions, identities, equations, graphs'),
        ('Differentiation', 'First principles, rules of differentiation, chain/product/quotient rules, tangents and normals'),
        ('Exponential and Logarithmic', 'Exponential functions, natural logarithms, growth and decay models, derivatives of exp/log'),
        ('Probability and Statistics', 'Venn diagrams, conditional probability, discrete random variables, expected value, variance'),
        ('Calculus Applications', 'Stationary points, optimisation, integration, areas between curves, trapezoidal rule'),
        ('Financial Mathematics', 'Arithmetic and geometric progressions, compound interest, annuities, loan repayments'),
        ('Statistical Analysis', 'Continuous random variables, normal distribution, z-scores, bivariate data analysis'),
    ],
}

def generate_topic_questions(client, course, topic, description):
    prompt = f"""Generate exactly 10 unique NSW HSC mathematics questions for the topic "{topic}" in the course "{course}".

Topic scope: {description}

Requirements:
- Each question must be a complete, self-contained problem
- Use proper LaTeX formatting: $...$ for inline math, $$...$$ for display math  
- Difficulty should range from 2.0 to 5.0 (mix of easy to hard)
- Questions should test different skills within the topic
- No duplicate or near-duplicate questions
- NSW HSC style: worded problems, proofs, calculations, applications
- Year 12 level

Return ONLY a JSON array of 10 objects with fields:
- "text": the complete question with LaTeX
- "difficulty": number from 2.0 to 5.0

Format: [{{"text": "Solve $\\int x e^x dx$ using integration by parts.", "difficulty": 3.5}}, ...]"""

    try:
        response = client.chat.completions.create(
            model='deepseek-v4-pro',
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.3,
            max_tokens=16384,
        )
        raw = response.choices[0].message.content or ''
        start = raw.find('[')
        end = raw.rfind(']')
        if start >= 0 and end > start:
            raw = raw[start:end + 1]
        return json.loads(raw)
    except Exception as e:
        print(f'    DeepSeek error: {e}')
        return []

def main():
    api_key = os.getenv('DEEPSEEK_API_KEY', '')
    if not api_key:
        print('ERROR: DEEPSEEK_API_KEY not set')
        return

    client = OpenAI(api_key=api_key, base_url='https://api.deepseek.com')
    app = create_app()

    with app.app_context():
        total = 0
        for course, topics in COURSES.items():
            print(f'\n{course}')
            for topic, desc in topics:
                existing = Question.query.filter_by(topic_id=topic, course=course).count()
                if existing > 0:
                    print(f'  {topic}: SKIP ({existing} already exist)')
                    total += existing
                    continue
                print(f'  Generating {topic}...')
                questions = generate_topic_questions(client, course, topic, desc)
                for q in questions:
                    text = (q.get('text') or '').strip()
                    if len(text) < 15:
                        continue
                    db.session.add(Question(
                        topic_id=topic,
                        question_text=text,
                        course=course,
                        difficulty=float(q.get('difficulty', 3.0)),
                        hsc_marks=3.0,
                        hsc_exam_weight=5.0,
                        year_level=12,
                    ))
                count = len(questions)
                total += count
                db.session.commit()
                print(f'    {count} questions saved')

        print(f'\nDone! {total} questions generated.')

        for c in ['Advanced', 'Extension 1', 'Extension 2']:
            count = Question.query.filter_by(course=c).count()
            topics = db.session.query(Question.topic_id, db.func.count()).filter_by(course=c).group_by(Question.topic_id).all()
            print(f'  {c}: {count}')
            for t, n in topics:
                print(f'    {t}: {n}')

if __name__ == '__main__':
    main()
