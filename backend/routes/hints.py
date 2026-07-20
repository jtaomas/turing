from flask import Blueprint, request, jsonify, current_app
import os, base64, json as json_lib, re, traceback, requests
from flask import Blueprint, request, jsonify, current_app, g
from google import genai
from google.genai import types as genai_types
from models import db, HintLog
from auth import token_required

hints_bp = Blueprint('hints', __name__, url_prefix='/api')

SYSTEM_PROMPT = (
    "You are an expert Mathematics Assessor and Marker. Your job is to rigorously evaluate student solutions "
    "against a provided question, sample solution, and marking criteria.\n\n"
    "Follow these strict rules when evaluating:\n"
    "1. First Principles Verification: Do not just check if the student's final answer matches the sample solution. "
    "Manually compute or verify every single logical step, algebraic manipulation, or calculus operation the student performs.\n"
    "2. LaTeX Parsing: Interpret standard mathematical notations written in LaTeX ($...$ or $$...$$).\n"
    "3. Error Isolation: If a student makes a mistake early in a multi-part calculation, isolate that specific error. "
    "Check if their subsequent steps are mathematically valid based on their initial error "
    "(Carry-Through Error / Error Carried Forward). Award partial credit if subsequent logic is correct "
    "based on the false premise, unless the mistake trivializes the problem.\n"
    "4. Mathematical Rigor: Flag missing conditions (e.g., forgetting '+ C' in an indefinite integral, "
    "missing boundary conditions, or division by zero errors).\n\n"
    "Output strictly in JSON format with the fields: is_correct, score_awarded, total_possible_marks, "
    "step_by_step_analysis, identified_errors, constructive_feedback."
)

def _call_gemini_mark(problem_text: str, student_work: str, image_b64: str = '') -> dict | None:
    api_key = current_app.config.get('GEMINI_API_KEY', '')
    if not api_key:
        return None

    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={api_key}'

    user_content = f"""QUESTION:
{problem_text}

STUDENT SUBMISSION:
{student_work or '[No text submitted — see image]'}"""

    parts = [{'text': user_content}]
    if image_b64:
        parts.insert(0, {
            'inline_data': {
                'mime_type': 'image/png',
                'data': image_b64
            }
        })

    payload = {
        'contents': [{'role': 'user', 'parts': parts}],
        'systemInstruction': {'parts': [{'text': SYSTEM_PROMPT}]},
        'generationConfig': {
            'temperature': 0.1,
            'responseMimeType': 'application/json',
            'responseSchema': {
                'type': 'OBJECT',
                'properties': {
                    'is_correct': {'type': 'BOOLEAN'},
                    'score_awarded': {'type': 'INTEGER'},
                    'total_possible_marks': {'type': 'INTEGER'},
                    'step_by_step_analysis': {'type': 'STRING'},
                    'identified_errors': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'constructive_feedback': {'type': 'STRING'}
                },
                'required': ['is_correct', 'score_awarded', 'total_possible_marks', 'step_by_step_analysis', 'identified_errors', 'constructive_feedback']
            }
        }
    }

    try:
        resp = requests.post(url, headers={'Content-Type': 'application/json'}, data=json_lib.dumps(payload), timeout=60)
        if resp.status_code != 200:
            current_app.logger.warning(f'Gemini API error {resp.status_code}: {resp.text[:300]}')
            return None
        data = resp.json()
        text = data['candidates'][0]['content']['parts'][0]['text']
        return json_lib.loads(text)
    except Exception as e:
        current_app.logger.warning(f'Gemini mark failed: {e}')
        return None


