"""Question bank analysis + Advanced question generator"""
from app import create_app
from models import db, Question
from sqlalchemy import func
from collections import Counter

app = create_app()
with app.app_context():
    print("=== Question Bank Status ===\n")
    for course in ['adv', 'mx1', 'mx2']:
        cnt = Question.query.filter_by(course=course).count()
        print(f"  {course}: {cnt}")
    
    total = Question.query.count()
    print(f"\n  Total: {total}")
    
    print("\n=== By Topic (top 15) ===")
    dist = db.session.query(
        Question.topic_id, Question.course, func.count(Question.id)
    ).group_by(Question.topic_id, Question.course).order_by(
        func.count(Question.id).desc()
    ).limit(15).all()
    for tid, crs, cnt in dist:
        print(f"  {tid:12s} ({crs}): {cnt:4d}")
    
    print("\n=== Missing/Weak Topics ===")
    from routes.recommendations import TOPIC_META, TOPIC_NAMES
    for tid in sorted(TOPIC_META.keys()):
        cnt = Question.query.filter_by(topic_id=tid).count()
        course = TOPIC_META[tid].get('course', '?')
        name = TOPIC_NAMES.get(tid, tid)
        bar = '#' * min(40, cnt) if cnt > 0 else '(empty)'
        if cnt < 10:
            print(f"  {tid:12s} ({course}) {name:35s}: {cnt:4d} {bar}")
    
    print("\n=== Duplicate Check ===")
    texts = [q.question_text.strip()[:100] for q in Question.query.all()]
    dupes = {t: c for t, c in Counter(texts).items() if c > 1}
    print(f"  Duplicate groups: {len(dupes)}")
    if dupes:
        for t, c in list(dupes.items())[:5]:
            print(f"    '{t}...' appears {c}x")
