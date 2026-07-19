import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    google_id = db.Column(db.String(255), unique=True, nullable=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    display_name = db.Column(db.String(255), nullable=False)
    picture_url = db.Column(db.String(512), nullable=True)
    institution = db.Column(db.String(255), default='NSW Board of Studies')
    course = db.Column(db.String(100), default='Extension 2 (MX2)')
    academic_id = db.Column(db.String(100), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_login = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationships
    sessions = db.relationship('StudySession', backref='user', lazy='dynamic')
    problem_attempts = db.relationship('ProblemAttempt', backref='user', lazy='dynamic')
    topic_masteries = db.relationship('UserTopicMastery', backref='user', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'google_id': self.google_id,
            'email': self.email,
            'display_name': self.display_name,
            'picture_url': self.picture_url,
            'institution': self.institution,
            'course': self.course,
            'academic_id': self.academic_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }


class Question(db.Model):
    """Canonical question bank — every problem in the system."""
    __tablename__ = 'questions'

    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.String(100), nullable=False, index=True)
    subtopic = db.Column(db.String(255), nullable=True)
    question_text = db.Column(db.Text, nullable=False)
    difficulty = db.Column(db.Float, default=3.0)          # 1.0–5.0 (Band 2 → Band 6)
    hsc_marks = db.Column(db.Float, default=3.0)            # typical marks in HSC exam
    hsc_exam_weight = db.Column(db.Float, default=5.0)      # topic % weight in HSC
    yield_score = db.Column(db.Float, default=50.0)         # neural-predicted yield (0–100)
    course = db.Column(db.String(20), default='adv')        # adv, mx1, mx2
    year_level = db.Column(db.Integer, default=12)           # 11 or 12
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationships
    attempts = db.relationship('ProblemAttempt', backref='question', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'topic_id': self.topic_id,
            'subtopic': self.subtopic,
            'question_text': self.question_text,
            'difficulty': self.difficulty,
            'hsc_marks': self.hsc_marks,
            'hsc_exam_weight': self.hsc_exam_weight,
            'yield_score': self.yield_score,
            'course': self.course,
            'year_level': self.year_level,
        }


class TopicEmbedding(db.Model):
    """Learned 32-dimensional embedding for each syllabus topic."""
    __tablename__ = 'topic_embeddings'

    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    embedding_json = db.Column(db.Text, nullable=False)      # JSON-serialised float[32]
    version = db.Column(db.Integer, default=1)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


class UserTopicMastery(db.Model):
    """Per-user, per-topic mastery estimate updated by the neural model."""
    __tablename__ = 'user_topic_masteries'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    topic_id = db.Column(db.String(100), nullable=False)
    mastery_pct = db.Column(db.Float, default=0.0)            # 0–100
    confidence = db.Column(db.Float, default=0.0)             # model confidence (0–1)
    attempts_count = db.Column(db.Integer, default=0)
    avg_score = db.Column(db.Float, default=0.0)
    last_attempt_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'topic_id', name='uq_user_topic'),
    )

    def to_dict(self):
        return {
            'topic_id': self.topic_id,
            'mastery_pct': round(self.mastery_pct, 1),
            'confidence': round(self.confidence, 2),
            'attempts_count': self.attempts_count,
            'avg_score': round(self.avg_score, 2),
            'last_attempt_at': self.last_attempt_at.isoformat() if self.last_attempt_at else None,
        }


class RecommendationCache(db.Model):
    """Cached neural recommendations so we don't recompute on every request."""
    __tablename__ = 'recommendation_cache'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recommendations_json = db.Column(db.Text, nullable=False)  # JSON list of topic recs
    model_version = db.Column(db.String(50), default='v1')
    generated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    __table_args__ = (
        db.Index('idx_rec_cache_user', 'user_id', 'expires_at'),
    )


class StudySession(db.Model):
    __tablename__ = 'study_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    topic_id = db.Column(db.String(100), nullable=True)
    started_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    duration_seconds = db.Column(db.Integer, default=0)
    problems_attempted = db.Column(db.Integer, default=0)
    problems_correct = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'topic_id': self.topic_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_seconds': self.duration_seconds,
            'problems_attempted': self.problems_attempted,
            'problems_correct': self.problems_correct,
        }


class ProblemAttempt(db.Model):
    __tablename__ = 'problem_attempts'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=True)
    session_id = db.Column(db.String(64), nullable=True, index=True)  # groups multi-qn sessions
    position = db.Column(db.Integer, default=0)  # for drag reorder in history
    topic_id = db.Column(db.String(100), nullable=True)
    subtopic = db.Column(db.String(255), nullable=True)
    problem_text = db.Column(db.Text, nullable=False)
    answer_text = db.Column(db.Text, nullable=True)
    image_data = db.Column(db.Text, nullable=True)  # base64 canvas drawing
    score = db.Column(db.Float, nullable=True)
    total_marks = db.Column(db.Float, default=5.0)
    feedback = db.Column(db.Text, nullable=True)
    time_spent_seconds = db.Column(db.Integer, default=0)
    input_mode = db.Column(db.String(20), default='draw')  # draw, text, upload
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'question_id': self.question_id,
            'session_id': self.session_id,
            'position': self.position,
            'topic_id': self.topic_id,
            'subtopic': self.subtopic,
            'problem_text': self.problem_text,
            'answer_text': self.answer_text,
            'image_data': self.image_data,
            'score': self.score,
            'total_marks': self.total_marks,
            'feedback': self.feedback,
            'time_spent_seconds': self.time_spent_seconds,
            'input_mode': self.input_mode,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class HintLog(db.Model):
    __tablename__ = 'hint_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    problem_text = db.Column(db.Text, nullable=False)
    hint_type = db.Column(db.String(20), nullable=False)  # concept, strategy, ai
    hint_content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'problem_text': self.problem_text,
            'hint_type': self.hint_type,
            'hint_content': self.hint_content,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
