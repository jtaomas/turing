from flask import Blueprint, request, jsonify
from models import db, ProblemAttempt, StudySession, UserTopicMastery, Question
from auth import token_required
import datetime
import math

problems_bp = Blueprint('problems', __name__, url_prefix='/api/problems')

def _get_topic_meta():
    from routes.recommendations import TOPIC_META
    return TOPIC_META


def _update_mastery_ema(user_id: int, topic_id: str, score: float, total_marks: float = 5.0):
    
    mastery = UserTopicMastery.query.filter_by(
        user_id=user_id, topic_id=topic_id
    ).first()
    if not mastery:
        mastery = UserTopicMastery(
            user_id=user_id,
            topic_id=topic_id,
            mastery_pct=0.0,
            confidence=0.0,
        )
        db.session.add(mastery)
        db.session.flush()

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


@problems_bp.route('/attempt', methods=['POST'])
@token_required
def save_attempt():
    
    data = request.get_json()
    if not data or 'problem_text' not in data:
        return jsonify({'error': 'Missing problem_text'}), 400

    from flask import g
    
    existing = ProblemAttempt.query.filter_by(
        user_id=g.current_user.id,
        problem_text=data['problem_text']
    ).first()
    
    is_update = False
    if existing:
        existing.answer_text = data.get('answer_text') or existing.answer_text
        existing.image_data = data.get('image_data') or existing.image_data
        existing.score = data.get('score') if data.get('score') is not None else existing.score
        existing.total_marks = data.get('total_marks', existing.total_marks or 5.0)
        existing.feedback = data.get('feedback') or existing.feedback
        existing.time_spent_seconds = (existing.time_spent_seconds or 0) + data.get('time_spent_seconds', 0)
        existing.input_mode = data.get('input_mode') or existing.input_mode
        existing.session_id = data.get('session_id') or existing.session_id
        existing.question_id = data.get('question_id') or existing.question_id
        attempt = existing
        is_update = True
    else:
        last_pos = ProblemAttempt.query.filter_by(user_id=g.current_user.id) \
            .order_by(ProblemAttempt.position.desc()).first()
        next_pos = (last_pos.position + 1) if last_pos else 0
        
        attempt = ProblemAttempt(
            user_id=g.current_user.id,
            question_id=data.get('question_id'),
            session_id=data.get('session_id'),
            position=data.get('position', next_pos),
            topic_id=data.get('topic_id'),
            subtopic=data.get('subtopic'),
            problem_text=data['problem_text'],
            answer_text=data.get('answer_text'),
            image_data=data.get('image_data'),
            score=data.get('score'),
            total_marks=data.get('total_marks', 5.0),
            feedback=data.get('feedback'),
            time_spent_seconds=data.get('time_spent_seconds', 0),
            input_mode=data.get('input_mode', 'draw')
        )
        db.session.add(attempt)
    
    db.session.commit()

    if data.get('topic_id') and data.get('score') is not None:
        try:
            _update_mastery_ema(
                g.current_user.id,
                data['topic_id'],
                float(data['score']),
                float(data.get('total_marks', 5.0))
            )
            from models import RecommendationCache
            RecommendationCache.query.filter_by(user_id=g.current_user.id).delete()
            db.session.commit()
        except Exception:
            pass  

    return jsonify({
        'attempt': attempt.to_dict(),
        'updated': is_update,
    }), 200 if is_update else 201


@problems_bp.route('/attempts', methods=['GET'])
@token_required
def get_attempts():
    
    from flask import g
    limit = request.args.get('limit', 50, type=int)
    attempts = ProblemAttempt.query.filter_by(user_id=g.current_user.id) \
        .order_by(ProblemAttempt.position.is_(None), ProblemAttempt.position.desc(), ProblemAttempt.created_at.desc()) \
        .limit(limit) \
        .all()
    return jsonify({'attempts': [a.to_dict() for a in attempts]}), 200


@problems_bp.route('/attempts/reorder', methods=['POST'])
@token_required
def reorder_attempts():
    
    from flask import g
    
    data = request.get_json()
    if not data or 'order' not in data:
        return jsonify({'error': 'Missing order list'}), 400
    
    order = data['order']  
    
    for item in order:
        attempt = ProblemAttempt.query.filter_by(
            id=item['id'], user_id=g.current_user.id
        ).first()
        if attempt:
            attempt.position = item['position']
    
    db.session.commit()
    return jsonify({'status': 'reordered', 'count': len(order)}), 200


