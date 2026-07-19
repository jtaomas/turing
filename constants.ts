export interface SyllabusTopic {
  id: string;
  name: string;
  subtopics?: string[];
  problemsBySubtopic?: Record<string, string[]>;
  problems: string[];
}

export interface SyllabusCourse {
  id: string;
  name: string;
  sections: {
    name: string;
    topics: SyllabusTopic[];
  }[];
}

export const SYLLABUS: SyllabusCourse[] = [
  {
    id: 'adv',
    name: 'Mathematics Advanced',
    sections: [
      {
        name: 'Year 11 Advanced',
        topics: [
          {
            id: 'ma-f1',
            name: 'Functions (MA-F1)',
            subtopics: [
              'F1.1: Working with Functions',
              'F1.2: Linear, Quadratic and Cubic Functions',
              'F1.3: Further Algebraic Skills'
            ],
            problemsBySubtopic: {
              'F1.1: Working with Functions': [
                "Determine the domain and range of the function f(x) = 1 / sqrt(x^2 - 16).",
                "Given the function f(x) = x^2 - 2x, find and simplify the expression for (f(x+h) - f(x)) / h.",
                "Apply the vertical line test to distinguish which of the following relations is a function: (a) x^2 + y^2 = 9, (b) y = |x - 2|."
              ],
              'F1.2: Linear, Quadratic and Cubic Functions': [
                "Solve the simultaneous equations algebraically: y = 2x - 3 and y = x^2 - 5x + 7.",
                "Find the vertex, axis of symmetry, and x-intercepts of the quadratic function y = -2x^2 + 8x + 10.",
                "Graph the cubic function y = (x - 2)^3 + 1 and identify its point of symmetry and intercepts."
              ],
              'F1.3: Further Algebraic Skills': [
                "Solve the absolute value equation |2x - 3| = x + 5.",
                "Simplify the algebraic fraction completely: (x^2 - 9) / (2x^2 - 5x - 3).",
                "Simplify the expression using index laws: (x^(2/3) * y^(-1/2)) / (x^(-1/3) * y^(3/2))."
              ]
            },
            problems: [
              "Determine the domain and range of the function f(x) = 1 / sqrt(x^2 - 16).",
              "Solve the simultaneous equations algebraically: y = 2x - 3 and y = x^2 - 5x + 7.",
              "Solve the absolute value equation |2x - 3| = x + 5."
            ]
          },
          {
            id: 'ma-t1',
            name: 'Trigonometric Functions (MA-T1)',
            subtopics: [
              'T1.1: Radian Measure',
              'T1.2: Trigonometric Functions and Identities'
            ],
            problemsBySubtopic: {
              'T1.1: Radian Measure': [
                "Find the area of a sector of a circle of radius 6 cm with a central angle of 2pi/3 radians.",
                "An arc of length 15 cm subtends an angle of 150 degrees at the centre of a circle. Calculate the exact radius in terms of pi."
              ],
              'T1.2: Trigonometric Functions and Identities': [
                "Solve the trigonometric equation 2 cos^2(theta) - 1 = 0 for 0 <= theta <= 2pi.",
                "Prove the fundamental Pythagorean identity: (sin theta)/(1 - cos theta) + (1 - cos theta)/(sin theta) = 2 cosec theta.",
                "Sketch the graph of y = tan(x) for -pi/2 < x < 3pi/2, showing all asymptotes and x-intercepts."
              ]
            },
            problems: [
              "Find the area of a sector of a circle of radius 6 cm with a central angle of 2pi/3 radians.",
              "Solve the trigonometric equation 2 cos^2(theta) - 1 = 0 for 0 <= theta <= 2pi."
            ]
          },
          {
            id: 'ma-c1',
            name: 'Calculus (MA-C1)',
            subtopics: [
              'C1.1: Rates of Change',
              'C1.2: The Derivative and Tangents',
              'C1.3: Rules of Differentiation'
            ],
            problemsBySubtopic: {
              'C1.1: Rates of Change': [
                "A particle moves along a straight line such that its position is s(t) = t^3 - 4t. Find the average velocity from t = 1 to t = 3.",
                "Distinguish between average and instantaneous rates of change by describing how the gradient of a secant relates to the gradient of a tangent."
              ],
              'C1.2: The Derivative and Tangents': [
                "Find the derivative of f(x) = x^2 + 5x from first principles using f'(x) = lim_{h -> 0} (f(x+h) - f(x))/h.",
                "Find the equations of the tangent and the normal to the curve y = 3x^2 - 5x + 2 at the point (2, 4)."
              ],
              'C1.3: Rules of Differentiation': [
                "Differentiate the function f(x) = (3x^2 - 1)^4 with respect to x using the chain rule.",
                "Differentiate y = (2x + 1) / (x^2 - 3) using the quotient rule.",
                "Apply the product rule to find the derivative of y = x^3 * sqrt(2x + 5)."
              ]
            },
            problems: [
              "Find the derivative of f(x) = x^2 + 5x from first principles using f'(x) = lim_{h -> 0} (f(x+h) - f(x))/h.",
              "Differentiate the function f(x) = (3x^2 - 1)^4 with respect to x using the chain rule."
            ]
          },
          {
            id: 'ma-e1',
            name: 'Exponential and Logarithmic Functions (MA-E1)',
            subtopics: [
              'E1.1: Properties of Exponential and Logarithmic Functions',
              'E1.2: Natural Logarithms and Exponential Models'
            ],
            problemsBySubtopic: {
              'E1.1: Properties of Exponential and Logarithmic Functions': [
                "Solve the equation log_2(x) + log_2(x - 3) = 2.",
                "Use the change of base formula and log laws to express log_3(5) in terms of natural logarithms."
              ],
              'E1.2: Natural Logarithms and Exponential Models': [
                "A colony of bacteria grows according to the model A = A_0 * e^(kt). If there are initially 500 bacteria and this population doubles in 4 hours, find k and the population after 10 hours.",
                "Solve for x exactly: e^(2x) - 5e^x + 6 = 0."
              ]
            },
            problems: [
              "Solve the equation log_2(x) + log_2(x - 3) = 2.",
              "Solve for x exactly: e^(2x) - 5e^x + 6 = 0."
            ]
          },
          {
            id: 'ma-s1',
            name: 'Statistical Analysis (MA-S1)',
            subtopics: [
              'S1.1: Probability and Venn Diagrams',
              'S1.2: Discrete Probability Distributions'
            ],
            problemsBySubtopic: {
              'S1.1: Probability and Venn Diagrams': [
                "In a group of 30 students, 18 study Physics, 15 study Chemistry, and 8 study both. Find the probability that a randomly chosen student studies Physics given that they study Chemistry.",
                "For two events A and B, P(A) = 0.6, P(B) = 0.5, and P(A U B) = 0.8. Determine if A and B are independent events."
              ],
              'S1.2: Discrete Probability Distributions': [
                "A discrete random variable X has probability distribution P(X = x) = c * x^2 for x in {1, 2, 3}. Find the value of the constant c, and calculate the expected value E(X).",
                "A random variable Y represents the score on a biased 4-sided die. If the probability mass function is given by P(Y=y) = y/10, find the variance Var(Y)."
              ]
            },
            problems: [
              "In a group of 30 students, 18 study Physics, 15 study Chemistry, and 8 study both. Find the probability that a randomly chosen student studies Physics given that they study Chemistry.",
              "A discrete random variable X has probability distribution P(X = x) = c * x^2 for x in {1, 2, 3}. Find the value of the constant c, and calculate the expected value E(X)."
            ]
          }
        ]
      },
      {
        name: 'Year 12 Advanced',
        topics: [
          {
            id: 'ma-f2',
            name: 'Functions (MA-F2)',
            subtopics: [
              'F2.1: Graphing Techniques'
            ],
            problemsBySubtopic: {
              'F2.1: Graphing Techniques': [
                "Given the graph of y = f(x), describe the sequence of geometric transformations that maps it to the graph of y = -2f(x + 3) - 1.",
                "Let f(x) = x^2 and g(x) = 2x. Sketch the sum function y = f(x) + g(x) by adding ordinates."
              ]
            },
            problems: [
              "Given the graph of y = f(x), describe the sequence of geometric transformations that maps it to the graph of y = -2f(x + 3) - 1."
            ]
          },
          {
            id: 'ma-t2',
            name: 'Trigonometric Functions (MA-T2)',
            subtopics: [
              'T2.1: Graphs of Trigonometric Functions'
            ],
            problemsBySubtopic: {
              'T2.1: Graphs of Trigonometric Functions': [
                "State the amplitude, period, and phase shift of the function y = 3 sin(2x - pi/3) + 1, and sketch its graph for 0 <= x <= pi."
              ]
            },
            problems: [
              "State the amplitude, period, and phase shift of the function y = 3 sin(2x - pi/3) + 1, and sketch its graph for 0 <= x <= pi."
            ]
          },
          {
            id: 'ma-c234',
            name: 'Calculus (MA-C2, C3, C4)',
            subtopics: [
              'C2.1: Differentiating Transcendental Functions',
              'C3.1: Applications of Differentiation',
              'C4.1: The Anti-derivative and Indefinite Integral',
              'C4.2: The Definite Integral and Areas'
            ],
            problemsBySubtopic: {
              'C2.1: Differentiating Transcendental Functions': [
                "Differentiate y = e^(-2x) * sin(3x) with respect to x.",
                "Find the derivative of the function f(x) = ln(x^2 + 4x)."
              ],
              'C3.1: Applications of Differentiation': [
                "Find and classify all stationary points of y = x^3 - 3x^2 - 9x + 5 and sketch the curve, identifying intervals of increase and decrease.",
                "A cylindrical metal can is to be made with a volume of 250pi cm^3. Find the dimensions (radius and height) that minimize the total surface area."
              ],
              'C4.1: The Anti-derivative and Indefinite Integral': [
                "Find the indefinite integral: integral of (2x + 3)^4 dx.",
                "Determine the indefinite integral: integral of (e^(3x-1) + sin(2x)) dx."
              ],
              'C4.2: The Definite Integral and Areas': [
                "Evaluate the definite integral exactly: integral from 1 to 4 of (sqrt(x) + 1/x) dx.",
                "Find the exact area of the region bounded by the curve y = cos(x), the x-axis, and the lines x = 0 and x = pi/2."
              ]
            },
            problems: [
              "Differentiate y = e^(-2x) * sin(3x) with respect to x.",
              "Find and classify all stationary points of y = x^3 - 3x^2 - 9x + 5 and sketch the curve, identifying intervals of increase and decrease."
            ]
          },
          {
            id: 'ma-m1',
            name: 'Financial Mathematics (MA-M1)',
            subtopics: [
              'M1.1: Arithmetic Progressions',
              'M1.2: Geometric Progressions',
              'M1.3: Financial Applications of Series'
            ],
            problemsBySubtopic: {
              'M1.1: Arithmetic Progressions': [
                "In an arithmetic progression, the 4th term is 15 and the 10th term is 39. Find the first term, common difference, and the sum of the first 20 terms."
              ],
              'M1.2: Geometric Progressions': [
                "The sum to infinity of a limiting geometric progression is 18, and its common ratio is -1/3. Find the first term.",
                "Calculate the sum of the first 10 terms of the geometric progression: 3, 6, 12, 24..."
              ],
              'M1.3: Financial Applications of Series': [
                "Calculate the future value of an annuity where $1200 is deposited at the end of each year for 15 years into an account paying 6% p.a. compound interest."
              ]
            },
            problems: [
              "In an arithmetic progression, the 4th term is 15 and the 10th term is 39. Find the first term, common difference, and the sum of the first 20 terms.",
              "Calculate the future value of an annuity where $1200 is deposited at the end of each year for 15 years into an account paying 6% p.a. compound interest."
            ]
          },
          {
            id: 'ma-s23',
            name: 'Statistical Analysis (MA-S2, S3)',
            subtopics: [
              'S2.1: Descriptive Statistics and Data Analysis',
              'S3.1: Continuous Random Variables',
              'S3.2: Normal Distribution'
            ],
            problemsBySubtopic: {
              'S2.1: Descriptive Statistics and Data Analysis': [
                "A sample of 5 scores has a mean of 12 and a standard deviation of 2. If a new score of 18 is added to the sample, find the new mean."
              ],
              'S3.1: Continuous Random Variables': [
                "The probability density function of a continuous random variable X is given by f(x) = k*x*(2-x) for 0 <= x <= 2 and 0 otherwise. Determine the value of k and calculate the variance of X.",
                "Find the cumulative distribution function F(x) for a random variable with PDF f(x) = 3x^2 on [0, 1]."
              ],
              'S3.2: Normal Distribution': [
                "If a dataset of exam scores is normally distributed with mean 70 and standard deviation 8, find the z-score of a student who scored 86 and determine the percentage of students scoring below 62."
              ]
            },
            problems: [
              "The probability density function of a continuous random variable X is given by f(x) = k*x*(2-x) for 0 <= x <= 2 and 0 otherwise. Determine the value of k and calculate the variance of X."
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'mx1',
    name: 'Mathematics Extension 1',
    sections: [
      {
        name: 'Year 11 Extension 1',
        topics: [
          {
            id: 'me-f1',
            name: 'Functions (ME-F1, F2)',
            subtopics: [
              'F1.1: Further Work with Functions',
              'F2.1: Polynomials (Remainder & Factor Theorems)'
            ],
            problemsBySubtopic: {
              'F1.1: Further Work with Functions': [
                "Given the graph of y = f(x), describe how to sketch the graph of y = 1/f(x) and find any asymptotes.",
                "Find the inverse function f^-1(x) for f(x) = (2x + 3) / (x - 1) and state its domain and range."
              ],
              'F2.1: Polynomials (Remainder & Factor Theorems)': [
                "The polynomial P(x) = 2x^3 + ax^2 + bx - 6 has a factor of (x - 2) and leaves a remainder of -15 when divided by (x + 1). Find the values of a and b.",
                "If the equation x^3 - 3x^2 + kx - 8 = 0 has three roots in geometric progression, find the value of k."
              ]
            },
            problems: [
              "Find the inverse function f^-1(x) for f(x) = (2x + 3) / (x - 1) and state its domain and range.",
              "The polynomial P(x) = 2x^3 + ax^2 + bx - 6 has a factor of (x - 2) and leaves a remainder of -15 when divided by (x + 1). Find the values of a and b."
            ]
          },
          {
            id: 'me-t12',
            name: 'Trigonometric Functions (ME-T1, T2)',
            subtopics: [
              'T1.1: Reciprocal Trig Functions (sec, cosec, cot)',
              'T2.1: Compound Angles and Double Angles',
              'T2.2: The t-Formulae'
            ],
            problemsBySubtopic: {
              'T1.1: Reciprocal Trig Functions (sec, cosec, cot)': [
                "Simplify the expression (sec(theta) + cosec(theta)) / (tan(theta) + cot(theta)).",
                "Prove the identity: sec^2(theta) + cosec^2(theta) = sec^2(theta) * cosec^2(theta)."
              ],
              'T2.1: Compound Angles and Double Angles': [
                "Prove the identity: (sin 2A) / (1 + cos 2A) = tan A.",
                "Express sin(3*theta) in terms of sin(theta) using compound and double angle formulas."
              ],
              'T2.2: The t-Formulae': [
                "Use the substitution t = tan(theta/2) to solve the equation 3 cos(theta) - 4 sin(theta) = 2 for 0 <= theta <= 2pi."
              ]
            },
            problems: [
              "Evaluate the exact value of cos(arcsin(-1/2) + arctan(sqrt(3))).",
              "Prove the identity: (sin 2A) / (1 + cos 2A) = tan A."
            ]
          },
          {
            id: 'me-c1',
            name: 'Calculus (ME-C1)',
            subtopics: [
              'C1.1: Related Rates of Change',
              'C1.2: Implicit Differentiation'
            ],
            problemsBySubtopic: {
              'C1.1: Related Rates of Change': [
                "Water is poured into a conical cup of radius 5 cm and height 10 cm at a rate of 2 cm^3/s. Find the rate at which the water level is rising when the depth of water is 4 cm."
              ],
              'C1.2: Implicit Differentiation': [
                "Find the equation of the tangent to the curve x^2 + xy + y^2 = 7 at the point (1, 2) using implicit differentiation."
              ]
            },
            problems: [
              "Water is poured into a conical cup of radius 5 cm and height 10 cm at a rate of 2 cm^3/s. Find the rate at which the water level is rising when the depth of water is 4 cm.",
              "Find the equation of the tangent to the curve x^2 + xy + y^2 = 7 at the point (1, 2) using implicit differentiation."
            ]
          },
          {
            id: 'me-a1',
            name: 'Combinatorics (ME-A1)',
            subtopics: [
              'A1.1: Permutations and Combinations',
              'A1.2: The Binomial Theorem'
            ],
            problemsBySubtopic: {
              'A1.1: Permutations and Combinations': [
                "In how many ways can 6 people be seated around a circular table if 2 specific people must sit next to each other?",
                "Prove using the Pigeonhole Principle that if 5 integers are selected, at least two of them will have the same remainder when divided by 4."
              ],
              'A1.2: The Binomial Theorem': [
                "Find the coefficient of x^3 in the expansion of (2x - 1/x)^9.",
                "Prove that the sum of the binomial coefficients is 2^n by expanding (1 + x)^n."
              ]
            },
            problems: [
              "In how many ways can 6 people be seated around a circular table if 2 specific people must sit next to each other.",
              "Find the coefficient of x^3 in the expansion of (2x - 1/x)^9."
            ]
          }
        ]
      },
      {
        name: 'Year 12 Extension 1',
        topics: [
          {
            id: 'me-p1',
            name: 'Proof (ME-P1)',
            subtopics: [
              'P1.1: Proof by Mathematical Induction'
            ],
            problemsBySubtopic: {
              'P1.1: Proof by Mathematical Induction': [
                "Prove by mathematical induction that 1*1! + 2*2! + ... + n*n! = (n+1)! - 1 for all integers n >= 1.",
                "Prove that 3^(2n) + 7 is divisible by 8 for all positive integers n."
              ]
            },
            problems: [
              "Prove by mathematical induction that 3^(2n) + 7 is divisible by 8 for all positive integers n."
            ]
          },
          {
            id: 'me-v1',
            name: 'Vectors (ME-V1)',
            subtopics: [
              'V1.1: Introduction to 2D Vectors',
              'V1.2: The Scalar Product'
            ],
            problemsBySubtopic: {
              'V1.1: Introduction to 2D Vectors': [
                "Given u = 2i - 3j and v = -i + 4j, find the magnitude of the vector 3u + 2v."
              ],
              'V1.2: The Scalar Product': [
                "Find the value of k for which the vectors a = k*i + 2*j and b = 3*i - j are perpendicular.",
                "Find the vector projection of u = i + 3j onto v = 2i - j."
              ]
            },
            problems: [
              "Find the value of k for which the vectors a = k*i + 2*j and b = 3*i - j are perpendicular."
            ]
          },
          {
            id: 'me-t3',
            name: 'Trigonometric Functions (ME-T3)',
            subtopics: [
              'T3.1: Inverse Trigonometric Functions',
              'T3.2: Auxiliary Angle Method'
            ],
            problemsBySubtopic: {
              'T3.1: Inverse Trigonometric Functions': [
                "Evaluate the exact value of cos(arcsin(-1/2) + arctan(sqrt(3))).",
                "State the domain and range of the function f(x) = 2 arcsin(3x - 1) and sketch its graph.",
                "Prove the identity: arcsin(x) + arccos(x) = pi/2 for -1 <= x <= 1."
              ],
              'T3.2: Auxiliary Angle Method': [
                "Express 5 cos(theta) - 12 sin(theta) in the auxiliary angle form R cos(theta + alpha), and hence solve 5 cos(theta) - 12 sin(theta) = 6.5 for 0 <= theta <= 360 degrees."
              ]
            },
            problems: [
              "Evaluate the exact value of cos(arcsin(-1/2) + arctan(sqrt(3))).",
              "Express 5 cos(theta) - 12 sin(theta) in the auxiliary angle form R cos(theta + alpha), and hence solve 5 cos(theta) - 12 sin(theta) = 6.5."
            ]
          },
          {
            id: 'me-c23',
            name: 'Calculus (ME-C2, C3)',
            subtopics: [
              'C2.1: Integration by Substitution',
              'C2.2: Integration using Trigonometric Identities',
              'C3.1: Volumes of Solids of Revolution',
              'C3.2: Differential Equations',
              'C3.3: Kinematics and Acceleration'
            ],
            problemsBySubtopic: {
              'C2.1: Integration by Substitution': [
                "Use the substitution u = sin(x) to find the integral of sin^2(x) * cos^3(x) dx.",
                "Evaluate the definite integral exactly: integral from 0 to 2 of x / sqrt(4 - x^2) dx."
              ],
              'C2.2: Integration using Trigonometric Identities': [
                "Find the exact value of the integral from 0 to pi/4 of cos^2(x) dx."
              ],
              'C3.1: Volumes of Solids of Revolution': [
                "Find the volume of the solid of revolution formed when the region bounded by y = 1/x, the x-axis, and the lines x=1 and x=3 is rotated about the x-axis."
              ],
              'C3.2: Differential Equations': [
                "Solve the separable differential equation dy/dx = x / (y * e^(x^2)), given that y = 2 when x = 0."
              ],
              'C3.3: Kinematics and Acceleration': [
                "A particle moves in Simple Harmonic Motion according to d^2x/dt^2 = -9x. If the particle starts at the origin with a velocity of 6 m/s, find its amplitude and equation of motion.",
                "A projectile is launched from ground level with initial speed u at an angle of elevation theta. Show that the range on horizontal ground is (u^2 * sin 2*theta) / g."
              ]
            },
            problems: [
              "Use the substitution u = sin(x) to find the integral of sin^2(x) * cos^3(x) dx.",
              "A particle moves in Simple Harmonic Motion according to d^2x/dt^2 = -9x. If the particle starts at the origin with a velocity of 6 m/s, find its amplitude and equation of motion."
            ]
          },
          {
            id: 'me-s1',
            name: 'Statistical Analysis (ME-S1)',
            subtopics: [
              'S1.1: The Binomial Distribution'
            ],
            problemsBySubtopic: {
              'S1.1: The Binomial Distribution': [
                "A fair coin is tossed 10 times. Find the probability of obtaining at least 8 heads.",
                "Use the normal distribution to approximate the probability of getting between 45 and 55 heads when tossing a fair coin 100 times."
              ]
            },
            problems: [
              "A fair coin is tossed 10 times. Find the probability of obtaining at least 8 heads."
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'mx2',
    name: 'Mathematics Extension 2',
    sections: [
      {
        name: 'Year 12 Only (Extension 2)',
        topics: [
          {
            id: 'mex-p12',
            name: 'Proof (MEX-P1, P2)',
            subtopics: [
              'P1.1: The Nature of Proof',
              'P1.2: Formal Proofs (Contradiction, Contrapositive)',
              'P1.3: Inequalities (AM-GM)',
              'P2.1: Further Mathematical Induction'
            ],
            problemsBySubtopic: {
              'P1.1: The Nature of Proof': [
                "Prove by contradiction that log_2(3) is irrational.",
                "Prove that for any positive numbers a, b, and c, (a + b)(b + c)(c + a) >= 8abc using the AM-GM inequality."
              ],
              'P1.2: Formal Proofs (Contradiction, Contrapositive)': [
                "Prove by contrapositive: if n^2 is even, then n is even.",
                "Prove by contradiction that sqrt(2) is irrational."
              ],
              'P1.3: Inequalities (AM-GM)': [
                "For positive real numbers x and y, prove that x/y + y/x >= 2.",
                "Using AM-GM, prove that for a, b > 0, (a+b)/2 >= sqrt(ab)."
              ],
              'P2.1: Further Mathematical Induction': [
                "Prove by induction that 2^n > n^2 for all integers n >= 5.",
                "A sequence is defined recursively by a_1 = 1, a_2 = 3, and a_n = 2a_{n-1} - a_{n-2} for n >= 3. Prove that a_n = 2n - 1 for all integers n >= 1."
              ]
            },
            problems: [
              "Prove by contradiction that log_2(3) is irrational.",
              "Prove that for any positive numbers a, b, and c, (a + b)(b + c)(c + a) >= 8abc using the AM-GM inequality."
            ]
          },
          {
            id: 'mex-v1',
            name: 'Vectors (MEX-V1)',
            subtopics: [
              'V1.1: Vectors in 3D Space',
              'V1.2: Vector Equations of Lines and Planes'
            ],
            problemsBySubtopic: {
              'V1.1: Vectors in 3D Space': [
                "Find the angle between the diagonal of a cube and one of its adjacent edges using 3D vector methods.",
                "Calculate the distance between the point (2, -1, 4) and the line r = (1, 1, 1) + t(2, -1, 3)."
              ],
              'V1.2: Vector Equations of Lines and Planes': [
                "Determine whether the two 3D lines r1 = (1, 2, 3) + lambda*(2, -1, 4) and r2 = (3, 1, 0) + mu*(1, 1, -1) intersect, are parallel, or are skew."
              ]
            },
            problems: [
              "Find the angle between the diagonal of a cube and one of its adjacent edges using 3D vector methods."
            ]
          },
          {
            id: 'mex-n12',
            name: 'Complex Numbers (MEX-N1, N2)',
            subtopics: [
              'N1.1: Introduction to Complex Numbers',
              'N1.2: The Argand Diagram',
              'N2.1: Polar and Exponential Forms',
              'N2.2: De Moivre\'s Theorem and Applications',
              'N2.3: Polynomials over the Complex Numbers',
              'N2.4: Loci on the Argand Diagram'
            ],
            problemsBySubtopic: {
              'N1.1: Introduction to Complex Numbers': [
                "Solve the complex quadratic equation z^2 + (1 - i)z + (2 + i) = 0 over the set of complex numbers."
              ],
              'N1.2: The Argand Diagram': [
                "If z = -1 + i*sqrt(3), represent z on an Argand diagram, and calculate its modulus and principal argument."
              ],
              'N2.1: Polar and Exponential Forms': [
                "Express z1 = 1 + i and z2 = sqrt(3) - i in polar form, and hence find the exact Cartesian form of z1 / z2."
              ],
              'N2.2: De Moivre\'s Theorem and Applications': [
                "Find the five complex roots of z^5 - 1 = 0, and show them as vertices of a regular pentagon on the Argand diagram."
              ],
              'N2.3: Polynomials over the Complex Numbers': [
                "A polynomial P(x) = x^4 + ax^3 + bx^2 + cx + d has real coefficients. If 2 + i and 3i are roots of P(x) = 0, factorise P(x) completely over the complex field."
              ],
              'N2.4: Loci on the Argand Diagram': [
                "Sketch the region on the Argand diagram defined by the inequality: pi/6 <= arg(z - i) <= pi/3."
              ]
            },
            problems: [
              "Find the five complex roots of z^5 - 1 = 0, and show them as vertices of a regular pentagon on the Argand diagram.",
              "Sketch the region on the Argand diagram defined by the inequality: pi/6 <= arg(z - i) <= pi/3."
            ]
          },
          {
            id: 'mex-c1',
            name: 'Calculus (MEX-C1)',
            subtopics: [
              'C1.1: Integration Techniques'
            ],
            problemsBySubtopic: {
              'C1.1: Integration Techniques': [
                "Find the indefinite integral of x^2 * ln(x) dx using Integration by Parts.",
                "Decompose the rational function (5x^2 - x + 2) / ((x^2 + 1)(x - 1)) into partial fractions, and hence evaluate its integral with respect to x.",
                "Derive a reduction formula for I_n = integral from 0 to pi/2 of (sin x)^n dx, and use it to calculate I_4."
              ]
            },
            problems: [
              "Find the indefinite integral of x^2 * ln(x) dx using Integration by Parts.",
              "Decompose the rational function (5x^2 - x + 2) / ((x^2 + 1)(x - 1)) into partial fractions, and hence evaluate its integral with respect to x."
            ]
          },
          {
            id: 'mex-m1',
            name: 'Mechanics (MEX-M1)',
            subtopics: [
              'M1.1: Work, Energy and Power (Kinematics Ext.)',
              'M1.2: Resisted Motion',
              'M1.3: Projectile Motion with Resistance',
              'M1.4: Circular Motion'
            ],
            problemsBySubtopic: {
              'M1.1: Work, Energy and Power (Kinematics Ext.)': [
                "A particle of mass 2 kg moves along the x-axis under a force F(x) = 3x^2 - 4x. If it starts from rest at the origin, find its velocity at x = 3 using work-energy principles."
              ],
              'M1.2: Resisted Motion': [
                "A body of mass m falls from rest under gravity in a medium experiencing resistance proportional to velocity (R = -kv). Derive an expression for its velocity as a function of time, and state its terminal velocity."
              ],
              'M1.3: Projectile Motion with Resistance': [
                "Set up and solve the coupled differential equations of motion for a projectile experiencing air resistance opposite to velocity: m * x_ddot = -k * x_dot and m * y_ddot = -mg - k * y_dot."
              ],
              'M1.4: Circular Motion': [
                "A vehicle of mass m travels around a circular track of radius r banked at an angle theta. Determine the ideal speed at which no lateral frictional force is required."
              ]
            },
            problems: [
              "A body of mass m falls from rest under gravity in a medium experiencing resistance proportional to velocity (R = -kv). Derive an expression for its velocity as a function of time, and state its terminal velocity.",
              "A vehicle of mass m travels around a circular track of radius r banked at an angle theta. Determine the ideal speed at which no lateral frictional force is required."
            ]
          }
        ]
      }
    ]
  }
];

export const COURSE_HIERARCHY: Record<string, string[]> = {
  adv: ['adv'],
  mx1: ['mx1'],
  mx2: ['mx2'],
};

export function getEffectiveCourseIds(course: string): string[] {
  return COURSE_HIERARCHY[course] || ['adv'];
}

export function getSyllabusTopicsForCourse(course: string): SyllabusTopic[] {
  const courseIds = getEffectiveCourseIds(course);
  const topics: SyllabusTopic[] = [];
  for (const c of SYLLABUS) {
    if (courseIds.includes(c.id)) {
      for (const s of c.sections) {
        topics.push(...s.topics);
      }
    }
  }
  return topics;
}