def get_topic_guide(topic_id: str) -> dict | None:
    
    guides = {
        'ma-f1': {'desc': 'Working with functions, absolute values, and domain/range restrictions.', 'level': 'Advanced'},
        'ma-t1': {'desc': 'Radian measures, sector areas, identities, and trigonometric functions.', 'level': 'Advanced'},
        'ma-c1': {'desc': 'Foundational rates of change, first-principles derivatives, and tangents.', 'level': 'Advanced'},
        'ma-e1': {'desc': 'Properties of exponential and logarithmic functions with base e.', 'level': 'Advanced'},
        'ma-s1': {'desc': 'Probability models, Venn diagrams, and discrete random variables.', 'level': 'Advanced'},
        'ma-f2': {'desc': 'Advanced graphing transformations and adding ordinates.', 'level': 'Advanced'},
        'ma-t2': {'desc': 'Graphs of trigonometric functions and wave features.', 'level': 'Advanced'},
        'ma-c234': {'desc': 'Transcendental calculus, optimization, and integration methods.', 'level': 'Advanced'},
        'ma-m1': {'desc': 'Arithmetic and Geometric progressions with financial applications.', 'level': 'Advanced'},
        'ma-s23': {'desc': 'Descriptive stats, continuous random variables, and normal distributions.', 'level': 'Advanced'},
        'me-f1': {'desc': 'Further functions, reciprocal graphs, and polynomial roots.', 'level': 'Ext'},
        'me-t12': {'desc': 'Inverse trig, double/compound angles, and t-formulae.', 'level': 'Ext'},
        'me-c1': {'desc': 'Related rates of change and implicit differentiation.', 'level': 'Ext'},
        'me-a1': {'desc': 'Circular permutations, Pigeonhole Principle, and Binomial Theorem.', 'level': 'Ext'},
        'me-p1': {'desc': 'Proofs by mathematical induction for series and divisibility.', 'level': 'Ext'},
        'me-v1': {'desc': 'Introduction to vectors, scalar product, and projections.', 'level': 'Ext'},
        'me-t3': {'desc': 'Auxiliary angles and complex trigonometric equations.', 'level': 'Ext'},
        'me-c23': {'desc': 'Integration by substitution, volumes of revolution, and mechanics.', 'level': 'Ext'},
        'me-s1': {'desc': 'The Binomial Distribution and normal approximations.', 'level': 'Ext'},
        'mex-p12': {'desc': 'Nature of proof, AM-GM inequality, and further induction.', 'level': 'Ext'},
        'mex-v1': {'desc': '3D vectors, line equations, skew lines, and planes.', 'level': 'Ext'},
        'mex-n12': {'desc': 'Complex numbers, Argand diagrams, De Moivre theorem, and loci.', 'level': 'Ext'},
        'mex-c1': {'desc': 'Integration by parts, partial fractions, and reduction formulae.', 'level': 'Ext'},
        'mex-m1': {'desc': 'Work, energy, power, resisted motion, and circular motion.', 'level': 'Ext'},
    }
    return guides.get(topic_id)


def get_strategy_tip(problem_text: str) -> str:
    
    text_lower = problem_text.lower()
    tips = []

    if any(word in text_lower for word in ['derivative', 'differentiate', 'integral', 'integrate',
                                            'tangent', 'rate of change', 'optimization', 'stationary',
                                            'curve', 'gradient', 'limit']):
        tips.append('Try identifying the key function and applying the appropriate differentiation or integration rule.')

    if 'induction' in text_lower or 'inductive' in text_lower:
        tips.append('For induction: prove the base case (n=1), assume true for n=k, then prove for n=k+1.')

    if any(word in text_lower for word in ['complex', 'argand', 'de moivre', 'modulus', 'argument']):
        tips.append('Consider converting to polar/exponential form and using De Moivre\'s Theorem.')

    if any(word in text_lower for word in ['vector', 'dot product', 'scalar', 'projection', 'cross product']):
        tips.append('Break vectors into components and use dot product properties for perpendicularity.')

    if any(word in text_lower for word in ['probability', 'binomial', 'distribution', 'variance', 'expected']):
        tips.append('Identify the probability distribution type and apply its defining formula.')

    if any(word in text_lower for word in ['trig', 'sin', 'cos', 'tan', 'theta', 'angle']):
        tips.append('Use trigonometric identities (Pythagorean, double-angle, or compound-angle) to simplify.')

    if any(word in text_lower for word in ['log', 'ln', 'exponential', 'e^']):
        tips.append('Apply logarithm laws and remember that ln and e are inverse functions.')

    if any(word in text_lower for word in ['proof', 'prove', 'show that']):
        if 'induction' not in text_lower:
            tips.append('Consider which proof technique is appropriate: direct proof, contradiction, or induction.')

    if any(word in text_lower for word in ['graph', 'sketch', 'asymptote', 'intercept']):
        tips.append('Identify key features: intercepts, asymptotes, stationary points, and end behaviour.')

    if tips:
        return ' '.join(tips[:2])
    return 'Break the problem into smaller parts and apply the relevant formula from your syllabus.'


