import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import db, Question

QUESTIONS = [

    {"topic_id":"ma-f1","subtopic":"F1.1: Working with Functions","course":"adv","year":11,"difficulty":2.0,"marks":2,"weight":8,
     "text":"Determine the domain and range of $f(x) = \\frac{1}{\\sqrt{x^2 - 16}}$."},
    {"topic_id":"ma-f1","subtopic":"F1.1: Working with Functions","course":"adv","year":11,"difficulty":2.5,"marks":3,"weight":8,
     "text":"Given $f(x) = x^2 - 2x$, find and simplify $\\frac{f(x+h)-f(x)}{h}$."},
    {"topic_id":"ma-f1","subtopic":"F1.1: Working with Functions","course":"adv","year":11,"difficulty":2.0,"marks":2,"weight":8,
     "text":"Apply the vertical line test to determine whether $x^2 + y^2 = 9$ represents a function. Justify your answer."},
    {"topic_id":"ma-f1","subtopic":"F1.2: Linear, Quadratic and Cubic Functions","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":8,
     "text":"Solve the simultaneous equations: $y = 2x - 3$ and $y = x^2 - 5x + 7$."},
    {"topic_id":"ma-f1","subtopic":"F1.2: Linear, Quadratic and Cubic Functions","course":"adv","year":11,"difficulty":2.5,"marks":3,"weight":8,
     "text":"Find the vertex, axis of symmetry, and x-intercepts of $y = -2x^2 + 8x + 10$."},
    {"topic_id":"ma-f1","subtopic":"F1.2: Linear, Quadratic and Cubic Functions","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":8,
     "text":"Graph the cubic function $y = (x - 2)^3 + 1$ and identify its point of symmetry and intercepts."},
    {"topic_id":"ma-f1","subtopic":"F1.3: Further Algebraic Skills","course":"adv","year":11,"difficulty":2.5,"marks":2,"weight":8,
     "text":"Solve $|2x - 3| = x + 5$ and verify solutions algebraically."},
    {"topic_id":"ma-f1","subtopic":"F1.3: Further Algebraic Skills","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":8,
     "text":"Simplify the algebraic fraction: $\\frac{x^2 - 9}{2x^2 - 5x - 3}$."},
    {"topic_id":"ma-f1","subtopic":"F1.3: Further Algebraic Skills","course":"adv","year":11,"difficulty":2.5,"marks":2,"weight":8,
     "text":"Simplify using index laws: $\\frac{x^{2/3} \\cdot y^{-1/2}}{x^{-1/3} \\cdot y^{3/2}}$."},

    {"topic_id":"ma-t1","subtopic":"T1.1: Radian Measure","course":"adv","year":11,"difficulty":2.0,"marks":2,"weight":7,
     "text":"Convert $150^\\circ$ to radians and $\\frac{5\\pi}{6}$ radians to degrees."},
    {"topic_id":"ma-t1","subtopic":"T1.1: Radian Measure","course":"adv","year":11,"difficulty":2.5,"marks":3,"weight":7,
     "text":"Find the area of a sector of radius 6 cm with central angle $\\frac{2\\pi}{3}$ radians."},
    {"topic_id":"ma-t1","subtopic":"T1.1: Radian Measure","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":7,
     "text":"An arc of length 15 cm subtends an angle of $150^\\circ$ at the centre. Calculate the exact radius in terms of $\\pi$."},
    {"topic_id":"ma-t1","subtopic":"T1.2: Trigonometric Functions and Identities","course":"adv","year":11,"difficulty":2.5,"marks":3,"weight":7,
     "text":"Solve $2\\cos^2\\theta - 1 = 0$ for $0 \\le \\theta \\le 2\\pi$."},
    {"topic_id":"ma-t1","subtopic":"T1.2: Trigonometric Functions and Identities","course":"adv","year":11,"difficulty":3.5,"marks":4,"weight":7,
     "text":"Prove: $\\frac{\\sin\\theta}{1-\\cos\\theta} + \\frac{1-\\cos\\theta}{\\sin\\theta} = 2\\csc\\theta$."},
    {"topic_id":"ma-t1","subtopic":"T1.2: Trigonometric Functions and Identities","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":7,
     "text":"Sketch $y = \\tan x$ for $-\\frac{\\pi}{2} < x < \\frac{3\\pi}{2}$, showing all asymptotes and x-intercepts."},

    {"topic_id":"ma-c1","subtopic":"C1.1: Rates of Change","course":"adv","year":11,"difficulty":2.0,"marks":2,"weight":6,
     "text":"A particle moves so that $s(t) = t^3 - 4t$. Find the average velocity from $t = 1$ to $t = 3$."},
    {"topic_id":"ma-c1","subtopic":"C1.2: The Derivative and Tangents","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":6,
     "text":"Find $f'(x)$ from first principles for $f(x) = x^2 + 5x$."},
    {"topic_id":"ma-c1","subtopic":"C1.2: The Derivative and Tangents","course":"adv","year":11,"difficulty":2.5,"marks":3,"weight":6,
     "text":"Find equations of the tangent and normal to $y = 3x^2 - 5x + 2$ at $(2, 4)$."},
    {"topic_id":"ma-c1","subtopic":"C1.3: Rules of Differentiation","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":6,
     "text":"Differentiate $f(x) = (3x^2 - 1)^4$ using the chain rule."},
    {"topic_id":"ma-c1","subtopic":"C1.3: Rules of Differentiation","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":6,
     "text":"Differentiate $y = \\frac{2x+1}{x^2-3}$ using the quotient rule."},
    {"topic_id":"ma-c1","subtopic":"C1.3: Rules of Differentiation","course":"adv","year":11,"difficulty":3.5,"marks":3,"weight":6,
     "text":"Use the product rule to find the derivative of $y = x^3 \\sqrt{2x+5}$."},

    {"topic_id":"ma-e1","subtopic":"E1.1: Exponential and Logarithmic Functions","course":"adv","year":11,"difficulty":2.5,"marks":2,"weight":5,
     "text":"Solve $\\log_2(x) + \\log_2(x - 3) = 2$."},
    {"topic_id":"ma-e1","subtopic":"E1.2: Natural Logarithms and Exponential Models","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":5,
     "text":"Solve $e^{2x} - 5e^x + 6 = 0$ exactly."},
    {"topic_id":"ma-e1","subtopic":"E1.2: Natural Logarithms and Exponential Models","course":"adv","year":11,"difficulty":3.0,"marks":3,"weight":5,
     "text":"A bacteria colony doubles every 4 hours. If the initial population is 500, find the population after 10 hours using $A = A_0 e^{kt}$."},
    {"topic_id":"ma-e1","subtopic":"E1.3: Differentiation of Exponentials and Logs","course":"adv","year":11,"difficulty":2.5,"marks":2,"weight":5,
     "text":"Differentiate $y = \\ln(2x^2 + 3)$ with respect to $x$."},

    {"topic_id":"ma-s1","subtopic":"S1.1: Probability and Venn Diagrams","course":"adv","year":11,"difficulty":2.0,"marks":2,"weight":6,
     "text":"In a group of 30 students, 18 study Physics, 15 study Chemistry, and 8 study both. Find $P(\\text{Physics} \\mid \\text{Chemistry})$."},
    {"topic_id":"ma-s1","subtopic":"S1.2: Discrete Random Variables","course":"adv","year":11,"difficulty":2.5,"marks":3,"weight":6,
     "text":"A discrete random variable $X$ takes values $1, 2, 3$ with probabilities $0.3, 0.5, 0.2$. Find $E(X)$ and $\\text{Var}(X)$."},

    {"topic_id":"ma-f2","subtopic":"F2.1: Transformations of Functions","course":"adv","year":12,"difficulty":2.5,"marks":3,"weight":7,
     "text":"Describe the sequence of transformations that map $y = x^2$ to $y = -2(x+3)^2 + 5$."},
    {"topic_id":"ma-f2","subtopic":"F2.1: Transformations of Functions","course":"adv","year":12,"difficulty":3.0,"marks":3,"weight":7,
     "text":"Sketch $y = \\frac{1}{x-2} + 1$, showing all asymptotes and intercepts."},
    {"topic_id":"ma-f2","subtopic":"F2.2: Inequalities","course":"adv","year":12,"difficulty":3.0,"marks":3,"weight":7,
     "text":"Solve $\\frac{x+2}{x-1} \\le 3$ algebraically and represent the solution on a number line."},

    {"topic_id":"ma-t2","subtopic":"T2.1: Trigonometric Equations","course":"adv","year":12,"difficulty":3.0,"marks":3,"weight":6,
     "text":"Solve $\\sin 2x = \\cos x$ for $0 \\le x \\le 2\\pi$."},
    {"topic_id":"ma-t2","subtopic":"T2.2: Applications of Trigonometry","course":"adv","year":12,"difficulty":3.5,"marks":4,"weight":6,
     "text":"In triangle $ABC$, $a = 8$ cm, $b = 6$ cm, and $\\angle C = 60^\\circ$. Find the length of side $c$."},

    {"topic_id":"ma-c234","subtopic":"C2.1: Differentiation of Transcendental Functions","course":"adv","year":12,"difficulty":3.0,"marks":3,"weight":10,
     "text":"Differentiate $y = e^{-2x}\\sin(3x)$ with respect to $x$."},
    {"topic_id":"ma-c234","subtopic":"C2.1: Differentiation of Transcendental Functions","course":"adv","year":12,"difficulty":2.5,"marks":2,"weight":10,
     "text":"Find $\\frac{d}{dx}\\left(\\ln(x^2 + 4x)\\right)$."},
    {"topic_id":"ma-c234","subtopic":"C3.1: The First and Second Derivatives","course":"adv","year":12,"difficulty":3.5,"marks":4,"weight":10,
     "text":"Find and classify all stationary points of $y = x^3 - 3x^2 - 9x + 5$."},
    {"topic_id":"ma-c234","subtopic":"C3.1: The First and Second Derivatives","course":"adv","year":12,"difficulty":3.0,"marks":3,"weight":10,
     "text":"Find the maximum value of $y = x e^{-x}$ for $x \\ge 0$."},
    {"topic_id":"ma-c234","subtopic":"C3.2: Optimisation","course":"adv","year":12,"difficulty":3.5,"marks":4,"weight":10,
     "text":"A cylindrical can must hold $250\\pi$ cm$^3$. Find the dimensions that minimise surface area."},
    {"topic_id":"ma-c234","subtopic":"C4.1: The Anti-Derivative","course":"adv","year":12,"difficulty":2.0,"marks":2,"weight":10,
     "text":"Find $\\int (6x^2 - 4x + 3)\\,dx$."},
    {"topic_id":"ma-c234","subtopic":"C4.2: Areas and the Definite Integral","course":"adv","year":12,"difficulty":3.0,"marks":3,"weight":10,
     "text":"Evaluate $\\int_1^4 \\left(\\sqrt{x} + \\frac{1}{x}\\right) dx$."},
    {"topic_id":"ma-c234","subtopic":"C4.2: Areas and the Definite Integral","course":"adv","year":12,"difficulty":3.0,"marks":3,"weight":10,
     "text":"Find the area bounded by $y = \\cos x$, the x-axis, $x = 0$, and $x = \\frac{\\pi}{2}$."},
    {"topic_id":"ma-c234","subtopic":"C4.3: Trapezoidal Rule","course":"adv","year":12,"difficulty":2.0,"marks":2,"weight":10,
     "text":"Use the trapezoidal rule with 4 subintervals to approximate $\\int_0^2 e^{x^2}\\,dx$."},

    {"topic_id":"ma-m1","subtopic":"M1.1: Arithmetic and Geometric Sequences","course":"adv","year":12,"difficulty":2.5,"marks":3,"weight":5,
     "text":"In an AP, the 4th term is 15 and the 10th term is 39. Find the first term and common difference."},
    {"topic_id":"ma-m1","subtopic":"M1.2: Compound Interest","course":"adv","year":12,"difficulty":2.0,"marks":2,"weight":5,
     "text":"$5000 is invested at 4.5% p.a. compounded monthly. Find the value after 3 years."},
    {"topic_id":"ma-m1","subtopic":"M1.3: Annuities and Loan Repayments","course":"adv","year":12,"difficulty":3.0,"marks":4,"weight":5,
     "text":"Calculate the future value of an annuity where $1200 is deposited at the end of each year for 15 years at 6% p.a."},

    {"topic_id":"ma-s23","subtopic":"S2.1: Bivariate Data Analysis","course":"adv","year":12,"difficulty":2.5,"marks":3,"weight":8,
     "text":"Given the data points $(1,2), (2,5), (3,7), (4,10)$, find the least-squares regression line $y = a + bx$."},
    {"topic_id":"ma-s23","subtopic":"S3.1: Continuous Random Variables","course":"adv","year":12,"difficulty":2.5,"marks":3,"weight":8,
     "text":"A continuous RV has pdf $f(x) = \\frac{3}{8}x^2$ for $0 \\le x \\le 2$. Find $P(X > 1)$."},
    {"topic_id":"ma-s23","subtopic":"S3.2: The Normal Distribution","course":"adv","year":12,"difficulty":2.5,"marks":3,"weight":8,
     "text":"Exam scores follow $N(70, 8^2)$. Find the z-score for a score of 86 and the percentage of students scoring below 62."},

    {"topic_id":"me-f1","subtopic":"F1.1: Inverse Functions","course":"mx1","year":11,"difficulty":3.0,"marks":3,"weight":7,
     "text":"Find $f^{-1}(x)$ for $f(x) = \\frac{2x+3}{x-1}$ and state its domain and range."},
    {"topic_id":"me-f1","subtopic":"F1.2: Polynomials","course":"mx1","year":11,"difficulty":3.5,"marks":4,"weight":7,
     "text":"$P(x) = 2x^3 + ax^2 + bx - 6$ has factor $(x-2)$ and remainder $-15$ when divided by $(x+1)$. Find $a$ and $b$."},
    {"topic_id":"me-f1","subtopic":"F1.3: Graphing Rational Functions","course":"mx1","year":11,"difficulty":3.5,"marks":3,"weight":7,
     "text":"Sketch $y = \\frac{x^2 - 4}{x - 1}$, showing all asymptotes, intercepts, and turning points."},

    {"topic_id":"me-t12","subtopic":"T2.1: Compound Angles and Double Angles","course":"mx1","year":11,"difficulty":3.0,"marks":3,"weight":8,
     "text":"Prove: $\\frac{\\sin 2A}{1 + \\cos 2A} = \\tan A$."},
    {"topic_id":"me-t12","subtopic":"T2.1: Compound Angles and Double Angles","course":"mx1","year":11,"difficulty":3.5,"marks":3,"weight":8,
     "text":"Given $\\sin A = \\frac{3}{5}$ and $\\cos B = \\frac{5}{13}$ (both acute), find $\\sin(A+B)$."},
    {"topic_id":"me-t12","subtopic":"T2.2: The t-Formulae","course":"mx1","year":11,"difficulty":4.0,"marks":5,"weight":8,
     "text":"Use $t = \\tan(\\theta/2)$ to solve $3\\cos\\theta - 4\\sin\\theta = 2$ for $0 \\le \\theta \\le 2\\pi$."},

    {"topic_id":"me-c1","subtopic":"C1.1: Related Rates of Change","course":"mx1","year":11,"difficulty":4.0,"marks":4,"weight":9,
     "text":"Water pours into a conical cup (radius 5 cm, height 10 cm) at 2 cm$^3$/s. Find the rate at which the water level rises when depth is 4 cm."},
    {"topic_id":"me-c1","subtopic":"C1.2: Implicit Differentiation","course":"mx1","year":11,"difficulty":3.5,"marks":3,"weight":9,
     "text":"Find the equation of the tangent to $x^2 + xy + y^2 = 7$ at $(1, 2)$ using implicit differentiation."},

    {"topic_id":"me-a1","subtopic":"A1.1: Permutations and Combinations","course":"mx1","year":11,"difficulty":2.5,"marks":2,"weight":6,
     "text":"How many arrangements of the letters in 'MATHEMATICS' are there if identical letters are indistinguishable?"},
    {"topic_id":"me-a1","subtopic":"A1.1: Permutations and Combinations","course":"mx1","year":11,"difficulty":3.0,"marks":3,"weight":6,
     "text":"In how many ways can 6 people sit around a circular table if 2 specific people must sit together?"},
    {"topic_id":"me-a1","subtopic":"A1.2: The Binomial Theorem","course":"mx1","year":11,"difficulty":3.0,"marks":3,"weight":6,
     "text":"Find the coefficient of $x^3$ in the expansion of $(2x - \\frac{1}{x})^9$."},

    {"topic_id":"me-p1","subtopic":"P1.1: Mathematical Induction","course":"mx1","year":12,"difficulty":4.0,"marks":5,"weight":7,
     "text":"Prove by induction: $1^2 + 2^2 + \\cdots + n^2 = \\frac{n(n+1)(2n+1)}{6}$ for all $n \\in \\mathbb{N}$."},
    {"topic_id":"me-p1","subtopic":"P1.1: Mathematical Induction","course":"mx1","year":12,"difficulty":4.0,"marks":4,"weight":7,
     "text":"Prove that $3^{2n} + 7$ is divisible by 8 for all positive integers $n$."},
    {"topic_id":"me-p1","subtopic":"P1.2: Induction Inequalities","course":"mx1","year":12,"difficulty":4.5,"marks":5,"weight":7,
     "text":"Prove by induction that $2^n > n^2$ for all integers $n \\ge 5$."},

    {"topic_id":"me-v1","subtopic":"V1.1: Introduction to Vectors","course":"mx1","year":12,"difficulty":2.5,"marks":2,"weight":7,
     "text":"Find the magnitude and direction of $\\mathbf{a} = 3\\mathbf{i} - 4\\mathbf{j}$."},
    {"topic_id":"me-v1","subtopic":"V1.2: The Scalar (Dot) Product","course":"mx1","year":12,"difficulty":3.0,"marks":3,"weight":7,
     "text":"Find $k$ so that $\\mathbf{a} = k\\mathbf{i} + 2\\mathbf{j}$ and $\\mathbf{b} = 3\\mathbf{i} - \\mathbf{j}$ are perpendicular."},
    {"topic_id":"me-v1","subtopic":"V1.3: Projectile Motion","course":"mx1","year":12,"difficulty":4.0,"marks":5,"weight":7,
     "text":"A projectile is launched at 30 m/s at $40^\\circ$ above horizontal from ground level. Find its range and maximum height."},

    {"topic_id":"me-t3","subtopic":"T3.1: Inverse Trigonometric Functions","course":"mx1","year":12,"difficulty":3.0,"marks":3,"weight":6,
     "text":"Evaluate the exact value of $\\cos(\\arcsin(-\\frac{1}{2}) + \\arctan(\\sqrt{3}))$."},
    {"topic_id":"me-t3","subtopic":"T3.1: Inverse Trigonometric Functions","course":"mx1","year":12,"difficulty":3.5,"marks":3,"weight":6,
     "text":"State the domain and range of $f(x) = 2\\arcsin(3x-1)$ and sketch its graph."},
    {"topic_id":"me-t3","subtopic":"T3.1: Inverse Trigonometric Functions","course":"mx1","year":12,"difficulty":3.0,"marks":2,"weight":6,
     "text":"Prove the identity: $\\arcsin(x) + \\arccos(x) = \\frac{\\pi}{2}$ for $-1 \\le x \\le 1$."},
    {"topic_id":"me-t3","subtopic":"T3.2: Auxiliary Angle Method","course":"mx1","year":12,"difficulty":3.5,"marks":3,"weight":6,
     "text":"Find the general solution of $\\sin 2x = \\frac{\\sqrt{3}}{2}$."},
    {"topic_id":"me-t3","subtopic":"T3.2: Auxiliary Angle Method","course":"mx1","year":12,"difficulty":4.0,"marks":4,"weight":6,
     "text":"Express $\\sqrt{3}\\sin x + \\cos x$ in the form $R\\sin(x+\\alpha)$ and solve $\\sqrt{3}\\sin x + \\cos x = 1$ for $0 \\le x \\le 2\\pi$."},

    {"topic_id":"me-c23","subtopic":"C2.1: Integration by Substitution","course":"mx1","year":12,"difficulty":3.5,"marks":4,"weight":8,
     "text":"Use the substitution $u = \\sin x$ to evaluate $\\int \\sin^2 x \\cos^3 x\\,dx$."},
    {"topic_id":"me-c23","subtopic":"C2.2: Integration by Parts","course":"mx1","year":12,"difficulty":3.5,"marks":3,"weight":8,
     "text":"Evaluate $\\int x e^{2x}\\,dx$ using integration by parts."},
    {"topic_id":"me-c23","subtopic":"C3.1: Volumes of Revolution","course":"mx1","year":12,"difficulty":3.5,"marks":4,"weight":8,
     "text":"Find the volume when the region bounded by $y = \\frac{1}{x}$, $x = 1$, $x = 3$, and the x-axis is rotated about the x-axis."},
    {"topic_id":"me-c23","subtopic":"C3.2: Kinematics Using Calculus","course":"mx1","year":12,"difficulty":4.0,"marks":4,"weight":8,
     "text":"A particle moves with acceleration $a(t) = 6t - 2$. If $v(0) = 5$ and $s(0) = 2$, find $s(t)$."},

    {"topic_id":"me-s1","subtopic":"S1.1: Bernoulli and Binomial Distributions","course":"mx1","year":12,"difficulty":2.5,"marks":3,"weight":6,
     "text":"A fair coin is tossed 10 times. Find the probability of obtaining at least 8 heads."},
    {"topic_id":"me-s1","subtopic":"S1.2: Normal Approximation","course":"mx1","year":12,"difficulty":3.5,"marks":4,"weight":6,
     "text":"Use a normal approximation to estimate the probability of at most 45 heads in 100 tosses of a fair coin."},

    {"topic_id":"mex-p12","subtopic":"P1.1: Proof by Contradiction","course":"mx2","year":12,"difficulty":4.0,"marks":4,"weight":9,
     "text":"Prove by contradiction that $\\log_2(3)$ is irrational."},
    {"topic_id":"mex-p12","subtopic":"P1.2: Inequalities and Induction","course":"mx2","year":12,"difficulty":4.5,"marks":5,"weight":9,
     "text":"Prove $(a+b)(b+c)(c+a) \\ge 8abc$ for positive real numbers $a, b, c$ using AM-GM inequality."},

    {"topic_id":"mex-n12","subtopic":"N1.1: Arithmetic of Complex Numbers","course":"mx2","year":12,"difficulty":3.0,"marks":3,"weight":10,
     "text":"Express $\\frac{3 + 4i}{1 - 2i}$ in the form $a + bi$."},
    {"topic_id":"mex-n12","subtopic":"N1.2: Modulus and Argument","course":"mx2","year":12,"difficulty":3.5,"marks":3,"weight":10,
     "text":"Find the modulus and argument of $z = -1 + i\\sqrt{3}$, and express $z$ in polar form."},
    {"topic_id":"mex-n12","subtopic":"N2.1: The Argand Diagram","course":"mx2","year":12,"difficulty":3.0,"marks":2,"weight":10,
     "text":"Plot the complex numbers $z_1 = 3+4i$, $z_2 = -2+i$, and $z_1+z_2$ on an Argand diagram."},
    {"topic_id":"mex-n12","subtopic":"N2.2: De Moivre's Theorem","course":"mx2","year":12,"difficulty":4.0,"marks":4,"weight":10,
     "text":"Find the five complex roots of $z^5 - 1 = 0$ and show them as vertices of a regular pentagon on the Argand diagram."},
    {"topic_id":"mex-n12","subtopic":"N2.2: De Moivre's Theorem","course":"mx2","year":12,"difficulty":4.0,"marks":4,"weight":10,
     "text":"Let $z = \\cos\\theta + i\\sin\\theta$. Use De Moivre's theorem to show that $\\cos 3\\theta = 4\\cos^3\\theta - 3\\cos\\theta$."},
    {"topic_id":"mex-n12","subtopic":"N2.3: Polynomials over Complex Numbers","course":"mx2","year":12,"difficulty":4.5,"marks":5,"weight":10,
     "text":"$P(x) = x^4 + ax^3 + bx^2 + cx + d$ has real coefficients. $2+i$ and $3i$ are roots. Factorise $P(x)$ completely over $\\mathbb{C}$."},
    {"topic_id":"mex-n12","subtopic":"N2.4: Loci on the Argand Diagram","course":"mx2","year":12,"difficulty":4.0,"marks":4,"weight":10,
     "text":"Sketch the region defined by $\\frac{\\pi}{6} \\le \\arg(z - i) \\le \\frac{\\pi}{3}$ on the Argand diagram."},

    {"topic_id":"mex-v1","subtopic":"V1.1: Vectors in 3D Space","course":"mx2","year":12,"difficulty":3.0,"marks":3,"weight":8,
     "text":"Find the angle between the diagonal of a unit cube and one of its adjacent edges using 3D vectors."},
    {"topic_id":"mex-v1","subtopic":"V1.2: Vector Equations of Lines","course":"mx2","year":12,"difficulty":3.5,"marks":4,"weight":8,
     "text":"Determine if the lines $\\mathbf{r}_1 = (1,2,3) + \\lambda(2,-1,4)$ and $\\mathbf{r}_2 = (3,1,0) + \\mu(1,1,-1)$ intersect, are parallel, or are skew."},
    {"topic_id":"mex-v1","subtopic":"V1.3: Vector Equations of Planes","course":"mx2","year":12,"difficulty":4.0,"marks":4,"weight":8,
     "text":"Find the distance from the point $(1, -2, 4)$ to the plane $2x - y + 2z = 5$."},

    {"topic_id":"mex-c1","subtopic":"C1.1: Integration Techniques","course":"mx2","year":12,"difficulty":4.0,"marks":4,"weight":10,
     "text":"Evaluate $\\int x \\ln x\\,dx$ using integration by parts."},
    {"topic_id":"mex-c1","subtopic":"C1.1: Integration Techniques","course":"mx2","year":12,"difficulty":4.5,"marks":5,"weight":10,
     "text":"Decompose $\\frac{5x^2 - x + 2}{(x^2+1)(x-1)}$ into partial fractions and hence evaluate its integral."},
    {"topic_id":"mex-c1","subtopic":"C1.1: Integration Techniques","course":"mx2","year":12,"difficulty":4.5,"marks":5,"weight":10,
     "text":"Derive a reduction formula for $I_n = \\int_0^{\\pi/2} (\\sin x)^n dx$ and use it to calculate $I_4$."},
    {"topic_id":"mex-c1","subtopic":"C1.2: Further Integration","course":"mx2","year":12,"difficulty":5.0,"marks":5,"weight":10,
     "text":"Evaluate $\\int_0^1 \\frac{dx}{\\sqrt{1-x^2}}$ using the substitution $x = \\sin\\theta$."},

    {"topic_id":"mex-m1","subtopic":"M1.1: Work, Energy and Power","course":"mx2","year":12,"difficulty":4.0,"marks":4,"weight":9,
     "text":"A particle of mass 2 kg moves along the x-axis under a force $F(x) = 3x^2 - 4x$. Starting from rest at the origin, find its velocity at $x = 3$ using work-energy principles."},
    {"topic_id":"mex-m1","subtopic":"M1.2: Resisted Motion","course":"mx2","year":12,"difficulty":4.5,"marks":5,"weight":9,
     "text":"A body of mass $m$ falls from rest under gravity in a medium with resistance $R = -kv$. Derive an expression for velocity as a function of time and state the terminal velocity."},
    {"topic_id":"mex-m1","subtopic":"M1.3: Projectile Motion with Resistance","course":"mx2","year":12,"difficulty":5.0,"marks":5,"weight":9,
     "text":"Set up and solve the coupled ODEs for projectile motion with air resistance: $m\\ddot{x} = -k\\dot{x}$, $m\\ddot{y} = -mg - k\\dot{y}$."},
    {"topic_id":"mex-m1","subtopic":"M1.4: Circular Motion","course":"mx2","year":12,"difficulty":4.5,"marks":5,"weight":9,
     "text":"A vehicle of mass $m$ travels around a circular track of radius $r$ banked at angle $\\theta$. Determine the ideal speed at which no lateral frictional force is required."},
]

def seed():
    app = create_app()
    with app.app_context():
        existing_count = Question.query.count()
        if existing_count > 0:
            Question.query.delete()
            db.session.commit()

        count = 0
        for q in QUESTIONS:
            question = Question(
                topic_id=q['topic_id'],
                subtopic=q['subtopic'],
                question_text=q['text'],
                difficulty=q['difficulty'],
                hsc_marks=q['marks'],
                hsc_exam_weight=q['weight'],
                course=q['course'],
                year_level=q['year'],
            )
            db.session.add(question)
            count += 1

        db.session.commit()

if __name__ == '__main__':
    seed()
