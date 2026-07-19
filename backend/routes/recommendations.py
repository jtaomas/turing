import datetime
import json
import math
from flask import Blueprint, request, jsonify, g, current_app
from pydantic import BaseModel, Field
from google import genai
from google.genai import types as genai_types

from models import (
    db, UserTopicMastery, RecommendationCache,
    ProblemAttempt, Question,
)
from auth import token_required

rec_bp = Blueprint('recommendations', __name__, url_prefix='/api/recommendations')

GEMINI_MODEL = 'gemini-3.5-flash'

TOPIC_META = {
    'ma-f1':  {'exam_weight': 8,  'difficulty': 2.5, 'course': 'adv', 'year': 11, 'prereq_of': ['ma-f2', 'ma-c234']},
    'ma-t1':  {'exam_weight': 7,  'difficulty': 3.0, 'course': 'adv', 'year': 11, 'prereq_of': ['ma-t2', 'me-t12']},
    'ma-c1':  {'exam_weight': 6,  'difficulty': 3.0, 'course': 'adv', 'year': 11, 'prereq_of': ['ma-c234', 'me-c1']},
    'ma-e1':  {'exam_weight': 5,  'difficulty': 2.5, 'course': 'adv', 'year': 11, 'prereq_of': ['ma-c234']},
    'ma-s1':  {'exam_weight': 6,  'difficulty': 2.0, 'course': 'adv', 'year': 11, 'prereq_of': ['ma-s23']},
    'ma-f2':  {'exam_weight': 7,  'difficulty': 3.0, 'course': 'adv', 'year': 12, 'prereq_of': []},
    'ma-t2':  {'exam_weight': 6,  'difficulty': 3.5, 'course': 'adv', 'year': 12, 'prereq_of': []},
    'ma-c234':{'exam_weight': 10, 'difficulty': 4.0, 'course': 'adv', 'year': 12, 'prereq_of': []},
    'ma-m1':  {'exam_weight': 5,  'difficulty': 2.5, 'course': 'adv', 'year': 12, 'prereq_of': []},
    'ma-s23': {'exam_weight': 8,  'difficulty': 3.0, 'course': 'adv', 'year': 12, 'prereq_of': []},
    'me-f1':  {'exam_weight': 7,  'difficulty': 3.5, 'course': 'mx1', 'year': 11, 'prereq_of': ['me-c1', 'me-c23']},
    'me-t12': {'exam_weight': 8,  'difficulty': 3.5, 'course': 'mx1', 'year': 11, 'prereq_of': ['me-t3', 'mex-n12']},
    'me-c1':  {'exam_weight': 9,  'difficulty': 4.0, 'course': 'mx1', 'year': 11, 'prereq_of': ['me-c23']},
    'me-a1':  {'exam_weight': 6,  'difficulty': 3.0, 'course': 'mx1', 'year': 11, 'prereq_of': ['me-s1']},
    'me-p1':  {'exam_weight': 7,  'difficulty': 4.0, 'course': 'mx1', 'year': 12, 'prereq_of': ['mex-p12']},
    'me-v1':  {'exam_weight': 7,  'difficulty': 3.0, 'course': 'mx1', 'year': 12, 'prereq_of': ['mex-v1']},
    'me-t3':  {'exam_weight': 6,  'difficulty': 4.0, 'course': 'mx1', 'year': 12, 'prereq_of': ['mex-n12']},
    'me-c23': {'exam_weight': 8,  'difficulty': 4.5, 'course': 'mx1', 'year': 12, 'prereq_of': ['mex-c1', 'mex-m1']},
    'me-s1':  {'exam_weight': 6,  'difficulty': 3.0, 'course': 'mx1', 'year': 12, 'prereq_of': []},
    'mex-p12':{'exam_weight': 9,  'difficulty': 4.5, 'course': 'mx2', 'year': 12, 'prereq_of': []},
    'mex-v1': {'exam_weight': 8,  'difficulty': 4.0, 'course': 'mx2', 'year': 12, 'prereq_of': []},
    'mex-n12':{'exam_weight': 10, 'difficulty': 4.5, 'course': 'mx2', 'year': 12, 'prereq_of': []},
    'mex-c1': {'exam_weight': 10, 'difficulty': 5.0, 'course': 'mx2', 'year': 12, 'prereq_of': []},
    'mex-m1': {'exam_weight': 9,  'difficulty': 4.5, 'course': 'mx2', 'year': 12, 'prereq_of': []},
}

