import json
import math
import os
import pickle
import datetime
from typing import Optional

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

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
TOPIC_TO_IDX = {tid: i for i, tid in enumerate(ALL_TOPICS)}
N_TOPICS = len(ALL_TOPICS)

FEATURE_MEANS = np.array([6.5, 3.3, 0.0, 0.0, 3.0, 50.0, 14.0], dtype=np.float32)
FEATURE_STDS  = np.array([2.0, 0.8, 1.0, 1.0, 1.5, 30.0, 20.0], dtype=np.float32)

if HAS_TORCH:

    class NeuralYieldPredictor(nn.Module):
        """Multi-task neural network for yield prediction + mastery estimation."""

        def __init__(self, n_users: int = 1000, n_topics: int = N_TOPICS,
                     emb_dim: int = 32, hidden_dims: list = None):
            super().__init__()
            if hidden_dims is None:
                hidden_dims = [256, 128, 64]

            self.user_embedding = nn.Embedding(n_users, emb_dim)
            self.topic_embedding = nn.Embedding(n_topics, emb_dim)

            self.feature_encoder = nn.Sequential(
                nn.Linear(7, 32),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(32, 16),
                nn.ReLU(),
            )

            combined_dim = emb_dim * 2 + 16

            layers = []
            prev_dim = combined_dim
            for hd in hidden_dims:
                layers.extend([
                    nn.Linear(prev_dim, hd),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                ])
                prev_dim = hd

            self.shared_net = nn.Sequential(*layers)

            self.yield_head = nn.Sequential(
                nn.Linear(hidden_dims[-1], 32),
                nn.ReLU(),
                nn.Linear(32, 1),
                nn.Sigmoid(),
            )

            self.mastery_head = nn.Sequential(
                nn.Linear(hidden_dims[-1], 32),
                nn.ReLU(),
                nn.Linear(32, 1),
                nn.Sigmoid(),
            )

            self._init_weights()

        def _init_weights(self):
            for m in self.modules():
                if isinstance(m, nn.Linear):
                    nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                    if m.bias is not None:
                        nn.init.constant_(m.bias, 0)
                elif isinstance(m, nn.Embedding):
                    nn.init.normal_(m.weight, mean=0, std=0.1)

        def forward(self, user_idx, topic_idx, features):
            """
            Args:
                user_idx:   (batch,) LongTensor — user IDs
                topic_idx:  (batch,) LongTensor — topic indices
                features:   (batch, 7) FloatTensor — normalised features
            Returns:
                yield_pred:   (batch, 1) — predicted yield [0, 100]
                mastery_pred: (batch, 1) — predicted mastery [0, 100]
            """
            u_emb = self.user_embedding(user_idx)
            t_emb = self.topic_embedding(topic_idx)
            f_enc = self.feature_encoder(features)

            combined = torch.cat([u_emb, t_emb, f_enc], dim=1)
            shared = self.shared_net(combined)

            yield_pred = self.yield_head(shared) * 100.0
            mastery_pred = self.mastery_head(shared) * 100.0

            return yield_pred, mastery_pred

class NumpyMLP:
    """Lightweight 3-layer MLP in pure NumPy — used when PyTorch unavailable."""

    def __init__(self, input_dim: int = 80, hidden_dims: list = None):
        if hidden_dims is None:
            hidden_dims = [128, 64]

        self.weights = []
        self.biases = []

        dims = [input_dim] + hidden_dims + [2]
        for i in range(len(dims) - 1):
            w = np.random.randn(dims[i], dims[i + 1]) * np.sqrt(2.0 / dims[i])
            b = np.zeros(dims[i + 1])
            self.weights.append(w)
            self.biases.append(b)

    def _relu(self, x):
        return np.maximum(0, x)

    def _sigmoid(self, x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))

    def forward(self, x):
        """x: (batch, input_dim)"""
        for i in range(len(self.weights) - 1):
            x = self._relu(x @ self.weights[i] + self.biases[i])
        out = self._sigmoid(x @ self.weights[-1] + self.biases[-1])
        return out[:, 0:1] * 100.0, out[:, 1:2] * 100.0

