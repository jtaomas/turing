const API_BASE = 'http://localhost:5000/api';

let authToken: string | null = localStorage.getItem('turing_auth_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('turing_auth_token', token);
  } else {
    localStorage.removeItem('turing_auth_token');
  }
}

export function getAuthToken(): string | null {
  return authToken || localStorage.getItem('turing_auth_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export interface User {
  id: number;
  google_id: string | null;
  email: string;
  display_name: string;
  picture_url: string | null;
  institution: string;
  course: string;
  academic_id: string | null;
  created_at: string;
  last_login: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  setAuthToken(data.token);
  return data;
}

export async function getCurrentUser(): Promise<{ user: User }> {
  return request('/auth/me');
}

export async function updateProfile(profile: Partial<User>): Promise<{ user: User }> {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export interface HintResponse {
  hint: string;
  level: 'concept' | 'strategy' | 'ai';
}

export async function generateHint(
  problemDescription: string,
  hintLevel: 'concept' | 'strategy' | 'ai' = 'ai',
  topicId?: string
): Promise<HintResponse> {
  return request('/generate-hint', {
    method: 'POST',
    body: JSON.stringify({ problemDescription, hintLevel, topicId }),
  });
}

export interface MarkResult {
  transcription?: string;
  score: number;
  totalMarks: number;
  overall?: string;
  feedback?: string;
  steps?: string[];
  annotations?: { step: string; status: string; detail: string }[];
  ai?: boolean;
}

export async function transcribeAndMark(
  problemDescription: string,
  imageBase64?: string,
  textAnswer?: string
): Promise<MarkResult> {
  return request('/transcribe-and-mark', {
    method: 'POST',
    body: JSON.stringify({ problemDescription, imageBase64, textAnswer }),
  });
}

export interface ProblemAttempt {
  id: number;
  user_id: number;
  question_id: number | null;
  session_id: string | null;
  position: number;
  topic_id: string | null;
  subtopic: string | null;
  problem_text: string;
  answer_text: string | null;
  image_data?: string | null;
  score: number | null;
  total_marks: number;
  feedback: string | null;
  time_spent_seconds: number;
  input_mode: string;
  created_at: string;
}

export async function saveAttempt(data: Partial<ProblemAttempt> & { session_id?: string; position?: number }): Promise<{ attempt: ProblemAttempt }> {
  return request('/problems/attempt', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAttempts(limit = 50): Promise<{ attempts: ProblemAttempt[] }> {
  return request(`/problems/attempts?limit=${limit}`);
}

export async function deleteAttempt(attemptId: number): Promise<{ status: string; id: number }> {
  return request(`/problems/attempts/${attemptId}`, { method: 'DELETE' });
}

export async function reorderAttempts(order: Array<{ id: number; position: number }>): Promise<{ status: string; count: number }> {
  return request('/problems/attempts/reorder', {
    method: 'POST',
    body: JSON.stringify({ order }),
  });
}

export interface NextQuestion {
  question_id: number;
  question_text: string;
  topic_id: string;
  subtopic: string;
  difficulty: number;
  hsc_marks: number;
  hsc_exam_weight: number;
  course: string;
  year_level: number;
  yield_score: number;
  mastery_pct: number;
  reason: string;
  is_new: boolean;
}

export interface NextQuestionsResponse {
  questions: NextQuestion[];
  total_available: number;
  total_attempted: number;
  model: string;
}

export async function getNextQuestion(params: {
  topic_id?: string;
  subtopic?: string;
  course?: string;
  limit?: number;
} = {}): Promise<NextQuestionsResponse> {
  const qs = new URLSearchParams();
  if (params.topic_id) qs.set('topic_id', params.topic_id);
  if (params.subtopic) qs.set('subtopic', params.subtopic);
  if (params.course) qs.set('course', params.course);
  if (params.limit) qs.set('limit', String(params.limit));
  return request(`/problems/next?${qs.toString()}`);
}

export interface TopicRecommendation {
  topic_id: string;
  topic_name?: string;
  priority: number;
  yield_score: number;
  mastery_pct: number;
  exam_weight: number;
  difficulty: number;
  course: string;
  attempts: number;
  avg_score: number;
  last_practised_days_ago: number | null;
  is_prerequisite: boolean;
  model: string;
  subtopics?: string[];
  reasoning?: string;      
  priority_label?: string;  
}

export interface NeuralRecommendationsResponse {
  recommendations: TopicRecommendation[];
  model: string;
  source: string;
  total_evaluated?: number;
  summary?: string;  
}

export async function getNeuralRecommendations(
  topK = 8,
  course?: string,
  refresh = false
): Promise<NeuralRecommendationsResponse> {
  const params = new URLSearchParams();
  params.set('top_k', String(topK));
  if (course) params.set('course', course);
  if (refresh) params.set('refresh', 'true');
  return request(`/recommendations/neural?${params.toString()}`);
}

export interface SetAnalysis {
  difficulty: number;
  estimated_topic_ids: string[];
  question_count_estimate: number;
  summary: string;
  hsc_relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  course: string;
  analyzed_by: 'gemini' | 'heuristic';
}

export async function analyzeUploadedSet(
  filename: string,
  preview: string
): Promise<SetAnalysis> {
  return request('/analyze-set', {
    method: 'POST',
    body: JSON.stringify({ filename, preview }),
  });
}

export interface TopicYield {
  topic_id: string;
  topic_name: string;
  yield_score: number;
  mastery_pct: number;
  exam_weight: number;
  difficulty: number;
  course: string;
  model: string;
}

export interface TopicYieldsResponse {
  yields: TopicYield[];
  model: string;
  total_topics: number;
}

export async function getTopicYields(course?: string): Promise<TopicYieldsResponse> {
  const params = course ? `?course=${course}` : '';
  return request(`/recommendations/yields${params}`);
}

export interface MasteryUpdate {
  status: string;
  topic_id: string;
  mastery: {
    topic_id: string;
    mastery_pct: number;
    confidence: number;
    attempts_count: number;
    avg_score: number;
  } | null;
}

export async function submitFeedback(
  topicId: string,
  score: number,
  totalMarks = 5
): Promise<MasteryUpdate> {
  return request('/recommendations/feedback', {
    method: 'POST',
    body: JSON.stringify({ topic_id: topicId, score, total_marks: totalMarks }),
  });
}

export interface ModelInfo {
  model_type: string;
  version: string;
  framework: string;
  n_topics: number;
  n_users_trained: number;
  embedding_dim: number;
  architecture: Record<string, unknown>;
  features: string[];
  topics_trained: string[];
}

export async function getModelInfo(): Promise<ModelInfo> {
  return request('/recommendations/model-info');
}