ALL_TOPICS = sorted(TOPIC_META.keys())

TOPIC_NAMES = {
    'ma-f1': 'Working with Functions',
    'ma-t1': 'Trigonometry & Measure of Angles',
    'ma-c1': 'Introduction to Differentiation',
    'ma-e1': 'Exponential & Logarithmic Functions',
    'ma-s1': 'Probability & Data',
    'ma-f2': 'Graph Transformations & Modelling',
    'ma-t2': 'Trigonometric Identities & Equations',
    'ma-c234': 'Calculus (Diff, Integ, Apps)',
    'ma-m1': 'Sequences, Series & Financial Maths',
    'ma-s23': 'Random Variables & Normal Distribution',
    'me-f1': 'Further Functions & Polynomials',
    'me-t12': 'Further Trigonometry (Compound Angles, t-Formulae)',
    'me-c1': 'Rates of Change & Implicit Differentiation',
    'me-a1': 'Permutations, Combinations & Binomial Theorem',
    'me-p1': 'Proof by Mathematical Induction',
    'me-v1': 'Vectors & Projectile Motion',
    'me-t3': 'Inverse Trigonometric Functions',
    'me-c23': 'Further Calculus & Differential Equations',
    'me-s1': 'The Binomial Distribution',
    'mex-p12': 'Proof, Inequalities & Induction',
    'mex-v1': '3D Vectors, Lines & Planes',
    'mex-n12': 'Complex Numbers & De Moivre',
    'mex-c1': 'Integration by Parts, Partial Fractions & Reduction',
    'mex-m1': 'Mechanics (Resisted Motion, SHM)',
}