@problems_bp.route('/next', methods=['GET'])
@token_required
def next_question():
    
    from flask import g
    from sqlalchemy import not_
    import random as _random

    user_id = g.current_user.id
    topic_id = request.args.get('topic_id', None)
    subtopic = request.args.get('subtopic', None)
    course = request.args.get('course', None)
    limit = request.args.get('limit', 1, type=int)

    attempted_ids = set()
    question_last_attempt = {}  

    attempts = ProblemAttempt.query.filter_by(user_id=user_id).all()
    for a in attempts:
        if a.question_id:
            attempted_ids.add(a.question_id)
            if a.question_id not in question_last_attempt or (
                a.created_at and (not question_last_attempt[a.question_id] or a.created_at > question_last_attempt[a.question_id])
            ):
                question_last_attempt[a.question_id] = a.created_at

    query = Question.query
    if topic_id:
        query = query.filter(Question.topic_id == topic_id)
    if subtopic:
        query = query.filter(Question.subtopic == subtopic)
    if course:
        hierarchy = {'adv': ['adv'], 'mx1': ['mx1', 'adv'], 'mx2': ['mx2', 'mx1', 'adv']}
        courses = hierarchy.get(course, [course])
        query = query.filter(Question.course.in_(courses))

    all_questions = query.order_by(Question.difficulty).all()

    fresh = [q for q in all_questions if q.id not in attempted_ids]
    recycled = [q for q in all_questions if q.id in attempted_ids]

    from models import UserTopicMastery
    masteries = {
        m.topic_id: m
        for m in UserTopicMastery.query.filter_by(user_id=user_id).all()
    }

    import datetime as dt
    now = dt.datetime.utcnow()

    def score_question(q, is_recycled=False):
        
        meta = TOPIC_META.get(q.topic_id, {})
        exam_weight = meta.get('exam_weight', q.hsc_exam_weight or 5)
        m = masteries.get(q.topic_id)
        mastery_pct = m.mastery_pct if m else 0.0
        attempts_count = m.attempts_count if m else 0
        avg_score = m.avg_score if m else 0.0

        gap = max(0.05, 1.0 - mastery_pct / 100.0)

        last_t = question_last_attempt.get(q.id)
        if last_t:
            hours_since = max(0, (now - last_t).total_seconds() / 3600.0)
            recency = min(1.0, 0.15 + 0.85 * (1.0 - 2.0 ** (-hours_since / 24.0)))
        else:
            recency = 1.0

        if attempts_count >= 3 and avg_score >= 4.0:
            recency *= 0.85

        base = (exam_weight / 10.0) * gap * recency

        if is_recycled:
            jitter = _random.uniform(0.3, 1.7)
            return base * 0.25 * jitter * 100
        else:
            return base * 100

    TOPIC_META = _get_topic_meta()

    scored = []
    for q in fresh:
        ys = score_question(q, is_recycled=False)
        m = masteries.get(q.topic_id)
        scored.append({
            'question_id': q.id,
            'question_text': q.question_text,
            'topic_id': q.topic_id,
            'subtopic': q.subtopic,
            'difficulty': q.difficulty,
            'hsc_marks': q.hsc_marks,
            'hsc_exam_weight': q.hsc_exam_weight,
            'course': q.course,
            'year_level': q.year_level,
            'yield_score': round(min(100, max(5, ys)), 1),
            'mastery_pct': round(m.mastery_pct if m else 0.0, 1),
            'reason': 'fresh question',
            'is_new': True,
        })

    if len(scored) >= limit:
        scored.sort(key=lambda x: x['yield_score'], reverse=True)
        return jsonify({
            'questions': scored[:max(1, min(limit, 10))],
            'total_available': len(fresh),
            'total_attempted': len(attempted_ids),
            'model': 'yield-heuristic',
        }), 200

    for q in recycled:
        ys = score_question(q, is_recycled=True)
        m = masteries.get(q.topic_id)
        scored.append({
            'question_id': q.id,
            'question_text': q.question_text,
            'topic_id': q.topic_id,
            'subtopic': q.subtopic,
            'difficulty': q.difficulty,
            'hsc_marks': q.hsc_marks,
            'hsc_exam_weight': q.hsc_exam_weight,
            'course': q.course,
            'year_level': q.year_level,
            'yield_score': round(min(100, max(3, ys)), 1),
            'mastery_pct': round(m.mastery_pct if m else 0.0, 1),
            'reason': 'recycled (randomized)',
            'is_new': False,
        })

    scored.sort(key=lambda x: x['yield_score'], reverse=True)
    return jsonify({
        'questions': scored[:max(1, min(limit, 10))],
        'total_available': len(fresh),
        'total_attempted': len(attempted_ids),
        'model': 'yield-heuristic',
    }), 200


