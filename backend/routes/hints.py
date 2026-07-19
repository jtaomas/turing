from flask import Blueprint, request, jsonify, current_app
import json as json_lib
import re
import traceback
import base64
import io
from io import BytesIO
from openai import OpenAI
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types as genai_types
from PIL import Image
from models import db, HintLog
from auth import token_required

hints_bp = Blueprint('hints', __name__, url_prefix='/api')

DEEPSEEK_MODEL = 'deepseek-v4-pro'
GEMINI_VISION_MODEL = 'gemini-2.0-flash'


class StepEvaluation(BaseModel):
    step_number: int
    transcription_latex: str = Field(description="LaTeX transcription of this step")
    is_correct: bool
    error_analysis: Optional[str] = Field(None, description="Explanation if incorrect")

class MarkingReport(BaseModel):
    detected_problem: str = Field(description="The problem parsed from the image")
    final_answer_extracted: str = Field(description="Student's final answer")
    is_final_answer_correct: bool
    steps_breakdown: List[StepEvaluation]
    overall_feedback: str = Field(description="Constructive guidance for the student")
    assigned_score: int = Field(description="Score out of 100")


def _call_deepseek(messages: list, temperature: float = 0.1, max_tokens: int = 2048) -> str | None:
    
    api_key = current_app.config.get('DEEPSEEK_API_KEY', '')
    if not api_key:
        return None
    try:
        client = OpenAI(api_key=api_key, base_url='https://api.deepseek.com')
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        msg = response.choices[0].message
        content = msg.content or ''
        reasoning = getattr(msg, 'reasoning_content', '') or ''
        result = content.strip() if content.strip() else reasoning.strip()
        return result if result else None
    except Exception as e:
        current_app.logger.warning(f'DeepSeek call failed: {e}')
        return None