def build_fallback_marking_result(problem_description: str, text_answer: str | None = None, image_base64: str | None = None) -> dict:
    
    
    base_text = (text_answer or problem_description or '').strip()
    annotations = []
    total_possible = 0
    earned = 0.0
    
    method_keywords = {
        r'differentiate|derivative|dy/dx|f\x27': 'Differentiation method',
        r'integrate|integral|\u222b|antiderivative': 'Integration method',
        r'solve|find|determine|calculate': 'Solution strategy',
        r'prove|show that|hence': 'Proof structure',
        r'factor|expand|simplify': 'Algebraic manipulation',
        r'substitute|let|u =|t =': 'Substitution method',
        r'by parts|integration by parts': 'Integration by parts',
        r'chain rule|product rule|quotient rule': 'Differentiation rule selection',
        r'induction|base case|n=k': 'Proof by induction',
        r'de moivre|polar|modulus|argument': 'Complex number method',
    }
    
    method_found = False
    for pattern, step_name in method_keywords.items():
        if re.search(pattern, base_text, re.IGNORECASE):
            annotations.append({'step': step_name, 'status': 'correct', 
                              'detail': f'Appropriate {step_name.lower()} identified for this problem.'})
            total_possible += 1
            earned += 0.8
            method_found = True
            break
    
    if not method_found:
        annotations.append({'step': 'Method selection', 'status': 'error',
                          'detail': 'No clear method identified. State your approach explicitly before working.'})
        total_possible += 1
        earned += 0.2
    
    has_substitution = bool(re.search(r'(let|substitute|u\s*=|t\s*=)', base_text, re.IGNORECASE))
    has_algebra = bool(re.search(r'[=]', base_text)) and len(base_text.split()) > 5
    has_numbers = bool(re.search(r'\d', base_text))
    
    if has_substitution:
        annotations.append({'step': 'Substitution', 'status': 'correct',
                          'detail': 'Correctly set up the substitution to simplify the problem.'})
        total_possible += 1
        earned += 0.9
    elif has_algebra:
        annotations.append({'step': 'Working steps', 'status': 'correct',
                          'detail': 'Algebraic manipulation shows logical progression.'})
        total_possible += 1
        earned += 0.6
    else:
        annotations.append({'step': 'Working steps', 'status': 'error',
                          'detail': 'Working is incomplete or missing. Show each algebraic step clearly.'})
        total_possible += 1
        earned += 0.1
    
    has_calculus = bool(re.search(r'(d/d|differentiate|derivative|integrate|\u222b|lim)', base_text, re.IGNORECASE))
    has_trig = bool(re.search(r'(sin|cos|tan|theta|pi|\\pi)', base_text, re.IGNORECASE))
    has_log = bool(re.search(r'(ln|log|exp|e\^)', base_text, re.IGNORECASE))
    
    if has_calculus:
        has_dx = bool(re.search(r'dx|d\\theta|dt', base_text))
        has_plus_c = bool(re.search(r'\+\\s*[Cc]|\+\\s*const', base_text))
        
        if 'integrate' in base_text.lower() or '∫' in base_text or 'integral' in base_text.lower():
            if has_dx:
                annotations.append({'step': 'Integration notation', 'status': 'correct',
                                  'detail': 'Correctly includes the differential $dx$ in the integral.'})
                total_possible += 1
                earned += 0.9
            else:
                annotations.append({'step': 'Integration notation', 'status': 'error',
                                  'detail': 'Missing $dx$ in the indefinite integral. Always include the differential.'})
                total_possible += 1
                earned += 0.2
            
            if has_plus_c:
                annotations.append({'step': 'Constant of integration', 'status': 'correct',
                                  'detail': 'Correctly includes $+C$ for the indefinite integral.'})
                total_possible += 1
                earned += 0.9
            elif 'definite' not in base_text.lower():
                annotations.append({'step': 'Constant of integration', 'status': 'error',
                                  'detail': 'Missing $+C$ for the indefinite integral. Always add the constant of integration.'})
                total_possible += 1
                earned += 0.1
    
    if has_trig:
        has_identity = bool(re.search(r'(identity|sin\^2|cos\^2|tan\^2|csc|sec|cot|1\s*=\s*sin)', base_text, re.IGNORECASE))
        has_radians = bool(re.search(r'pi|\\pi|rad', base_text, re.IGNORECASE))
        if has_identity or has_radians:
            annotations.append({'step': 'Trigonometric manipulation', 'status': 'correct',
                              'detail': 'Uses trigonometric identities/formulae appropriately.'})
            total_possible += 1
            earned += 0.8
    
    if has_log:
        annotations.append({'step': 'Logarithm/Exponential handling', 'status': 'correct',
                          'detail': 'Applies log/exponential rules correctly.'})
        total_possible += 1
        earned += 0.7
    
    has_power_rule = bool(re.search(r'(x\^|\\cdot|power|chain)', base_text, re.IGNORECASE))
    has_product_rule = bool(re.search(r'(product|uv|f\s*g)', base_text, re.IGNORECASE))
    has_chain = bool(re.search(r'(chain|composite|u\s*=\s*x)', base_text, re.IGNORECASE))
    
    if has_power_rule or has_product_rule or has_chain:
        annotations.append({'step': 'Differentiation execution', 'status': 'correct',
                          'detail': 'Applies differentiation rules with correct algebraic manipulation.'})
        total_possible += 1
        earned += 0.8
    
    has_final = bool(re.search(r'(therefore|hence|so|thus|answer|final|\\therefore|=>|\u21d2)', base_text, re.IGNORECASE))
    has_result = bool(re.search(r'(=\s*[-\d]|x\s*=\s*[-\d]|y\s*=\s*[-\d])', base_text)) or has_numbers
    
    if has_final and has_result:
        annotations.append({'step': 'Final answer', 'status': 'correct',
                          'detail': 'Final answer is stated clearly with proper justification.'})
        total_possible += 2
        earned += 1.6
    elif has_result:
        annotations.append({'step': 'Final answer', 'status': 'error',
                          'detail': 'Answer present but no concluding statement. Use Therefore or Hence to justify.'})
        total_possible += 2
        earned += 0.6
    else:
        annotations.append({'step': 'Final answer', 'status': 'error',
                          'detail': 'No final answer stated. Complete the working and provide a boxed or stated result.'})
        total_possible += 2
        earned += 0.1
    
    if len(base_text.split()) > 15:
        annotations.append({'step': 'Presentation', 'status': 'correct',
                          'detail': 'Solution is well-structured with clear step-by-step reasoning.'})
        total_possible += 1
        earned += 0.8
    
    total_possible = max(5, total_possible)
    scaled_total = max(5, total_possible * 2)
    scaled_score = round((earned / max(1, total_possible)) * scaled_total, 1)
    scaled_score = max(1, min(scaled_total, scaled_score))
    
    pct = (scaled_score / scaled_total) * 100
    if pct >= 90:
        overall = 'Excellent — Band 6 quality. The solution demonstrates comprehensive understanding with clear logical progression, correct notation, and elegant mathematical reasoning throughout.'
    elif pct >= 80:
        overall = 'Very good — Band 5 quality. Sound reasoning with clear step-by-step working. Minor improvements to notation or justification would lift this to Band 6.'
    elif pct >= 70:
        overall = 'Good — Band 4 quality. Adequate understanding shown but working could be more rigorous. Review the flagged steps and ensure all reasoning is explicitly stated.'
    elif pct >= 50:
        overall = 'Developing — Band 3 level. Partial understanding demonstrated. Focus on the flagged areas and practise similar problems to build confidence with the method.'
    elif pct >= 25:
        overall = 'Needs work — Band 2 level. Limited correct reasoning shown. Review the core concepts for this topic and attempt simpler problems before returning to this difficulty.'
    else:
        overall = 'Significant gaps — Band 1 level. Very little correct mathematical reasoning detected. Seek help from your teacher or tutor on the fundamental concepts for this topic.'
    
    return {
        'score': scaled_score,
        'totalMarks': scaled_total,
        'overall': overall,
        'annotations': annotations,
    }