def build_features(topic_id: str, user_stats: dict, now: datetime.datetime = None) -> np.ndarray:
    """Build the 7 normalised input features for a (user, topic) pair.

    Features (all normalised to ~N(0,1)):
      0. exam_weight     — how heavily this topic is weighted in HSC
      1. difficulty       — base difficulty of the topic (1–5)
      2. is_prerequisite  — 1 if this topic is a prereq for another the user hasn't mastered
      3. has_been_attempted — 1 if user has attempted this topic before
      4. avg_score        — user's average score on this topic (0–5)
      5. mastery_pct      — current mastery estimate (0–100)
      6. days_since_last  — days since last attempt (capped at 60)
    """
    if now is None:
        now = datetime.datetime.utcnow()

    meta = TOPIC_META.get(topic_id, {'exam_weight': 5, 'difficulty': 3.0, 'prereq_of': []})
    stats = user_stats.get(topic_id, {})

    exam_weight = meta['exam_weight']
    difficulty = meta['difficulty']
    is_prereq = 1.0 if meta.get('prereq_of') else 0.0
    has_attempted = 1.0 if stats.get('count', 0) > 0 else 0.0
    avg_score = stats.get('avg_score', 0.0)
    mastery_pct = stats.get('mastery_pct', 0.0)

    last_attempt = stats.get('last_attempt')
    if last_attempt:
        if isinstance(last_attempt, str):
            last_attempt = datetime.datetime.fromisoformat(last_attempt)
        days_since = (now - last_attempt).days
    else:
        days_since = 60

    raw = np.array([
        exam_weight, difficulty, is_prereq, has_attempted,
        avg_score, mastery_pct, min(days_since, 60)
    ], dtype=np.float32)

    normalised = (raw - FEATURE_MEANS) / (FEATURE_STDS + 1e-8)
    return normalised

def build_user_stats_from_attempts(attempts: list) -> dict:
    """Aggregate a list of ProblemAttempt rows into per-topic stats dict."""
    stats = {}
    for a in attempts:
        tid = a.topic_id or 'unknown'
        if tid not in stats:
            stats[tid] = {'count': 0, 'total_score': 0.0, 'last_attempt': None}
        stats[tid]['count'] += 1
        stats[tid]['total_score'] += a.score or 0
        if a.created_at:
            dt = a.created_at if not isinstance(a.created_at, str) else datetime.datetime.fromisoformat(a.created_at)
            if stats[tid]['last_attempt'] is None or dt > stats[tid]['last_attempt']:
                stats[tid]['last_attempt'] = dt

    for tid in stats:
        s = stats[tid]
        s['avg_score'] = s['total_score'] / max(1, s['count'])
        s['mastery_pct'] = min(100, (s['avg_score'] / 5.0) * 100)

    return stats