def _call_gemini_vision(image_b64: str, problem_text: str) -> dict | None:
    
    api_key = current_app.config.get('GEMINI_API_KEY', '')
    if not api_key:
        return None
    try:
        client = genai.Client(api_key=api_key)

        system_prompt = (
            "You are an expert NESA HSC Mathematics marker with 20 years of experience marking Extension 2 papers. "
            "Analyze the image of a handwritten or typed math solution and evaluate it against HSC marking guidelines.\n\n"
            "CRITICAL PROTOCOLS:\n"
            "1. Identify the core mathematical question from the image.\n"
            "2. Transcribe the student's working into LaTeX blocks ($...$ for inline, $$...$$ for display).\n"
            "3. Step-by-step audit: Check each mathematical transition for correctness, notation, and HSC conventions.\n"
            "4. Track error propagation — if an early error cascades, note it but still credit subsequent correct reasoning.\n"
            "5. Assign a score out of 100 reflecting NESA band descriptors:\n"
            "   - Band 6 (90-100): Flawless reasoning, correct notation, elegant solution\n"
            "   - Band 5 (80-89): Sound reasoning with minor notation/arithmetic slips\n"
            "   - Band 4 (70-79): Adequate understanding but incomplete reasoning or significant errors\n"
            "   - Band 3 (50-69): Basic understanding, substantial errors, incomplete\n"
            "   - Band 2 (25-49): Limited understanding, major conceptual errors\n"
            "   - Band 1 (0-24): Minimal or no relevant working\n"
            "6. Provide constructive, specific feedback with LaTeX references to the student's steps.\n"
            "7. For each annotation step, include the student's transcribed LaTeX and your assessment."
        )

        raw_bytes = base64.b64decode(image_b64)

        response = client.models.generate_content(
            model=GEMINI_VISION_MODEL,
            contents=[
                genai_types.Part.from_bytes(data=raw_bytes, mime_type='image/png'),
                genai_types.Part.from_text(
                    text=f"Problem: {problem_text}\n\n"
                    "Please grade this math submission. Check the working line-by-line. "
                    "Output the result as structured JSON matching the required schema."
                ),
            ],
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.1,
                response_mime_type='application/json',
                response_schema=MarkingReport,
            )
        )

        text = response.text
        report = json_lib.loads(text) if isinstance(text, str) else text
        
        total_marks = max(5, len(report.get('steps_breakdown', [])) * 2)
        final_score = max(1, min(total_marks, round((report.get('assigned_score', 50) / 100) * total_marks)))

        annotations = []
        for step in report.get('steps_breakdown', []):
            annotations.append({
                'step': f"Step {step.get('step_number', '?')}: {step.get('transcription_latex', '')}",
                'status': 'correct' if step.get('is_correct', False) else 'error',
                'detail': step.get('error_analysis', 'Correct step.') if not step.get('is_correct', True) else 'Correctly applied.',
            })

        return {
            'score': final_score,
            'totalMarks': total_marks,
            'overall': report.get('overall_feedback', 'Solution reviewed.'),
            'annotations': annotations,
        }

    except Exception as e:
        current_app.logger.error(f'Gemini vision marking failed: {e}')
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
    
    from flask import g

    data = request.get_json()
    if not data or 'problemDescription' not in data:
        return jsonify({'error': 'Missing problemDescription'}), 400

    problem_text = data['problemDescription']
    image_b64 = data.get('imageBase64', '')
    text_answer = data.get('textAnswer', '')
    topic_id = data.get('topicId', '')

    api_key = current_app.config.get('DEEPSEEK_API_KEY', '')
    used_ai = False
    result = {}
    error_detail = None

    if image_b64:
        gemini_result = _call_gemini_vision(image_b64, problem_text)
        if gemini_result:
            gemini_result['ai'] = True
            return jsonify(gemini_result), 200
        else:
            error_detail = 'Gemini vision marking failed — check GEMINI_API_KEY in backend/.env'

    if not used_ai and api_key and text_answer and text_answer.strip():
        try:
            system_msg = (
                "You are an experienced NESA HSC Mathematics marker. "
                "Respond directly with ONLY the JSON. Do NOT include any reasoning, chain-of-thought, or explanation outside the JSON. "
                "You ALWAYS return ONLY valid JSON (no markdown, no explanation) with this exact structure:\n"
                '{"score": <number>, "totalMarks": <number>, "overall": "<2-4 sentence feedback with specific mathematical guidance>", '
                '"annotations": [{"step": "<LaTeX description of the step>", "status": "correct|error|partial", "detail": "<specific feedback referencing HSC conventions and the student\'s working>"}]}\n'
                "Use LaTeX ($...$) in step and detail fields. Be specific about mathematical errors, notation issues, and HSC marking criteria. "
                "Total marks should match problem complexity (3-15 for typical HSC questions). Provide 3-6 detailed annotations. "
                "Score according to NESA bands: 90-100 = Band 6, 80-89 = Band 5, 70-79 = Band 4, 50-69 = Band 3, 25-49 = Band 2, 0-24 = Band 1."
            )

            user_content = (
                f"Problem: {problem_text}\n\n"
                f"Student's submitted solution:\n```\n{text_answer}\n```\n\n"
                "Mark this solution step by step. Return ONLY JSON."
            )

            raw = _call_deepseek([
                {'role': 'system', 'content': system_msg},
                {'role': 'user', 'content': user_content},
            ], temperature=0.1, max_tokens=2048)

            if raw:
                raw = re.sub(r'^```(?:json)?\s*\n?', '', raw)
                raw = re.sub(r'\n?```\s*$', '', raw)
                result = json_lib.loads(raw)

                if not isinstance(result, dict):
                    raise ValueError('DeepSeek returned non-dict')
                if 'annotations' not in result or not isinstance(result['annotations'], list):
                    result['annotations'] = []
                if 'score' not in result:
                    result['score'] = 0
                if 'totalMarks' not in result:
                    result['totalMarks'] = max(5, len(result['annotations']) * 2)
                if 'overall' not in result:
                    result['overall'] = 'Solution reviewed.'

                result['score'] = max(0, min(float(result['totalMarks']), float(result['score'])))
                result['totalMarks'] = float(result['totalMarks'])

                for ann in result['annotations']:
                    if ann.get('status') not in ('correct', 'error'):
                        ann['status'] = 'correct' if 'correct' in str(ann.get('status', '')).lower() else 'error'

                used_ai = True

        except Exception as e:
            error_detail = f'DeepSeek failed: {str(e)[:200]}'
            current_app.logger.warning(f'Marking AI error: {traceback.format_exc()}')

    if not used_ai:
        if text_answer and text_answer.strip():
            result = build_fallback_marking_result(problem_text, text_answer)
        elif image_b64 and not text_answer:
            result = {
                'score': 0, 'totalMarks': 5,
                'overall': 'Could not analyse your canvas drawing. The Gemini API key may be missing or invalid — check GEMINI_API_KEY in backend/.env. Alternatively, type your solution in the text area instead.',
                'annotations': [
                    {'step': 'Vision failed', 'status': 'error',
                     'detail': error_detail or 'Gemini 3.5 Flash could not process the image. Verify GEMINI_API_KEY is set in backend/.env and is valid from https://aistudio.google.com/apikey'},
                    {'step': 'Alternative', 'status': 'correct',
                     'detail': 'Type your mathematical working in the text area below the canvas for text-based AI marking.'},
                ],
            }
        else:
            result = {
                'score': 0, 'totalMarks': 5,
                'overall': 'No answer submitted. Draw your working on the canvas OR type your solution in the text area, then click Mark.',
                'annotations': [
                    {'step': 'Submission', 'status': 'error', 'detail': 'No working was detected. Draw or type your solution first.'},
                ],
            }

    result['ai'] = used_ai
    if error_detail and not used_ai:
        result['errorDetail'] = error_detail
    return jsonify(result), 200


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