TOPIC_DOT_POINTS = {
    'ma-f1': ['Algebraic techniques', 'Functions & relations', 'Linear/quadratic/cubic functions',
              'Reciprocal functions', 'Circles & semicircles', 'Piecewise & absolute value functions'],
    'ma-t1': ['Trig with acute angles', 'Angles of any magnitude', 'Radian measure',
              'Arc length & sector area', 'Graphs of sin/cos/tan'],
    'ma-c1': ['Average rate of change', 'The derivative from first principles',
              'Differentiation rules (product, quotient, chain)', 'Graphical applications', 'Velocity & acceleration'],
    'ma-e1': ['Exponential functions & Euler\'s number e', 'Logarithmic functions & laws',
              'Natural logarithm ln', 'Change of base rule'],
    'ma-s1': ['Sets & Venn diagrams', 'Probability rules', 'Conditional probability & independence',
              'Discrete random variables', 'Data organisation & histograms'],
    'ma-f2': ['Transformations of trig functions', 'Modelling with periodic functions',
              'Logarithmic scales (dB, pH, Richter)'],
    'ma-t2': ['Secant, cosecant, cotangent', 'Pythagorean identities', 'Trigonometric equations',
              'Complementary angle identities'],
    'ma-c234': ['Derivatives of exp/log/trig functions', 'Primitives & indefinite integrals',
                'Definite integrals & FTC', 'Areas between curves', 'Trapezoidal rule',
                'Turning points & inflection', 'Optimisation', 'Exponential growth & decay'],
    'ma-m1': ['Arithmetic sequences & series', 'Geometric sequences & series',
              'Limiting sum of GP', 'Reducing balance loans', 'Annuities & future value'],
    'ma-s23': ['Discrete probability distributions', 'Expected value & variance',
               'Continuous random variables & PDFs', 'Normal distribution & z-scores', 'Empirical rule'],
    'me-f1': ['Graphical relationships (1/f, |f|, f(|x|))', 'Inverse functions', 'Parametric equations',
              'Polynomials & factor/remainder theorems', 'Sums & products of zeroes'],
    'me-t12': ['3D trigonometry', 'Compound & double angle formulas', 'Sum & difference expansions',
               't-Formulae', 'Trig equations in auxiliary form Rsin(x+α)'],
    'me-c1': ['Permutations (nPr)', 'Combinations (nCr)', 'Pascal\'s triangle',
              'Binomial theorem & expansions', 'Binomial coefficient identities'],
    'me-a1': ['Mathematical induction for sums', 'Induction for divisibility',
              'Identifying errors in false proofs'],
    'me-p1': ['Vector representation (2D & 3D)', 'Vector operations & scalar product',
              'Vector projections', 'Motion in vector form', 'Projectile motion'],
    'me-v1': ['Inverse sin/cos/tan functions', 'Derivatives of inverse trig', 'Parametric differentiation',
              'Integration by substitution', 'sin² & cos² integrals', 'Integrals of 1/√(a²-x²)'],
    'me-t3': ['Multiplicity of polynomial zeroes', 'Related rates of change',
              'Areas between curves', 'Volumes of solids of revolution about x/y axes'],
    'me-c23': ['First order differential equations', 'Separation of variables', 'Slope fields',
               'Exponential growth/decay ODEs', 'Logistic equation'],
    'me-s1': ['Bernoulli distributions', 'Binomial distributions B(n,p)',
              'Sampling distribution of the mean', 'Central Limit Theorem'],
    'mex-p12': ['Language & notation of proof', 'Proof by contradiction', 'Inequalities (AM-GM, triangle, squeeze)',
                'Further mathematical induction (trig, calculus, recurrences)'],
    'mex-v1': ['Vector equations of lines (2D & 3D)', 'Skew lines', 'Parametric curves as vectors',
               'Circles & spheres in vector form', 'Cauchy-Schwarz inequality', 'Geometric proofs with vectors'],
    'mex-n12': ['Arithmetic of complex numbers', 'Modulus, argument & polar form',
                'De Moivre\'s theorem', 'nth roots of unity', 'Complex conjugate root theorem',
                'Loci & regions on Argand diagram', 'Geometric proofs using complex vectors'],
    'mex-c1': ['Trig products as sums/differences', 't-Formulas for integration',
               'Integration by substitution', 'Partial fractions decomposition',
               'Integration by parts', 'Recurrence relations'],
    'mex-m1': ['Newton\'s laws & force=mẍ', 'Simple harmonic motion (SHM)',
               'Modelling motion without resistance', 'Rectilinear resisted motion',
               'Vertical resisted motion & terminal velocity', 'Projectiles with resistance'],
}

class TopicRecommendation(BaseModel):
    topic_id: str
    topic_name: str = ""
    yield_score: float = Field(ge=0, le=100)
    mastery_pct: float = Field(ge=0, le=100)
    reasoning: str = Field(description="One-sentence explanation")
    priority: str = Field(description="HIGH, MEDIUM, or LOW")

class RecommendationResponse(BaseModel):
    recommendations: list[TopicRecommendation]
    summary: str = Field(description="Overall study strategy summary")

def _get_or_create_mastery(user_id: int, topic_id: str) -> UserTopicMastery:
    mastery = UserTopicMastery.query.filter_by(
        user_id=user_id, topic_id=topic_id
    ).first()
    if not mastery:
        mastery = UserTopicMastery(
            user_id=user_id, topic_id=topic_id,
            mastery_pct=0.0, confidence=0.0,
        )
        db.session.add(mastery)
        db.session.flush()
    return mastery

def _update_mastery_ema(user_id: int, topic_id: str, score: float, total_marks: float = 5.0):
    """Update topic mastery using Exponential Moving Average."""
    mastery = _get_or_create_mastery(user_id, topic_id)
    score_pct = (score / total_marks) * 100 if total_marks > 0 else 0

    if mastery.attempts_count == 0:
        mastery.mastery_pct = score_pct
        mastery.confidence = 0.3
    else:
        alpha = 1.0 / (1.0 + math.sqrt(mastery.attempts_count))
        mastery.mastery_pct = alpha * score_pct + (1 - alpha) * mastery.mastery_pct
        mastery.confidence = min(0.95, mastery.confidence + 0.05)

    mastery.attempts_count += 1
    mastery.avg_score = (
        (mastery.avg_score * (mastery.attempts_count - 1) + score)
        / mastery.attempts_count
    )
    mastery.last_attempt_at = datetime.datetime.utcnow()
    mastery.updated_at = datetime.datetime.utcnow()
    db.session.commit()