@problems_bp.route('/attempts/<int:attempt_id>', methods=['DELETE'])
@token_required
def delete_attempt(attempt_id):
    
    from flask import g
    
    attempt = ProblemAttempt.query.filter_by(
        id=attempt_id, user_id=g.current_user.id
    ).first()
    
    if not attempt:
        return jsonify({'error': 'Attempt not found'}), 404
    
    db.session.delete(attempt)
    db.session.commit()
    
    return jsonify({'status': 'deleted', 'id': attempt_id}), 200


@problems_bp.route('/session/start', methods=['POST'])
@token_required
def start_session():
    
    from flask import g
    data = request.get_json() or {}
    session = StudySession(
        user_id=g.current_user.id,
        topic_id=data.get('topic_id')
    )
    db.session.add(session)
    db.session.commit()
    return jsonify({'session': session.to_dict()}), 201


@problems_bp.route('/session/end', methods=['PUT'])
@token_required
def end_session():
    
    import datetime
    from flask import g
    data = request.get_json() or {}
    session_id = data.get('session_id')
    if not session_id:
        return jsonify({'error': 'Missing session_id'}), 400

    session = StudySession.query.filter_by(id=session_id, user_id=g.current_user.id).first()
    if not session:
        return jsonify({'error': 'Session not found'}), 404

    session.ended_at = datetime.datetime.utcnow()
    session.duration_seconds = data.get('duration_seconds', 0)
    session.problems_attempted = data.get('problems_attempted', 0)
    session.problems_correct = data.get('problems_correct', 0)
    db.session.commit()

    return jsonify({'session': session.to_dict()}), 200


@problems_bp.route('/stats', methods=['GET'])
@token_required
def user_stats():
    
    from flask import g
    from sqlalchemy import func

    user_id = g.current_user.id
    attempts = ProblemAttempt.query.filter_by(user_id=user_id).all()

    total = len(attempts)
    if total == 0:
        return jsonify({
            'total_attempts': 0, 'avg_score': 0, 'total_time': 0,
            'topics_attempted': 0, 'mastery_estimate': 0,
            'by_topic': [], 'recent_trend': [], 'strengths': [], 'weaknesses': []
        })

    avg_score = sum(a.score or 0 for a in attempts) / total
    total_time = sum(a.time_spent_seconds or 0 for a in attempts)

    topic_map = {}
    for a in attempts:
        tid = a.topic_id or 'unknown'
        if tid not in topic_map:
            topic_map[tid] = {'count': 0, 'total_score': 0, 'total_marks': 0}
        topic_map[tid]['count'] += 1
        topic_map[tid]['total_score'] += a.score or 0
        topic_map[tid]['total_marks'] += a.total_marks or 5

    by_topic = []
    for tid, data in sorted(topic_map.items(), key=lambda x: x[1]['count'], reverse=True):
        avg = data['total_score'] / max(1, data['count'])
        by_topic.append({
            'topic_id': tid,
            'attempts': data['count'],
            'avg_score': round(avg, 2),
            'mastery_pct': round(min(100, (avg / 5) * 100), 1)
        })

    recent = sorted(attempts, key=lambda a: a.created_at or '', reverse=True)[:10]
    recent_trend = [{'score': a.score or 0, 'total': a.total_marks or 5, 'topic': a.topic_id} for a in recent]

    strengths = [t for t in by_topic if t['mastery_pct'] >= 70][:3]
    weaknesses = [t for t in by_topic if t['mastery_pct'] < 40][:3]

    total_weight = sum(t['attempts'] for t in by_topic) or 1
    mastery_estimate = round(sum(t['mastery_pct'] * t['attempts'] for t in by_topic) / total_weight, 1)

    return jsonify({
        'total_attempts': total,
        'avg_score': round(avg_score, 2),
        'total_time': total_time,
        'topics_attempted': len(by_topic),
        'mastery_estimate': mastery_estimate,
        'by_topic': by_topic,
        'recent_trend': recent_trend,
        'strengths': strengths,
        'weaknesses': weaknesses
    })