@hints_bp.route('/generate-hint', methods=['POST'])
def generate_hint():
    
    data = request.get_json()
    if not data or 'problemDescription' not in data:
        return jsonify({'error': 'Missing problemDescription'}), 400

    problem_text = data['problemDescription']
    topic_id = data.get('topicId', '')
    hint_level = data.get('hintLevel', 'ai')  

    if hint_level == 'concept':
        guide = get_topic_guide(topic_id) if topic_id else None
        if guide:
            return jsonify({'hint': guide['desc'], 'level': 'concept'}), 200
        return jsonify({'hint': 'This problem relates to a core topic in the NSW Mathematics syllabus. Review the relevant dot point.', 'level': 'concept'}), 200

    if hint_level == 'strategy':
        tip = get_strategy_tip(problem_text)
        return jsonify({'hint': tip, 'level': 'strategy'}), 200

    hint_text = None
    gemini_key = current_app.config.get('GEMINI_API_KEY')
    if gemini_key:
        try:
            client = genai.Client(api_key=gemini_key)
            prompt = (
                "You are an expert high-school mathematics tutor for the Sydney/NSW curriculum. "
                "Provide a single, clear, constructive mathematical hint for this problem:\n\n"
                f'"{problem_text}"\n\n'
                "Use standard LaTeX notation (enclosed in $ for inline, $$ for block) so mathematical "
                "symbols render beautifully on screen. Keep your hint concise (maximum 2-3 sentences). "
                "Do NOT give away the full answer — guide the student toward the solution."
            )
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
            )
            hint_text = response.text.strip() if response.text else None
        except Exception as e:
            current_app.logger.error(f"Gemini hint error: {e}")

    if not hint_text:
        hint_text = get_strategy_tip(problem_text)

    user_id = None
    try:
        from flask import g
        user_id = g.current_user.id
    except (AttributeError, RuntimeError):
        pass

    hint_log = HintLog(
        user_id=user_id,
        problem_text=problem_text,
        hint_type='ai',
        hint_content=hint_text
    )
    db.session.add(hint_log)
    db.session.commit()

    return jsonify({'hint': hint_text, 'level': 'ai'}), 200