def _heuristic_yield(topic_id: str, mastery_pct: float, days_since_last: float,
                     attempts_count: int, avg_score: float) -> float:
    """Heuristic yield: exam_weight * mastery_gap * recency_boost. Returns 0-100."""
    meta = TOPIC_META.get(topic_id, {})
    exam_weight = meta.get('exam_weight', 5)
    base = exam_weight / 10.0
    gap = max(0.05, 1.0 - mastery_pct / 100.0)
    recency = 1.0 + 0.3 * min(days_since_last or 7, 30) / 30.0
    if attempts_count >= 3 and avg_score >= 4.0:
        recency *= 0.85
    yield_raw = base * gap * recency * 100
    return round(min(100, max(5, yield_raw)), 1)

def _compute_all_heuristic_yields(user_id: int, course_filter: str = None) -> list[dict]:
    """Compute heuristic yield scores for all topics for a given user."""
    now = datetime.datetime.utcnow()
    masteries = {
        m.topic_id: m
        for m in UserTopicMastery.query.filter_by(user_id=user_id).all()
    }
    results = []
    for tid in ALL_TOPICS:
        meta = TOPIC_META.get(tid, {})
        if course_filter and meta.get('course') != course_filter:
            continue
        m = masteries.get(tid)
        mastery_pct = m.mastery_pct if m else 0.0
        attempts = m.attempts_count if m else 0
        avg_score = m.avg_score if m else 0.0
        days_since = 30.0
        if m and m.last_attempt_at:
            delta = now - m.last_attempt_at
            days_since = delta.total_seconds() / 86400.0
        yield_score = _heuristic_yield(tid, mastery_pct, days_since, attempts, avg_score)
        results.append({
            'topic_id': tid,
            'topic_name': TOPIC_NAMES.get(tid, tid),
            'yield_score': yield_score,
            'mastery_pct': round(mastery_pct, 1),
            'exam_weight': meta.get('exam_weight', 5),
            'difficulty': meta.get('difficulty', 3.0),
            'course': meta.get('course', 'adv'),
            'attempts': attempts,
            'model': 'heuristic-v1',
        })
    results.sort(key=lambda x: x['yield_score'], reverse=True)
    return results

def _get_cached_recommendations(user_id: int) -> list | None:
    cache = RecommendationCache.query.filter(
        RecommendationCache.user_id == user_id,
        RecommendationCache.expires_at > datetime.datetime.utcnow(),
    ).order_by(RecommendationCache.generated_at.desc()).first()
    if cache:
        try:
            return json.loads(cache.recommendations_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return None

def _cache_recommendations(user_id: int, recommendations: list, ttl_minutes: int = 30):
    RecommendationCache.query.filter_by(user_id=user_id).delete()
    cache = RecommendationCache(
        user_id=user_id,
        recommendations_json=json.dumps(recommendations),
        model_version='rec-v2',
        generated_at=datetime.datetime.utcnow(),
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=ttl_minutes),
    )
    db.session.add(cache)
    db.session.commit()