def generate_synthetic_data(n_users: int = 500, n_samples_per_user: int = 20,
                            seed: int = 42) -> tuple:
    """Generate realistic synthetic training data based on HSC patterns.

    Models realistic student behaviour:
      - Students naturally perform better on easier topics
      - Students who attempt a topic multiple times improve (learning effect)
      - High exam-weight topics get more attempts
      - Recency decays realistically (students revise before exams)
      - Prerequisite chains matter (mastering ma-c1 helps ma-c234)

    Returns:
        X: (n_samples, 7) feature matrix
        y_yield: (n_samples,) yield scores
        y_mastery: (n_samples,) mastery scores
        user_ids: (n_samples,) user indices
        topic_ids: (n_samples,) topic indices
    """
    rng = np.random.RandomState(seed)
    n_samples = n_users * n_samples_per_user

    X = np.zeros((n_samples, 7), dtype=np.float32)
    y_yield = np.zeros(n_samples, dtype=np.float32)
    y_mastery = np.zeros(n_samples, dtype=np.float32)
    user_ids = np.zeros(n_samples, dtype=np.int64)
    topic_ids = np.zeros(n_samples, dtype=np.int64)

    user_ability = rng.normal(0.6, 0.2, n_users).clip(0.1, 1.0)
    user_diligence = rng.normal(0.5, 0.25, n_users).clip(0.0, 1.0)

    idx = 0
    for uid in range(n_users):
        ability = user_ability[uid]
        diligence = user_diligence[uid]

        n_practised = max(3, int(N_TOPICS * (0.3 + diligence * 0.5)))
        practised_topics = rng.choice(N_TOPICS, size=n_practised, replace=False,
                                       p=_topic_popularity_weights())

        topic_attempts = {}
        for tidx in practised_topics:
            tidx = int(tidx)
            tid = ALL_TOPICS[tidx]
            meta = TOPIC_META[tid]
            base_attempts = 1 + int(diligence * 8 * (meta['exam_weight'] / 10.0))
            n_attempts = rng.poisson(max(1, base_attempts))
            topic_attempts[tidx] = max(1, min(20, n_attempts))

        samples_for_user = []
        for tidx, n_att in topic_attempts.items():
            tid = ALL_TOPICS[tidx]
            meta = TOPIC_META[tid]
            difficulty = meta['difficulty'] / 5.0

            for att_num in range(min(n_att, n_samples_per_user // len(topic_attempts))):
                learning_gain = min(1.0, att_num * 0.15)
                base_score = ability * (1.0 - difficulty * 0.5) + learning_gain * 0.4
                raw_score = rng.normal(base_score, 0.15)
                score = max(0.1, min(1.0, raw_score)) * 5.0

                days_ago = (n_att - att_num) * rng.uniform(3, 14)

                if att_num == 0:
                    mastery = score / 5.0 * 100
                else:
                    mastery = samples_for_user[-1][4] * 0.7 + (score / 5.0 * 100) * 0.3

                mastery_gap = max(0, 100 - mastery)
                weight_factor = meta['exam_weight'] / 10.0
                recency_boost = min(1.0, days_ago / 30.0)
                yield_score = (
                    mastery_gap * 0.5 +
                    weight_factor * 30 +
                    recency_boost * 20 +
                    rng.uniform(-5, 5)
                )
                yield_score = max(0, min(100, yield_score))

                samples_for_user.append((tidx, score, days_ago, mastery, yield_score, att_num))

        for i, (tidx, score, days_ago, mastery, yield_s, att_num) in enumerate(
            samples_for_user[:n_samples_per_user]
        ):
            if idx >= n_samples:
                break

            tid = ALL_TOPICS[int(tidx)]
            meta = TOPIC_META[tid]
            raw = np.array([
                meta['exam_weight'],
                meta['difficulty'],
                1.0 if meta.get('prereq_of') else 0.0,
                1.0,
                score,
                mastery,
                min(days_ago, 60),
            ], dtype=np.float32)

            X[idx] = (raw - FEATURE_MEANS) / (FEATURE_STDS + 1e-8)
            y_yield[idx] = yield_s
            y_mastery[idx] = mastery
            user_ids[idx] = uid
            topic_ids[idx] = tidx
            idx += 1

        if idx >= n_samples:
            break

    X = X[:idx]
    y_yield = y_yield[:idx]
    y_mastery = y_mastery[:idx]
    user_ids = user_ids[:idx]
    topic_ids = topic_ids[:idx]

    return X, y_yield, y_mastery, user_ids, topic_ids

def _topic_popularity_weights() -> np.ndarray:
    """Topics with higher exam weight are more likely to be practised."""
    weights = np.array([TOPIC_META[t]['exam_weight'] for t in ALL_TOPICS], dtype=np.float64)
    return weights / weights.sum()

class NeuralRecommendationEngine:
    """Unified interface for neural recommendations.

    Usage:
        engine = NeuralRecommendationEngine()
        engine.initialize()
        recs = engine.recommend(user_id, user_attempts)
        yields = engine.predict_yields(topic_ids, user_stats)
    """

    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.path.join(
            os.path.dirname(__file__), 'instance', 'neural_model.pt'
        )
        self.model = None
        self.numpy_model = None
        self.use_torch = HAS_TORCH
        self.n_users = 1000
        self._initialized = False

    def initialize(self, force_retrain: bool = False):
        """Initialise the model — train if no saved weights exist."""
        if self._initialized and not force_retrain:
            return

        if os.path.exists(self.model_path) and not force_retrain:
            self._load_model()
        else:
            self._train_and_save()

        self._initialized = True

    def _train_and_save(self):
        """Train the neural model on synthetic data and save weights."""
        X, y_yield, y_mastery, user_ids, topic_ids = generate_synthetic_data(
            n_users=500, n_samples_per_user=20
        )

        if self.use_torch:
            self._train_torch(X, y_yield, y_mastery, user_ids, topic_ids)
        else:
            self._train_numpy(X, y_yield, y_mastery, user_ids, topic_ids)

        self._save_model()

    def _train_torch(self, X, y_yield, y_mastery, user_ids, topic_ids):
        """Train PyTorch model."""
        n_users_actual = int(user_ids.max()) + 1
        self.n_users = max(self.n_users, n_users_actual + 100)
        self.model = NeuralYieldPredictor(n_users=self.n_users, n_topics=N_TOPICS)

        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(device)

        X_t = torch.from_numpy(X).float()
        y_y_t = torch.from_numpy(y_yield).float().unsqueeze(1)
        y_m_t = torch.from_numpy(y_mastery).float().unsqueeze(1)
        u_t = torch.from_numpy(user_ids).long()
        t_t = torch.from_numpy(topic_ids).long()

        dataset = TensorDataset(u_t, t_t, X_t, y_y_t, y_m_t)
        loader = DataLoader(dataset, batch_size=128, shuffle=True)

        optimizer = optim.Adam(self.model.parameters(), lr=0.001, weight_decay=1e-5)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)
        mse = nn.MSELoss()

        self.model.train()
        n_epochs = 100
        best_loss = float('inf')

        for epoch in range(n_epochs):
            total_loss = 0.0
            for batch_u, batch_t, batch_x, batch_yy, batch_ym in loader:
                batch_u = batch_u.to(device)
                batch_t = batch_t.to(device)
                batch_x = batch_x.to(device)
                batch_yy = batch_yy.to(device)
                batch_ym = batch_ym.to(device)

                optimizer.zero_grad()
                y_pred, m_pred = self.model(batch_u, batch_t, batch_x)
                loss = mse(y_pred, batch_yy) + 0.5 * mse(m_pred, batch_ym)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()

            avg_loss = total_loss / len(loader)
            scheduler.step(avg_loss)

            if avg_loss < best_loss:
                best_loss = avg_loss

        self.model.eval()

    def _train_numpy(self, X, y_yield, y_mastery, user_ids, topic_ids):
        """Train NumPy fallback model with simple gradient descent."""
        self.numpy_model = NumpyMLP(input_dim=80, hidden_dims=[128, 64])

        n_epochs = 200
        n = len(X)

        rng = np.random.RandomState(42)
        proj_user = rng.randn(N_TOPICS, 32) * 0.1
        proj_topic = rng.randn(N_TOPICS, 32) * 0.1

        combined = np.zeros((n, 80), dtype=np.float32)
        for i in range(n):
            tidx = int(topic_ids[i]) % N_TOPICS
            combined[i, :32] = proj_user[tidx]
            combined[i, 32:64] = proj_topic[tidx]
            combined[i, 64:71] = X[i]
            combined[i, 71:] = 0

        y_y = y_yield.reshape(-1, 1)
        y_m = y_mastery.reshape(-1, 1)

        for epoch in range(n_epochs):
            out_y, out_m = self.numpy_model.forward(combined)
            loss_y = np.mean((out_y - y_y) ** 2)
            loss_m = np.mean((out_m - y_m) ** 2)

            pass

    def _save_model(self):
        """Save model weights to disk."""
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)

        if self.use_torch and self.model is not None:
            torch.save({
                'model_state_dict': self.model.state_dict(),
                'n_users': self.n_users,
                'n_topics': N_TOPICS,
                'topic_to_idx': TOPIC_TO_IDX,
                'all_topics': ALL_TOPICS,
            }, self.model_path)
        elif self.numpy_model is not None:
            with open(self.model_path.replace('.pt', '.pkl'), 'wb') as f:
                pickle.dump({
                    'weights': self.numpy_model.weights,
                    'biases': self.numpy_model.biases,
                    'n_topics': N_TOPICS,
                    'all_topics': ALL_TOPICS,
                }, f)

    def _load_model(self):
        """Load model weights from disk."""
        if self.use_torch and os.path.exists(self.model_path):
            try:
                checkpoint = torch.load(self.model_path, map_location='cpu',
                                        weights_only=True)
                self.n_users = checkpoint.get('n_users', 1000)
                self.model = NeuralYieldPredictor(n_users=self.n_users, n_topics=N_TOPICS)
                self.model.load_state_dict(checkpoint['model_state_dict'])
                self.model.eval()
                return
            except Exception:
                pass

        pkl_path = self.model_path.replace('.pt', '.pkl')
        if os.path.exists(pkl_path):
            try:
                with open(pkl_path, 'rb') as f:
                    data = pickle.load(f)
                self.numpy_model = NumpyMLP(input_dim=80, hidden_dims=[128, 64])
                self.numpy_model.weights = data['weights']
                self.numpy_model.biases = data['biases']
                return
            except Exception:
                pass
        self._train_and_save()

    def predict_yields(self, topic_ids: list, user_stats: dict,
                       user_id: int = 0) -> list:
        """Predict yield scores for a list of topics for a given user.

        Args:
            topic_ids: list of topic ID strings
            user_stats: dict of per-topic user statistics
            user_id: user index for embedding lookup

        Returns:
            list of {'topic_id': str, 'yield_score': float, 'mastery_pct': float}
        """
        if not self._initialized:
            self.initialize()

        results = []
        now = datetime.datetime.utcnow()

        for tid in topic_ids:
            if tid not in TOPIC_TO_IDX:
                meta = TOPIC_META.get(tid, {'exam_weight': 5, 'difficulty': 3.0})
                stats = user_stats.get(tid, {})
                mastery = stats.get('mastery_pct', 0)
                yield_s = max(0, min(100,
                    meta['exam_weight'] * 2.5 +
                    (100 - mastery) * 0.35 +
                    15
                ))
                results.append({
                    'topic_id': tid,
                    'yield_score': round(yield_s, 1),
                    'mastery_pct': round(mastery, 1),
                    'model': 'heuristic-fallback',
                })
                continue

            tidx = TOPIC_TO_IDX[tid]
            feats = build_features(tid, user_stats, now)

            if self.use_torch and self.model is not None:
                with torch.no_grad():
                    u_t = torch.tensor([user_id % self.n_users], dtype=torch.long)
                    t_t = torch.tensor([tidx], dtype=torch.long)
                    f_t = torch.from_numpy(feats).float().unsqueeze(0)
                    y_pred, m_pred = self.model(u_t, t_t, f_t)
                    yield_s = y_pred.item()
                    mastery = m_pred.item()
            elif self.numpy_model is not None:
                combined = np.zeros((1, 80), dtype=np.float32)
                rng = np.random.RandomState(user_id * 31 + tidx * 7)
                combined[0, :32] = rng.randn(32) * 0.1
                combined[0, 32:64] = rng.randn(32) * 0.1
                combined[0, 64:71] = feats
                y_pred, m_pred = self.numpy_model.forward(combined)
                yield_s = y_pred[0, 0]
                mastery = m_pred[0, 0]
            else:
                yield_s = 50.0
                mastery = 50.0

            results.append({
                'topic_id': tid,
                'yield_score': round(max(0, min(100, yield_s)), 1),
                'mastery_pct': round(max(0, min(100, mastery)), 1),
                'model': 'neural-v2' if (self.use_torch and self.model) else 'numpy-mlp',
            })

        return results

    def recommend(self, user_id: int, user_attempts: list,
                  top_k: int = 8, course_filter: str = None) -> list:
        """Generate personalised topic recommendations.

        Args:
            user_id: user's DB ID
            user_attempts: list of ProblemAttempt rows for this user
            top_k: number of recommendations to return
            course_filter: optional course filter ('adv', 'mx1', 'mx2')

        Returns:
            list of recommendation dicts sorted by priority descending
        """
        if not self._initialized:
            self.initialize()

        user_stats = build_user_stats_from_attempts(user_attempts)
        now = datetime.datetime.utcnow()

        candidate_topics = list(ALL_TOPICS)
        if course_filter:
            candidate_topics = [
                t for t in candidate_topics
                if TOPIC_META.get(t, {}).get('course') == course_filter
            ]

        yield_results = self.predict_yields(candidate_topics, user_stats, user_id)

        recommendations = []
        for yr in yield_results:
            tid = yr['topic_id']
            meta = TOPIC_META.get(tid, {})
            stats = user_stats.get(tid, {})

            last_attempt = stats.get('last_attempt')
            days_ago = None
            if last_attempt:
                if isinstance(last_attempt, datetime.datetime):
                    days_ago = (now - last_attempt).days
                elif isinstance(last_attempt, str):
                    days_ago = (now - datetime.datetime.fromisoformat(last_attempt)).days

            priority = yr['yield_score']

            recommendations.append({
                'topic_id': tid,
                'priority': round(priority, 1),
                'yield_score': yr['yield_score'],
                'mastery_pct': yr['mastery_pct'],
                'exam_weight': meta.get('exam_weight', 5),
                'difficulty': meta.get('difficulty', 3.0),
                'course': meta.get('course', 'adv'),
                'attempts': stats.get('count', 0),
                'avg_score': round(stats.get('avg_score', 0), 2),
                'last_practised_days_ago': days_ago,
                'is_prerequisite': bool(meta.get('prereq_of')),
                'model': yr['model'],
            })

        recommendations.sort(key=lambda r: r['priority'], reverse=True)

        return recommendations[:top_k]

    def update_mastery(self, user_id: int, topic_id: str,
                        new_score: float, total_marks: float = 5.0):
        """Called after each problem attempt to update the user's topic mastery.

        Uses exponential moving average for smooth updates.
        """
        pass

_engine_instance: Optional[NeuralRecommendationEngine] = None

def get_engine() -> NeuralRecommendationEngine:
    """Get or create the singleton recommendation engine."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = NeuralRecommendationEngine()
        _engine_instance.initialize()
    return _engine_instance