@hints_bp.route('/transcribe-and-mark', methods=['POST'])
def transcribe_and_mark():
    data = request.get_json()
    if not data or 'problemDescription' not in data:
        return jsonify({'error': 'Missing problemDescription'}), 400

    problem_text = data['problemDescription']
    image_b64 = data.get('imageBase64', '')
    text_answer = data.get('textAnswer', '')

    student_work = text_answer if text_answer.strip() else ''
    gemini_result = _call_gemini_mark(problem_text, student_work, image_b64)

    if gemini_result:
        total = gemini_result.get('total_possible_marks', 5)
        score = gemini_result.get('score_awarded', 0)
        return jsonify({
            'score': score,
            'totalMarks': total,
            'overall': gemini_result.get('constructive_feedback', 'Solution reviewed.'),
            'annotations': [
                {'step': gemini_result.get('step_by_step_analysis', 'Analysis unavailable.'), 'status': 'correct' if gemini_result.get('is_correct', False) else 'error', 'detail': '; '.join(gemini_result.get('identified_errors', [])) or 'No errors identified.'}
            ],
            'ai': True,
        }), 200

    return jsonify({
        'score': 0, 'totalMarks': 5,
        'overall': 'AI marking unavailable. Check GEMINI_API_KEY in backend/.env and ensure the key is valid.',
        'annotations': [
            {'step': 'Marking unavailable', 'status': 'error', 'detail': 'Gemini 2.5 Pro could not process this submission. Verify your API key or try typing your solution.'},
        ],
        'ai': False,
    }), 200