def _call_engine_recommender(user_id: int, user_attempts: list,
                              masteries: dict, top_k: int = 8,
                              course_filter: str = None) -> dict | None:
    """Use analysis engine to generate intelligent, explainable recommendations."""
    api_key = current_app.config.get('GEMINI_API_KEY', '')
    if not api_key:
        return None

    now = datetime.datetime.utcnow()
    topic_lines = []
    candidate_topics = list(ALL_TOPICS)
    if course_filter:
        candidate_topics = [t for t in candidate_topics
                           if TOPIC_META.get(t, {}).get('course') == course_filter]

    for tid in candidate_topics:
        meta = TOPIC_META.get(tid, {})
        m = masteries.get(tid)
        name = TOPIC_NAMES.get(tid, tid)
        mastery_pct = m.mastery_pct if m else 0.0
        attempts = m.attempts_count if m else 0
        avg_s = m.avg_score if m else 0.0
        days_since = "never"
        if m and m.last_attempt_at:
            delta = now - m.last_attempt_at
            days_since = f"{delta.total_seconds() / 86400:.0f}d ago"
        prereq_for = ', '.join(meta.get('prereq_of', [])) or 'none'
        topic_lines.append(
            f"  {tid} | {name} | mastery={mastery_pct:.0f}% | attempts={attempts} | "
            f"avg_score={avg_s:.1f}/5 | last={days_since} | "
            f"exam_weight={meta.get('exam_weight',5)}% | difficulty={meta.get('difficulty',3.0)}/5 | "
            f"prereq_for=[{prereq_for}]"
        )

    recent_lines = []
    for a in sorted(user_attempts, key=lambda x: x.created_at or '', reverse=True)[:10]:
        recent_lines.append(
            f"  [{a.topic_id}] score={a.score}/{a.total_marks} "
            f"| {a.created_at.strftime('%d/%m') if a.created_at else 'unknown'}"
        )

    prompt = f"""You are an expert NSW HSC Mathematics tutor and study strategist.

A student needs personalised topic recommendations. Below is their complete profile.

RECENT ATTEMPTS (last 10):
{chr(10).join(recent_lines) if recent_lines else '  (none yet)'}

FULL TOPIC BREAKDOWN:
{chr(10).join(topic_lines)}

YOUR TASK:
1. Analyze this student's strengths, weaknesses, and practice recency.
2. Consider the NSW HSC Mathematics curriculum: topic prerequisites, exam weightings,
   and which topics build on others.
3. Recommend the top {top_k} topics this student should practice RIGHT NOW.
4. For each recommendation, provide:
   - yield_score (0-100): how valuable practicing this topic is now
   - mastery_pct: current estimated mastery
   - reasoning: ONE sentence explaining WHY this topic is recommended
   - priority: HIGH (urgent gap in fundamentals), MEDIUM (significant yield), or LOW

STRATEGY PRINCIPLES:
- Topics with high exam weight AND low mastery get highest yield
- If a student is weak on a topic that is a PREREQUISITE for other topics, boost its yield
- Topics not practiced in 7+ days get a recency boost
- Don't recommend already-mastered topics (mastery > 85%) unless critical prerequisites

Output as structured JSON matching the exact schema."""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[genai_types.Part.from_text(text=prompt)],
            config=genai_types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2048,
                response_mime_type="application/json",
                response_schema=RecommendationResponse,
                system_instruction=(
                    "You are an expert NSW HSC Mathematics tutor. "
                    "Analyze the student's topic mastery data and produce personalised, "
                    "explainable recommendations. Consider topic prerequisites, exam weightings, "
                    "mastery gaps, and recency of practice. Output valid JSON only."
                ),
            ),
        )
        result_text = response.text
        if not result_text:
            return None
        return json.loads(result_text)
    except Exception as e:
        current_app.logger.warning(f'Engine recommender failed: {e}')
        return None

@rec_bp.route('/neural', methods=['GET'])
@token_required
def neural_recommendations():
    """Get personalised recommendations for the current user."""
    user = g.current_user
    top_k = request.args.get('top_k', 8, type=int)
    course = request.args.get('course', None, type=str)
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    top_k = min(24, max(1, top_k))

    if not refresh:
        cached = _get_cached_recommendations(user.id)
        if cached:
            if course:
                cached = [r for r in cached if r.get('course') == course]
            return jsonify({
                'recommendations': cached[:top_k],
                'model': 'rec-v2',
                'source': 'cache',
            })

    attempts = ProblemAttempt.query.filter_by(user_id=user.id).all()
    masteries = {
        m.topic_id: m
        for m in UserTopicMastery.query.filter_by(user_id=user.id).all()
    }

    engine_result = _call_engine_recommender(user.id, attempts, masteries, top_k, course)

    if engine_result and engine_result.get('recommendations'):
        recs = engine_result['recommendations'][:top_k]
        enriched = []
        for r in recs:
            tid = r.get('topic_id', '')
            meta = TOPIC_META.get(tid, {})
            enriched.append({
                'topic_id': tid,
                'topic_name': r.get('topic_name') or TOPIC_NAMES.get(tid, tid),
                'yield_score': r.get('yield_score', 50),
                'mastery_pct': r.get('mastery_pct', 0),
                'reasoning': r.get('reasoning', ''),
                'priority': r.get('priority', 'MEDIUM'),
                'exam_weight': meta.get('exam_weight', 5),
                'difficulty': meta.get('difficulty', 3.0),
                'course': meta.get('course', 'adv'),
                'subtopics': [],
            })
        _cache_recommendations(user.id, enriched)
        return jsonify({
            'recommendations': enriched,
            'model': 'rec-v2',
            'source': 'engine-inference',
            'summary': engine_result.get('summary', ''),
        })

    heuristic = _compute_all_heuristic_yields(user.id, course)
    enriched = []
    for h in heuristic[:top_k]:
        enriched.append({
            **h,
            'reasoning': _generate_heuristic_reasoning(h),
            'priority': 'HIGH' if h['yield_score'] > 70 else 'MEDIUM' if h['yield_score'] > 40 else 'LOW',
            'subtopics': [],
        })
    _cache_recommendations(user.id, enriched)
    return jsonify({
        'recommendations': enriched,
        'model': 'heuristic-v1',
        'source': 'heuristic-fallback',
        'summary': 'Recommendations computed using heuristic formula (engine unavailable).',
    })

