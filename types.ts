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

export interface MathProblem {
  id: string;
  question: string;
  context?: string;
  image?: string;
}

export interface Solution {
  problemId: string;
  steps: string[];
  finalAnswer: string;
  explanation: string;
}

export interface MarkResult {
  score: number;
  totalMarks: number;
  feedback: string;
  corrections: string[];
}

export interface TopicProgress {
  name: string;
  level: number;
  maxLevel: number;
}

export interface CourseData {
  title: string;
  status: 'Novice' | 'Intermediate' | 'Advanced' | 'Master';
  topics: TopicProgress[];
}