@problems_bp.route('/recommendations', methods=['GET'])
@token_required
def recommend_problems():
    
    from flask import g

    user = g.current_user
    top_k = request.args.get('top_k', 8, type=int)
    course = request.args.get('course', None, type=str)

    from routes.recommendations import _compute_all_heuristic_yields
    results = _compute_all_heuristic_yields(user.id, course)

    return jsonify({
        'recommendations': results[:min(24, max(1, top_k))],
        'model': 'heuristic-v1',
        'total_topics_evaluated': len(results),
    })


TOPICMAP_ID_MAP = {
    'ma-f1': 'FUN', 'ma-t1': 'TRI', 'ma-c1': 'CAL', 'ma-e1': 'EXP',
    'ma-s1': 'STA', 'ma-f2': 'FUN', 'ma-t2': 'TRI', 'ma-c234': 'CAL',
    'ma-m1': 'FIN', 'ma-s23': 'STA',
    'me-f1': 'FUN2', 'me-t12': 'TRI2', 'me-c1': 'CAL2', 'me-a1': 'COM',
    'me-p1': 'IND', 'me-v1': 'VEC', 'me-t3': 'TRI2', 'me-c23': 'INT',
    'me-s1': 'BIN',
    'mex-p12': 'PRF', 'mex-v1': 'VEC2', 'mex-n12': 'CPX',
    'mex-c1': 'CAL3', 'mex-m1': 'MEC',
}

@problems_bp.route('/topic-progress', methods=['GET'])
@token_required
def topic_progress():
    
    from flask import g
    from sqlalchemy import func

    user_id = g.current_user.id
    
    masteries = UserTopicMastery.query.filter_by(user_id=user_id).all()
    
    node_progress = {}
    for m in masteries:
        node_id = TOPICMAP_ID_MAP.get(m.topic_id)
        if not node_id:
            continue
        if node_id not in node_progress:
            node_progress[node_id] = {'total': 0, 'count': 0, 'confidence': 0}
        node_progress[node_id]['total'] += m.mastery_pct * m.confidence
        node_progress[node_id]['confidence'] += m.confidence
        node_progress[node_id]['count'] += 1
    
    progress = {}
    for node_id, data in node_progress.items():
        if data['confidence'] > 0:
            progress[node_id] = round(
                (data['total'] / data['confidence']) / 100.0, 3
            )
        else:
            progress[node_id] = round(
                (data['total'] / max(1, data['count'])) / 100.0, 3
            )
    
    adv_topics = ['FUN','TRI','CAL','EXP','STA','FIN']
    x1_topics = ['FUN2','TRI2','CAL2','COM','IND','VEC','INT','BIN']
    x2_topics = ['PRF','CPX','VEC2','CAL3','MEC']
    
    hub_adv = [v for k, v in progress.items() if k in adv_topics]
    hub_x1 = [v for k, v in progress.items() if k in x1_topics]
    hub_x2 = [v for k, v in progress.items() if k in x2_topics]
    
    if hub_adv:
        progress['HUB_ADV'] = round(sum(hub_adv) / len(hub_adv), 3)
    if hub_x1:
        progress['HUB_X1'] = round(sum(hub_x1) / len(hub_x1), 3)
    if hub_x2:
        progress['HUB_X2'] = round(sum(hub_x2) / len(hub_x2), 3)
    
    trained_nodes = list(node_progress.keys())
    
    return jsonify({
        'progress': progress,
        'total_topics_practised': len(node_progress),
        'trained_nodes': trained_nodes,
    })