def _generate_heuristic_reasoning(rec: dict) -> str:
    """Generate a human-readable reason for a heuristic recommendation."""
    tid = rec['topic_id']
    mastery = rec['mastery_pct']
    weight = rec['exam_weight']
    meta = TOPIC_META.get(tid, {})
    reasons = []
    if mastery < 40:
        reasons.append(f"significant mastery gap ({mastery:.0f}%)")
    if weight >= 8:
        reasons.append(f"high HSC exam weight ({weight}%)")
    prereqs = meta.get('prereq_of', [])
    if prereqs:
        reasons.append(f"prerequisite for {len(prereqs)} other topic(s)")
    if rec.get('attempts', 0) == 0:
        reasons.append("not yet attempted")
    elif rec.get('attempts', 0) >= 3 and mastery < 60:
        reasons.append("persistent difficulty despite attempts")
    if not reasons:
        reasons.append("recommended for review")
    return " — ".join(reasons) + "."

@rec_bp.route('/yields', methods=['GET'])
@token_required
def topic_yields():
    """Get yield scores for all syllabus topics for the current user."""
    user = g.current_user
    course = request.args.get('course', None, type=str)
    results = _compute_all_heuristic_yields(user.id, course)
    return jsonify({
        'yields': results,
        'model': 'heuristic-v1',
        'total_topics': len(results),
    })

@rec_bp.route('/feedback', methods=['POST'])
@token_required
def submit_feedback():
    """Submit a problem attempt result — updates EMA mastery + invalidates cache."""
    user = g.current_user
    data = request.get_json()
    if not data or 'topic_id' not in data or 'score' not in data:
        return jsonify({'error': 'Missing topic_id or score'}), 400

    topic_id = data['topic_id']
    score = float(data['score'])
    total_marks = float(data.get('total_marks', 5.0))
    _update_mastery_ema(user.id, topic_id, score, total_marks)

    mastery = UserTopicMastery.query.filter_by(
        user_id=user.id, topic_id=topic_id
    ).first()

    RecommendationCache.query.filter_by(user_id=user.id).delete()
    db.session.commit()

    return jsonify({
        'status': 'ok',
        'topic_id': topic_id,
        'mastery': mastery.to_dict() if mastery else None,
    })

@rec_bp.route('/model-info', methods=['GET'])
def model_info():
    """Return metadata about the recommendation system."""
    api_key = current_app.config.get('GEMINI_API_KEY', '')
    return jsonify({
        'model_type': 'Smart Recommender',
        'version': 'rec-v2',
        'primary_model': GEMINI_MODEL,
        'fallback': 'Heuristic yield calculator',
        'engine_available': bool(api_key),
        'n_topics': len(ALL_TOPICS),
        'features_analyzed': [
            'exam_weight', 'difficulty', 'mastery_pct', 'attempts_count',
            'avg_score', 'days_since_last_attempt', 'prerequisite_chains',
            'topic_interdependencies', 'recency_decay',
        ],
        'cache_ttl_minutes': 30,
        'mastery_algorithm': 'Exponential Moving Average (adaptive alpha)',
    })