@hints_bp.route('/analyze-set', methods=['POST'])
@token_required
def analyze_uploaded_set():
    
    from flask import g

    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({'error': 'Missing filename'}), 400

    filename = data['filename']
    preview = data.get('preview', '')
    api_key = current_app.config.get('GEMINI_API_KEY', '')

    if not api_key:
        return jsonify(_heuristic_set_analysis(filename, preview)), 200

    from routes.recommendations import TOPIC_META, TOPIC_NAMES as TN
    topic_descriptions = '\n'.join([
        f"  {tid}: {TN.get(tid, tid)} (course={TOPIC_META[tid].get('course','adv')}, difficulty={TOPIC_META[tid].get('difficulty',3.0)})"
        for tid in sorted(TOPIC_META.keys())
    ])

    prompt = f"""You are an expert NSW HSC Mathematics assessor.

Analyze this uploaded worksheet/set:

FILENAME: {filename}
PREVIEW CONTENT: {preview[:2000]}

Available NSW HSC syllabus topics:
{topic_descriptions}

Return a JSON assessment with:
  - difficulty: number 1-5
  - estimated_topic_ids: array of topic IDs covered (from the list above)
  - question_count_estimate: number
  - summary: one-sentence description
  - hsc_relevance: "HIGH", "MEDIUM", or "LOW"
  - course: "adv", "mx1", or "mx2"

Output ONLY valid JSON."""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[genai_types.Part.from_text(text=prompt)],
            config=genai_types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=512,
                response_mime_type="application/json",
                system_instruction="You are an expert NSW HSC Mathematics assessor. Output valid JSON only.",
            ),
        )
        result_text = response.text
        if result_text:
            result_text = re.sub(r'^```(?:json)?\s*\n?', '', result_text)
            result_text = re.sub(r'\n?```\s*$', '', result_text)
            parsed = json_lib.loads(result_text)
            parsed['analyzed_by'] = 'gemini'
            return jsonify(parsed), 200
    except Exception as e:
        current_app.logger.warning(f'Gemini set analysis failed: {e}')

    return jsonify(_heuristic_set_analysis(filename, preview)), 200


TOPIC_NAMES_FOR_ANALYSIS = {
    'ma-f1': 'Functions', 'ma-t1': 'Trigonometric Functions', 'ma-c1': 'Calculus',
    'ma-c234': 'Advanced Calculus', 'ma-s1': 'Statistical Analysis', 'ma-s23': 'Statistics',
    'me-c1': 'Related Rates', 'me-p1': 'Proof by Induction', 'mex-c1': 'Integration Techniques',
}


def _heuristic_set_analysis(filename: str, preview: str) -> dict:
    
    import re
    text = (filename + ' ' + preview).lower()

    diff = 3.0
    if any(w in text for w in ['extension 2', 'mx2', 'complex', 'mechanics', 'proof', 'resisted']):
        diff = 4.5
    elif any(w in text for w in ['extension 1', 'mx1', 'induction', 'binomial', 'projectile']):
        diff = 3.5
    elif any(w in text for w in ['advanced', 'calculus', 'trig']):
        diff = 3.0

    topic_hints = []
    for tid, name in TOPIC_NAMES_FOR_ANALYSIS.items():
        key = name.lower().split()[0]
        if key in text or tid in text:
            topic_hints.append(tid)

    q_count = 5
    num_match = re.search(r'(\d+)\s*(?:q|questions|problems)', text)
    if num_match:
        q_count = int(num_match.group(1))

    return {
        'difficulty': diff,
        'estimated_topic_ids': topic_hints[:4] if topic_hints else ['ma-c234'],
        'question_count_estimate': q_count,
        'summary': f'Worksheet covering {", ".join(topic_hints[:2]) or "general mathematics"}',
        'hsc_relevance': 'HIGH' if diff >= 3.5 else 'MEDIUM',
        'course': 'mx2' if diff >= 4.0 else 'mx1' if diff >= 3.5 else 'adv',
        'analyzed_by': 'heuristic',
    }

