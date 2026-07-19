import sys, os, json, random, datetime

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import db, ProblemAttempt, User

QUESTIONS = [
    {"topic_id": "ma-f1", "subtopic": "F1.1: Working with Functions",
     "text": "Determine the domain and range of $f(x) = \\frac{1}{\\sqrt{x^2 - 16}}$."},
    {"topic_id": "ma-f1", "subtopic": "F1.1: Working with Functions",
     "text": "Given $f(x) = x^2 - 2x$, find and simplify $\\frac{f(x+h)-f(x)}{h}$."},
    {"topic_id": "ma-f1", "subtopic": "F1.2: Linear, Quadratic and Cubic Functions",
     "text": "Solve the simultaneous equations: $y = 2x - 3$ and $y = x^2 - 5x + 7$."},
    {"topic_id": "ma-f1", "subtopic": "F1.2: Linear, Quadratic and Cubic Functions",
     "text": "Find the vertex, axis of symmetry, and x-intercepts of $y = -2x^2 + 8x + 10$."},
    {"topic_id": "ma-f1", "subtopic": "F1.3: Further Algebraic Skills",
     "text": "Solve $|2x - 3| = x + 5$ and verify solutions algebraically."},

    {"topic_id": "ma-t1", "subtopic": "T1.1: Radian Measure",
     "text": "Find the area of a sector of radius 6 cm with central angle $\\frac{2\\pi}{3}$ radians."},
    {"topic_id": "ma-t1", "subtopic": "T1.2: Trigonometric Functions and Identities",
     "text": "Solve $2\\cos^2\\theta - 1 = 0$ for $0 \\le \\theta \\le 2\\pi$."},
    {"topic_id": "ma-t1", "subtopic": "T1.2: Trigonometric Functions and Identities",
     "text": "Prove: $\\frac{\\sin\\theta}{1-\\cos\\theta} + \\frac{1-\\cos\\theta}{\\sin\\theta} = 2\\csc\\theta$."},

    {"topic_id": "ma-c234", "subtopic": "C2.1: Differentiating Transcendental Functions",
     "text": "Differentiate $y = e^{-2x}\\sin(3x)$ with respect to $x$."},
    {"topic_id": "ma-c234", "subtopic": "C2.1: Differentiating Transcendental Functions",
     "text": "Find $\\frac{d}{dx}\\left(\\ln(x^2 + 4x)\\right)$."},
    {"topic_id": "ma-c234", "subtopic": "C3.1: Applications of Differentiation",
     "text": "Find and classify all stationary points of $y = x^3 - 3x^2 - 9x + 5$."},
    {"topic_id": "ma-c234", "subtopic": "C3.1: Applications of Differentiation",
     "text": "A cylindrical can has volume $250\\pi$ cm$^3$. Find dimensions that minimise surface area."},
    {"topic_id": "ma-c234", "subtopic": "C4.2: The Definite Integral and Areas",
     "text": "Evaluate $\\int_1^4 \\left(\\sqrt{x} + \\frac{1}{x}\\right) dx$."},
    {"topic_id": "ma-c234", "subtopic": "C4.2: The Definite Integral and Areas",
     "text": "Find the area bounded by $y = \\cos x$, the x-axis, $x = 0$ and $x = \\frac{\\pi}{2}$."},

    {"topic_id": "ma-e1", "subtopic": "E1.1: Exponential and Logarithmic Functions",
     "text": "Solve $\\log_2(x) + \\log_2(x - 3) = 2$."},
    {"topic_id": "ma-e1", "subtopic": "E1.2: Natural Logarithms and Exponential Models",
     "text": "Solve $e^{2x} - 5e^x + 6 = 0$ exactly."},
    {"topic_id": "ma-e1", "subtopic": "E1.2: Natural Logarithms and Exponential Models",
     "text": "A bacteria colony doubles in 4 hours. Initial population 500. Find population after 10 hours using $A = A_0 e^{kt}$."},

    {"topic_id": "ma-s1", "subtopic": "S1.1: Probability and Venn Diagrams",
     "text": "In a group of 30 students, 18 study Physics, 15 study Chemistry, 8 study both. Find P(Physics | Chemistry)."},
    {"topic_id": "ma-s23", "subtopic": "S3.2: Normal Distribution",
     "text": "Exam scores: mean 70, SD 8. Find z-score for 86 and percentage below 62."},

    {"topic_id": "ma-m1", "subtopic": "M1.1: Arithmetic Progressions",
     "text": "In an AP, the 4th term is 15 and the 10th term is 39. Find the first term and common difference."},
    {"topic_id": "ma-m1", "subtopic": "M1.3: Financial Applications of Series",
     "text": "Calculate the future value of an annuity: $1200 deposited at end of each year for 15 years at 6% p.a."},

    {"topic_id": "me-f1", "subtopic": "F1.1: Further Work with Functions",
     "text": "Find $f^{-1}(x)$ for $f(x) = \\frac{2x + 3}{x - 1}$ and state its domain and range."},
    {"topic_id": "me-f1", "subtopic": "F1.2: Polynomials",
     "text": "The polynomial $P(x) = 2x^3 + ax^2 + bx - 6$ has factor $(x-2)$ and remainder -15 when divided by $(x+1)$. Find $a$ and $b$."},

    {"topic_id": "me-t12", "subtopic": "T2.1: Compound Angles and Double Angles",
     "text": "Prove: $\\frac{\\sin 2A}{1 + \\cos 2A} = \\tan A$."},
    {"topic_id": "me-t12", "subtopic": "T2.2: The t-Formulae",
     "text": "Use $t = \\tan(\\theta/2)$ to solve $3\\cos\\theta - 4\\sin\\theta = 2$ for $0 \\le \\theta \\le 2\\pi$."},

    {"topic_id": "me-c1", "subtopic": "C1.1: Related Rates of Change",
     "text": "Water pours into a conical cup (radius 5 cm, height 10 cm) at 2 cm$^3$/s. Find rate of water level rise when depth is 4 cm."},
    {"topic_id": "me-c1", "subtopic": "C1.2: Implicit Differentiation",
     "text": "Find the tangent to $x^2 + xy + y^2 = 7$ at $(1, 2)$ using implicit differentiation."},

    {"topic_id": "me-a1", "subtopic": "A1.1: Permutations and Combinations",
     "text": "In how many ways can 6 people sit around a circular table if 2 specific people must sit together?"},
    {"topic_id": "me-a1", "subtopic": "A1.2: The Binomial Theorem",
     "text": "Find the coefficient of $x^3$ in the expansion of $(2x - \\frac{1}{x})^9$."},

    {"topic_id": "me-p1", "subtopic": "P1.1: Proof by Mathematical Induction",
     "text": "Prove by induction: $1^2 + 2^2 + \\cdots + n^2 = \\frac{n(n+1)(2n+1)}{6}$."},
    {"topic_id": "me-p1", "subtopic": "P1.1: Proof by Mathematical Induction",
     "text": "Prove $3^{2n} + 7$ is divisible by 8 for all positive integers $n$."},

    {"topic_id": "me-v1", "subtopic": "V1.2: The Scalar Product",
     "text": "Find $k$ so that $\\mathbf{a} = k\\mathbf{i} + 2\\mathbf{j}$ and $\\mathbf{b} = 3\\mathbf{i} - \\mathbf{j}$ are perpendicular."},

    {"topic_id": "me-c23", "subtopic": "C2.1: Integration by Substitution",
     "text": "Use $u = \\sin x$ to find $\\int \\sin^2x \\cos^3x \\, dx$."},
    {"topic_id": "me-c23", "subtopic": "C3.1: Volumes of Solids of Revolution",
     "text": "Find the volume when the region bounded by $y = \\frac{1}{x}$, the x-axis, $x=1$ and $x=3$ is rotated about the x-axis."},
    {"topic_id": "me-c23", "subtopic": "C3.3: Kinematics and Acceleration",
     "text": "A particle moves in SHM: $\\ddot{x} = -9x$. Starting at origin with velocity 6 m/s, find amplitude and equation of motion."},

    {"topic_id": "me-s1", "subtopic": "S1.1: The Binomial Distribution",
     "text": "A fair coin is tossed 10 times. Find the probability of at least 8 heads."},

    {"topic_id": "mex-p12", "subtopic": "P1.1: The Nature of Proof",
     "text": "Prove by contradiction that $\\log_2(3)$ is irrational."},
    {"topic_id": "mex-p12", "subtopic": "P1.1: The Nature of Proof",
     "text": "Prove $(a+b)(b+c)(c+a) \\ge 8abc$ for positive $a,b,c$ using AM-GM."},

    {"topic_id": "mex-n12", "subtopic": "N2.2: De Moivre's Theorem",
     "text": "Find the five complex roots of $z^5 - 1 = 0$ and show them as vertices of a regular pentagon."},
    {"topic_id": "mex-n12", "subtopic": "N2.4: Loci on the Argand Diagram",
     "text": "Sketch the region: $\\frac{\\pi}{6} \\le \\arg(z - i) \\le \\frac{\\pi}{3}$ on the Argand diagram."},
    {"topic_id": "mex-n12", "subtopic": "N2.2: De Moivre's Theorem",
     "text": "Let $z = \\cos\\theta + i\\sin\\theta$. Use De Moivre to show $\\cos 3\\theta = 4\\cos^3\\theta - 3\\cos\\theta$."},

    {"topic_id": "mex-c1", "subtopic": "C1.1: Integration Techniques",
     "text": "Evaluate $\\int x \\ln x \\, dx$ using integration by parts."},
    {"topic_id": "mex-c1", "subtopic": "C1.1: Integration Techniques",
     "text": "Decompose $\\frac{5x^2 - x + 2}{(x^2+1)(x-1)}$ into partial fractions and integrate."},
    {"topic_id": "mex-c1", "subtopic": "C1.1: Integration Techniques",
     "text": "Derive a reduction formula for $I_n = \\int_0^{\\pi/2} (\\sin x)^n dx$ and calculate $I_4$."},

    {"topic_id": "mex-v1", "subtopic": "V1.1: Vectors in 3D Space",
     "text": "Find the angle between the diagonal of a cube and one of its adjacent edges using 3D vectors."},
    {"topic_id": "mex-v1", "subtopic": "V1.2: Vector Equations of Lines and Planes",
     "text": "Determine if the lines $\\mathbf{r}_1 = (1,2,3) + \\lambda(2,-1,4)$ and $\\mathbf{r}_2 = (3,1,0) + \\mu(1,1,-1)$ intersect, are parallel, or are skew."},

    {"topic_id": "mex-m1", "subtopic": "M1.2: Resisted Motion",
     "text": "A body of mass $m$ falls from rest under gravity with resistance $R = -kv$. Derive velocity as a function of time and state terminal velocity."},
]

def seed():
    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email='dev@turing.math').first()
        if not user:
            user = User(
                google_id='seed-script',
                email='dev@turing.math',
                display_name='Dev User',
                academic_id='TURING-DEV001',
                institution='NSW Board of Studies',
                course='Extension 2 (MX2)',
            )
            db.session.add(user)
            db.session.flush()

        count = 0
        for q in QUESTIONS:
            score = round(random.uniform(1.5, 5.0), 1)
            attempt = ProblemAttempt(
                user_id=user.id,
                topic_id=q['topic_id'],
                subtopic=q['subtopic'],
                problem_text=q['text'],
                score=score,
                total_marks=5.0,
                feedback=f"Simulated attempt. Score: {score}/5.",
                time_spent_seconds=random.randint(60, 900),
                input_mode=random.choice(['draw', 'text', 'upload']),
            )
            db.session.add(attempt)
            count += 1

        db.session.commit()

if __name__ == '__main__':
    seed()
