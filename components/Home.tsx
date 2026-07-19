import React, { useState, useRef, useEffect } from 'react';
import { getAttempts, getCurrentUser, User, ProblemAttempt, generateHint, transcribeAndMark, saveAttempt, getNextQuestion, NextQuestion } from '../services/api';
import { SYLLABUS, SyllabusTopic, getSyllabusTopicsForCourse, getEffectiveCourseIds } from '../constants';
import { ArrowRight, ChevronRight, Hash, BookOpen, Zap, Timer, Target, X, Edit3, Minimize2, Maximize2, RefreshCw, StepForward, Flag, Pencil, Eraser, Trash2, Sparkles, Lightbulb, BadgeCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MathRenderer, autoFormatMath } from './MathRenderer';
import type { SessionMode } from './Scanner';
import Spinner from './Spinner';

const FEATURED_LATEX: Record<string, string[]> = {
  'ma-f1': ["Determine the domain and range of $f(x) = \\frac{1}{\\sqrt{x^2 - 16}}$ and sketch its graph.", "Solve $|2x - 3| = x + 5$ and verify solutions algebraically."],
  'ma-t1': ["Prove: $$\\frac{\\sin \\theta}{1 - \\cos \\theta} + \\frac{1 - \\cos \\theta}{\\sin \\theta} = 2 \\csc \\theta$$", "Solve $2 \\cos^2\\theta - 1 = 0$ for $0 \\le \\theta \\le 2\\pi$."],
  'ma-c234': ["Find the maximum of $y = x e^{-x}$ for $x \\ge 0$."],
  'me-p1': ["Prove by induction: $1^2+2^2+\\cdots+n^2 = \\frac{n(n+1)(2n+1)}{6}$."],
  'mex-n12': ["Let $z = \\cos\\theta + i\\sin\\theta$. Use De Moivre to show: $$\\cos(3\\theta) = 4\\cos^3\\theta - 3\\cos\\theta$$"],
  'mex-c1': ["Evaluate $\\int x \\ln x \\; dx$ using integration by parts."]
};

interface HistoryEntry {
  id: string;
  question: string;
  topicName: string;
  subtopicName?: string;
  courseId: 'adv'|'mx1'|'mx2';
  yearLevel: 11|12;
  createdAt: Date;
  score?: number;
  answer?: string;
  imageData?: string;  
  attemptId?: number;  
}

function TypewriterText({ text, delay }: { text: string; delay: number }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      let i = 0; setDisplayed('');
      const iv = setInterval(() => { i++; setDisplayed(text.slice(0, i)); if (i >= text.length) clearInterval(iv); }, 30);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay]);
  return <span>{displayed}<span className="animate-pulse text-emerald-400">|</span></span>;
}

interface HomeProps {
  sessionMode?: SessionMode | null;
  onClearSession?: () => void;
  historyQuestion?: string | null;
  onHistoryLoaded?: () => void;
}

const Home: React.FC<HomeProps> = ({ sessionMode, onClearSession, historyQuestion, onHistoryLoaded }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<1|2|3>(1);
  const [yearLevel, setYearLevel] = useState<11|12>(() => {
    const saved = localStorage.getItem('turing_year_level');
    return saved === '11' ? 11 : 12;
  });

  useEffect(() => {
    localStorage.setItem('turing_year_level', String(yearLevel));
  }, [yearLevel]);
  const [courseId, setCourseId] = useState<'adv'|'mx1'|'mx2'>(() => {
    const saved = localStorage.getItem('turing_onboarding_course') || '';
    if (saved.includes('mx2') || saved.includes('Extension 2')) return 'mx2';
    if (saved.includes('mx1') || saved.includes('Extension 1')) return 'mx1';
    return 'adv';
  });
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);
  const [problemLoading, setProblemLoading] = useState(false);
  const [currentProblem, setCurrentProblem] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [feedDetails, setFeedDetails] = useState<{ topicName: string; subtopicName?: string } | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [launcherCollapsed, setLauncherCollapsed] = useState(false);
  const [filterBodyOpen, setFilterBodyOpen] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#e2e8f0');
  const [isEraser, setIsEraser] = useState(false);
  const CANVAS_HEIGHT = 3600; 
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [markingResult, setMarkingResult] = useState<{score:number;total:number;overall:string;annotations:{step:string;status:string;detail:string}[];ai:boolean}|null>(null);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const [testTimeLeft, setTestTimeLeft] = useState<number | null>(null);
  const testTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('turing_history') || '[]'); }
    catch { return []; }
  });

  const shownQuestions = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem('turing_shown_questions') || '[]')
  ));

  const activeCourse = SYLLABUS.find(c => c.id === courseId);
  const allTopics = getSyllabusTopicsForCourse(courseId);
  const currentTopic = allTopics.find(t => t.id === selectedTopicId);

  useEffect(() => {
    (async () => {
      try {
        const tk = localStorage.getItem('turing_auth_token');
        if (tk) {
          const d = await getCurrentUser(); setUser(d.user);
          if (d.user?.course) {
            const uc = d.user.course.toLowerCase();
            if (uc.includes('extension 2') || uc.includes('mx2')) setCourseId('mx2');
            else if (uc.includes('extension 1') || uc.includes('mx1')) setCourseId('mx1');
            else if (uc.includes('advanced')) setCourseId('adv');
          }
        }
      } catch { /* ok */ }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('turing_history', JSON.stringify(history));
    window.dispatchEvent(new CustomEvent('turing_history_changed'));
  }, [history]);

  useEffect(() => {
    if (historyQuestion) {
      setCurrentProblem(historyQuestion);
      setWorkspaceOpen(true);
      setLauncherCollapsed(true);
      setFilterBodyOpen(false);
      setHintText(null);
      setMarkingResult(null);
      onHistoryLoaded?.();
    }
  }, [historyQuestion]);

  const restoreCanvasImage = (base64: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !base64) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = img.width;
      canvas.height = Math.max(CANVAS_HEIGHT, img.height);
      ctx.drawImage(img, 0, 0);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
    };
    img.src = `data:image/png;base64,${base64}`;
  };

  useEffect(() => {
    if (!historyQuestion) return;
    const entry = history.find(h => h.question === historyQuestion);
    if (entry?.imageData) {
      setTimeout(() => restoreCanvasImage(entry.imageData!), 100);
    }
  }, [historyQuestion, history]);

  const h = new Date().getHours();
  const greeting = h < 5 || h >= 22 ? 'Good Evening' : h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  const name = user?.display_name || 'Student';

  const [practiceElapsed, setPracticeElapsed] = useState(0);
  const practiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionStack, setQuestionStack] = useState<string[]>([]);
  const [stackPos, setStackPos] = useState(-1);
  const [sessionId, setSessionId] = useState<string>('');  

  const ensureSessionId = () => {
    if (!sessionId) {
      const newId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setSessionId(newId);
      return newId;
    }
    return sessionId;
  };

  useEffect(() => {
    if (!sessionMode) {
      setSessionId('');
      setQuestionStack([]);
      setStackPos(-1);
    }
  }, [sessionMode]);

  useEffect(() => {
    if (sessionMode) {
      setLauncherCollapsed(false);
      setFilterBodyOpen(true);
      setQuestionIndex(0);
      setPracticeElapsed(0);
      if (sessionMode.type === 'test') {
        setTestTimeLeft(25 * 60);
      } else {
        setTestTimeLeft(null);
        practiceTimerRef.current = setInterval(() => {
          setPracticeElapsed(prev => prev + 1);
        }, 1000);
      }
      setTimeout(() => handleGenerate(), 200);
    } else {
      setTestTimeLeft(null);
      setPracticeElapsed(0);
      setQuestionIndex(0);
      if (practiceTimerRef.current) clearInterval(practiceTimerRef.current);
    }
    return () => { if (practiceTimerRef.current) clearInterval(practiceTimerRef.current); };
  }, [sessionMode]);

  useEffect(() => {
    if (testTimeLeft !== null && testTimeLeft > 0) {
      testTimerRef.current = setInterval(() => {
        setTestTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            if (testTimerRef.current) clearInterval(testTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (testTimerRef.current) clearInterval(testTimerRef.current); };
  }, [testTimeLeft !== null]);

  useEffect(() => {
    if (!workspaceOpen) return;
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    canvas.width = container.clientWidth;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [workspaceOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !workspaceOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = isEraser ? 24 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  }, [isEraser, workspaceOpen]);

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const lastSmoothRef = useRef<{x:number;y:number}|null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = isEraser ? 24 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    setIsDrawing(true);
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastSmoothRef.current = { x: pos.x, y: pos.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPos(e);
    const last = lastSmoothRef.current;
    if (!last) { lastSmoothRef.current = { x: pos.x, y: pos.y }; return; }

    const midX = (last.x + pos.x) / 2;
    const midY = (last.y + pos.y) / 2;
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    ctx.stroke();

    lastSmoothRef.current = { x: pos.x, y: pos.y };
  };

  const handlePointerUp = () => { setIsDrawing(false); lastSmoothRef.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const container = canvasContainerRef.current;
    canvas.width = container?.clientWidth || 800;
    canvas.height = CANVAS_HEIGHT;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setMarkingResult(null);
    setHintText(null);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = isEraser ? 24 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  };

  const handleMark = async () => {
    if (!currentProblem) return;
    setMarkingLoading(true);
    setMarkingResult(null);
    try {
      const canvas = canvasRef.current;
      let imageBase64: string | undefined;
      if (canvas) {
        imageBase64 = canvas.toDataURL('image/png').split(',')[1]; 
      }
      const result = await transcribeAndMark(currentProblem, imageBase64, undefined);
      setMarkingResult({
        score: result.score,
        total: result.totalMarks,
        overall: result.overall || result.feedback || '',
        annotations: (result as any).annotations || [],
        ai: (result as any).ai !== false,
      });

      let attemptId: number | undefined;
      try {
        const saved = await saveAttempt({
          session_id: ensureSessionId(),
          question_id: currentQuestionId || undefined,
          topic_id: selectedTopicId || undefined,
          subtopic: selectedSubtopic || undefined,
          problem_text: currentProblem,
          image_data: imageBase64 || undefined,
          score: result.score,
          total_marks: result.totalMarks,
          feedback: result.overall || result.feedback || '',
          input_mode: imageBase64 ? 'draw' : 'text',
        });
        attemptId = saved.attempt.id;
      } catch { /* non-critical */ }

      const normQ = currentProblem.trim().replace(/\s+/g, ' ');
      setHistory(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(h =>
          (h.question || '').trim().replace(/\s+/g, ' ') === normQ && !h.imageData
        );
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            imageData: imageBase64,
            attemptId,
            score: result.score,
          };
        }
        return updated;
      });
    } catch (err: any) {
      setMarkingResult({
        score: 0,
        total: 5,
        overall: `Marking failed: ${err?.message || 'Backend unreachable'}. Check that Flask is running on port 5000.`,
        annotations: [
          { step: 'Connection', status: 'error', detail: 'Could not reach the marking backend. Make sure the Flask server is running (python app.py in the backend/ folder).' },
          { step: 'API Key', status: 'error', detail: 'If using Gemini AI, verify GEMINI_API_KEY is set in backend/.env and is a valid key from https://aistudio.google.com/apikey' },
        ],
        ai: false,
      });
    }
    setMarkingLoading(false);
  };

  const handleHint = async () => {
    if (!currentProblem) return;
    setHintLoading(true);
    setHintText(null);
    try {
      const result = await generateHint(currentProblem, 'ai', selectedTopicId || undefined);
      setHintText(result.hint);
    } catch {
      const fallbacks = [
        'Break the problem into smaller steps. Identify what is given and what you need to find.',
        'Look for patterns or known formulas that apply to this type of problem.',
        'Try working backwards from the answer — what would the step just before the solution look like?',
        'Draw a diagram or sketch. Visual representation often reveals the approach.',
        'Check your assumptions. Are there any constraints or special cases you need to consider?',
      ];
      setHintText(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
    }
    setHintLoading(false);
  };

  useEffect(() => {
    if (!workspaceOpen) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = 420;
    }, 100);
    return () => clearTimeout(timer);
  }, [workspaceOpen, currentProblem]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleGenerate = async (directTopicId?: string, directSubtopic?: string | null, directCourse?: string) => {
    setProblemLoading(true);
    setCurrentProblem('');
    let question = '';
    let tName = '';
    let sName = '';
    let chosenTopicId = directTopicId ?? selectedTopicId;
    let chosenSubtopic = directSubtopic !== undefined ? directSubtopic : selectedSubtopic;
    const effectiveCourse = directCourse ?? courseId;

    try {
      const params: any = { course: effectiveCourse, limit: 1 };
      if (chosenTopicId) params.topic_id = chosenTopicId;
      if (chosenSubtopic) params.subtopic = chosenSubtopic;

      const result = await getNextQuestion(params);
      if (result.questions && result.questions.length > 0) {
        const q = result.questions[0];
        question = q.question_text;
        tName = q.topic_id;
        sName = q.subtopic || '';
        chosenTopicId = q.topic_id;
        chosenSubtopic = q.subtopic || null;
        setCurrentQuestionId(q.question_id);
      }
    } catch (e: any) {
      question = `API ERROR: ${e?.message || String(e)}`;
    }

    if (!question) {
      question = 'No question returned from API. Check Flask terminal for errors.';
    }

    setCurrentProblem(question);
    if (chosenTopicId && !selectedTopicId) setSelectedTopicId(chosenTopicId);
    if (chosenSubtopic && !selectedSubtopic) setSelectedSubtopic(chosenSubtopic);
    setFeedDetails({ topicName: tName, subtopicName: sName || undefined });
    setProblemLoading(false);
    setLauncherCollapsed(true);
    setFilterBodyOpen(false);
    setWorkspaceOpen(true);
    setHintText(null);
    setMarkingResult(null);
    setQuestionIndex(prev => prev + 1);

    const entry: HistoryEntry = {
      id: `h_${Date.now()}`, question,
      topicName: tName, subtopicName: sName || undefined,
      courseId: effectiveCourse as 'adv'|'mx1'|'mx2', yearLevel, createdAt: new Date(),
    };
    setHistory(prev => {
      const normQ = question.trim().replace(/\s+/g, ' ');
      const dupIdx = prev.findIndex(h => (h.question || '').trim().replace(/\s+/g, ' ') === normQ);
      if (dupIdx >= 0) { const u = [...prev]; u.splice(dupIdx, 1); return [entry, ...u]; }
      return [entry, ...prev];
    });
    setQuestionStack(prev => [...prev, question]);
    setStackPos(prev => prev + 1);
    const cvs = canvasRef.current;
    if (cvs) {
      const container = canvasContainerRef.current;
      const w = container?.clientWidth || 800;
      cvs.width = w; cvs.height = CANVAS_HEIGHT;
      const ctx = cvs.getContext('2d');
      if (ctx) { ctx.clearRect(0, 0, w, CANVAS_HEIGHT); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'source-over'; }
    }
  };

  const goToPrevQuestion = () => {
    if (stackPos <= 0) return;
    const newPos = stackPos - 1;
    setStackPos(newPos);
    setCurrentProblem(questionStack[newPos]);
    setHintText(null);
    setMarkingResult(null);
  };

  const goToNextQuestion = () => {
    if (stackPos >= questionStack.length - 1) {
      handleGenerate();
      return;
    }
    const newPos = stackPos + 1;
    setStackPos(newPos);
    setCurrentProblem(questionStack[newPos]);
    setHintText(null);
    setMarkingResult(null);
  };

  const handleTopicClick = (id: string) => {
    if (selectedTopicId === id) {
      setSelectedTopicId(null);
      setSelectedSubtopic(null);
    } else {
      setSelectedTopicId(id);
      setSelectedSubtopic(null);
    }
  };

  const expandLauncher = () => {
    setLauncherCollapsed(false);
    setFilterBodyOpen(true);
    setStep(1);
  };

  const shortCourse: Record<string, string> = { adv: 'Adv', mx1: 'Ext 1', mx2: 'Ext 2' };
  const breadcrumbSegments: { full: string; short: string }[] = [];
  if (yearLevel) breadcrumbSegments.push({ full: `Year ${yearLevel}`, short: `Y${yearLevel}` });
  if (courseId) {
    const fullCourse = { adv: 'Advanced', mx1: 'Extension 1', mx2: 'Extension 2' }[courseId];
    breadcrumbSegments.push({ full: fullCourse, short: shortCourse[courseId] });
  }
  if (feedDetails?.topicName) {
    const topicClean = feedDetails.topicName.split('(')[0].trim();
    const words = topicClean.split(' ');
    const topicShort = words.length > 2 ? words.slice(0, 2).join(' ') + '…' : topicClean;
    breadcrumbSegments.push({ full: topicClean, short: topicShort });
  }
  if (feedDetails?.subtopicName) {
    const subClean = feedDetails.subtopicName.replace(/^[A-Z0-9.]+:\s*/, '');
    const words = subClean.split(' ');
    const subShort = words.length > 3 ? words.slice(0, 3).join(' ') + '…' : subClean;
    breadcrumbSegments.push({ full: subClean, short: subShort });
  }

  if (loading) return <div className="flex items-center justify-center min-h-[70vh]"><Spinner size={32} /></div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 pb-28">

      {!sessionMode && (
        <div className="text-center space-y-3 pt-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white">
              <TypewriterText text={`${greeting}${name ? ', ' + name : ''}.`} delay={200} />
            </h1>
            {!launcherCollapsed && (
              <p className="mt-2 text-sm font-normal text-neutral-400 tracking-wide">
                Select your year, course and topic to begin.
              </p>
            )}
          </motion.div>
        </div>
      )}


      <AnimatePresence>
        {sessionMode && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="pt-6 pb-2">

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">{sessionMode.setName}</h2>
                  <p className="text-[10px] text-neutral-500">
                    {sessionMode.type === 'test' ? 'Timed Test' : 'Practice Session'} · Question {questionIndex || 1}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">

                <div className="flex items-center gap-2">
                  {sessionMode.type === 'test' ? (
                    <Timer size={14} className={testTimeLeft !== null && testTimeLeft < 300 ? 'text-red-400' : 'text-emerald-400'} />
                  ) : (
                    <Timer size={14} className="text-neutral-500" />
                  )}
                  <span className={`text-sm font-bold tabular-nums ${
                    sessionMode.type === 'test'
                      ? (testTimeLeft !== null && testTimeLeft < 300 ? 'text-red-400' : 'text-emerald-400')
                      : 'text-neutral-400'
                  }`}>
                    {sessionMode.type === 'test' ? (testTimeLeft !== null ? formatTime(testTimeLeft) : '25:00') : formatTime(practiceElapsed)}
                  </span>
                </div>

                <button onClick={onClearSession}
                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-neutral-500 hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 bg-transparent transition-colors">
                  <X size={11} /> End
                </button>
              </div>
            </div>


            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-600">Filter</span>
              {yearLevel && (
                <span className="text-[10px] font-medium text-neutral-300 bg-white/[0.03] border border-white/[0.05] px-2.5 py-1">
                  Year {yearLevel}
                </span>
              )}
              {courseId && (
                <span className="text-[10px] font-medium text-neutral-300 bg-white/[0.03] border border-white/[0.05] px-2.5 py-1">
                  {{adv:'Advanced',mx1:'Extension 1',mx2:'Extension 2'}[courseId]}
                </span>
              )}
              {selectedTopicId && currentTopic && (
                <span className="text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
                  {currentTopic.name.split('(')[0].trim()}
                </span>
              )}
              {selectedSubtopic && (
                <span className="text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
                  {selectedSubtopic.replace(/^[A-Z0-9.]+:\s*/, '')}
                </span>
              )}
              <button onClick={() => { setLauncherCollapsed(false); setFilterBodyOpen(true); }}
                className="text-[10px] font-medium text-neutral-500 hover:text-neutral-300 border-0 bg-transparent ml-1">
                Change
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {currentProblem && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mt-8 bg-[#0b0c10] border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05] bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <Hash size={13} className="text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{feedDetails?.topicName || 'Question'}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                <span>{activeCourse?.name}</span>
                {feedDetails?.subtopicName && (<><ChevronRight size={10} /><span className="text-emerald-400">{feedDetails.subtopicName}</span></>)}
              </div>
            </div>
            <div className="px-5 py-5">
              <MathRenderer text={currentProblem} className="text-base text-neutral-100 leading-relaxed" />
            </div>
            <div className="px-5 py-2.5 border-t border-white/[0.05] flex items-center gap-1">

              <button onClick={goToPrevQuestion} disabled={stackPos <= 0}
                title="Previous question"
                className="px-3 py-2 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03] border border-white/[0.05] bg-transparent transition-colors disabled:opacity-30">
                <ArrowRight size={14} className="rotate-180" />
              </button>
              <span className="text-[10px] text-neutral-600 tabular-nums mx-1">{stackPos >= 0 ? `${stackPos + 1}/${Math.max(stackPos + 1, questionStack.length)}` : '-'}</span>
              <button onClick={goToNextQuestion}
                title="Next question"
                className="px-3 py-2 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03] border border-white/[0.05] bg-transparent transition-colors">
                <ArrowRight size={14} />
              </button>
              <div className="w-px h-5 bg-white/[0.06] mx-1" />
              <button onClick={() => handleGenerate()} disabled={problemLoading}
                title="New question"
                className="px-3 py-2 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03] border border-white/[0.05] bg-transparent transition-colors">
                {problemLoading ? <Spinner size={14} /> : <RefreshCw size={14} />}
              </button>
              <button onClick={() => handleGenerate()} disabled={problemLoading}
                title="Skip"
                className="px-3 py-2 text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03] border border-white/[0.05] bg-transparent transition-colors">
                <StepForward size={14} />
              </button>
              <button title="Flag for review"
                className="px-3 py-2 text-neutral-500 hover:text-amber-400 hover:bg-amber-500/[0.04] border border-white/[0.05] hover:border-amber-500/30 bg-transparent transition-colors">
                <Flag size={14} />
              </button>
              <div className="flex-1" />
              <button onClick={() => setWorkspaceOpen(!workspaceOpen)}
                title={workspaceOpen ? 'Close workspace' : 'Open workspace'}
                className={`px-3 py-2 border transition-colors ${workspaceOpen ? 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/[0.06]' : 'text-neutral-600 border-white/[0.05] hover:text-neutral-400 hover:bg-white/[0.02]'} bg-transparent`}>
                <Zap size={14} />
              </button>
            </div>


            <AnimatePresence>
              {workspaceOpen && (
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:0.2}}
                  className="overflow-hidden">
                  <div className="border-t border-white/[0.06]">

                    <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.04] bg-white/[0.01]">
                      <button onClick={() => { setIsEraser(false); setPenColor('#e2e8f0'); }}
                        title="Pen"
                        className={`p-2 border transition-colors ${!isEraser && penColor==='#e2e8f0' ? 'text-white border-white/[0.12] bg-white/[0.04]' : 'text-neutral-500 border-white/[0.04] hover:text-neutral-300'} bg-transparent`}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setIsEraser(!isEraser)}
                        title="Eraser"
                        className={`p-2 border transition-colors ${isEraser ? 'text-white border-white/[0.12] bg-white/[0.04]' : 'text-neutral-500 border-white/[0.04] hover:text-neutral-300'} bg-transparent`}>
                        <Eraser size={14} />
                      </button>
                      <button onClick={clearCanvas}
                        title="Clear canvas"
                        className="p-2 text-neutral-500 hover:text-neutral-300 border border-white/[0.04] hover:border-white/[0.08] bg-transparent transition-colors">
                        <Trash2 size={14} />
                      </button>
                      <div className="flex-1" />
                      <button onClick={handleHint} disabled={hintLoading}
                        title="Get a hint"
                        className="px-4 py-1.5 text-[10px] font-bold text-neutral-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] bg-transparent transition-colors disabled:opacity-50 flex items-center gap-1">
                        {hintLoading ? <Spinner size={11} /> : <Lightbulb size={12} />}
                        Hint
                      </button>
                      <button onClick={handleMark} disabled={markingLoading}
                        title="Submit for AI marking"
                        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold border-0 transition-colors disabled:opacity-50 flex items-center gap-1">
                        {markingLoading ? <Spinner size={11} /> : <BadgeCheck size={12} />}
                        {markingLoading ? 'Marking…' : 'Mark'}
                      </button>
                    </div>


                    <div ref={canvasContainerRef} className="relative overflow-y-auto overflow-x-hidden" style={{
                      maxHeight: '600px',
                      backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
                      backgroundSize: '28px 28px',
                    }}>
                      <canvas
                        ref={canvasRef}
                        width={800}
                        height={CANVAS_HEIGHT}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        className="w-full block touch-none"
                        style={{ cursor: isEraser ? 'cell' : 'crosshair' }}
                      />
                    </div>


                    <AnimatePresence>
                      {hintText && (
                        <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
                          <div className="border-t border-white/[0.06] px-5 py-4 bg-amber-500/[0.03]">
                            <div className="flex items-start gap-2">
                              <Lightbulb size={13} className="text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-neutral-300 leading-relaxed">{hintText}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>


                    <AnimatePresence>
                      {markingResult && (
                        <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
                          <div className="border-t border-white/[0.06]">

                            <div className="px-5 py-5 flex items-center gap-4">
                              <div className={`w-14 h-14 flex items-center justify-center text-2xl font-bold ${
                                markingResult.score >= markingResult.total * 0.8 ? 'bg-emerald-500 text-black' :
                                markingResult.score >= markingResult.total * 0.5 ? 'bg-amber-500 text-black' :
                                'bg-red-500 text-white'
                              }`}>
                                {markingResult.score}
                              </div>
                              <div>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-lg font-bold text-white">out of {markingResult.total}</span>
                                  <span className="text-[11px] text-neutral-500">
                                    ({Math.round(markingResult.score / markingResult.total * 100)}%)
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <BadgeCheck size={12} className="text-emerald-400" />
                                  <span className="text-[10px] text-emerald-400/80">
                                    {markingResult.ai ? 'AI-graded by Gemini' : 'Deterministic rubric'}
                                  </span>
                                </div>
                              </div>
                            </div>


                            <div className="border-t border-white/[0.05] px-5 py-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Feedback</span>
                              </div>
                              <p className="text-[13px] text-neutral-200 leading-relaxed">{markingResult.overall}</p>
                            </div>


                            {markingResult.annotations && markingResult.annotations.length > 0 && (
                              <div className="border-t border-white/[0.05]">
                                <div className="px-5 py-2.5">
                                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                    Step Breakdown ({markingResult.annotations.length})
                                  </span>
                                </div>
                                <div className="divide-y divide-white/[0.03]">
                                  {markingResult.annotations.map((a, i) => (
                                    <div key={i} className="px-5 py-3">
                                      <div className="flex items-start gap-3">

                                        <div className={`shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold ${
                                          a.status === 'correct'
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-red-500/20 text-red-400'
                                        }`}>
                                          {i + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[12px] font-semibold ${
                                              a.status === 'correct' ? 'text-white' : 'text-red-200'
                                            }`}>{a.step}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 border ${
                                              a.status === 'correct'
                                                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.04]'
                                                : 'text-red-400 border-red-500/30 bg-red-500/[0.04]'
                                            }`}>
                                              {a.status === 'correct' ? 'CORRECT' : 'ERROR'}
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-neutral-400 leading-relaxed">{a.detail}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>




      <AnimatePresence mode="wait">
        {launcherCollapsed ? (
          /* ── Collapsed breadcrumb bar ── */
          <motion.div key="collapsed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-0 left-56 right-0 z-40 px-6 pb-3"
          >
            <div className="bg-[#0a0a0c] border border-white/[0.06] px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
              <button onClick={expandLauncher}
                className="flex items-center gap-2 text-left border-0 bg-transparent hover:bg-white/[0.02] px-2 py-1 transition-colors group">
                <Edit3 size={13} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                <div className="flex items-center gap-1.5 text-xs min-w-0">
                  {breadcrumbSegments.map((seg, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight size={11} className="text-neutral-700 shrink-0" />}
                      <span className={`truncate max-w-[100px] sm:max-w-none ${i === breadcrumbSegments.length - 1 ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}`}>
                        <span className="hidden sm:inline">{seg.full}</span>
                        <span className="inline sm:hidden">{seg.short}</span>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </button>
              <div className="flex items-center gap-2">
                {sessionMode?.type === 'test' && testTimeLeft !== null && (
                  <span className={`text-xs font-bold tabular-nums mr-2 ${testTimeLeft < 300 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatTime(testTimeLeft)}
                  </span>
                )}
                <button onClick={() => handleGenerate()} disabled={problemLoading}
                  className="px-4 py-1.5 bg-white text-black text-[11px] font-semibold border-0 hover:bg-neutral-200 transition-colors disabled:opacity-40">
                  {problemLoading ? <Spinner size={12} /> : 'New'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Full expanded launcher ── */
          <motion.div key="expanded"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-0 left-56 right-0 z-40 px-6 pb-3"
          >
            <div className="bg-[#0a0a0c] border border-white/[0.05] overflow-hidden max-w-4xl mx-auto">

              <div className="flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => setFilterBodyOpen(!filterBodyOpen)}
                    className="text-neutral-600 hover:text-neutral-400 border-0 bg-transparent p-0.5 transition-colors"
                    title={filterBodyOpen ? 'Minimize filters' : 'Expand filters'}>
                    {filterBodyOpen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                  <span className="text-[10px] font-semibold text-neutral-500">
                    {step===1?'Select filters':(
                      <span className="flex items-center gap-1.5">
                        <span>Year {yearLevel}</span>
                        <ChevronRight size={10} className="text-neutral-700" />
                        <span>{{adv:'Advanced',mx1:'Extension 1',mx2:'Extension 2'}[courseId]}</span>
                        {selectedTopicId && (
                          <><ChevronRight size={10} className="text-neutral-700" />
                          <span>{currentTopic?.name.split('(')[0].trim().replace(/\b(\w)(\w+)\b/g,(_,a,b)=>a.toUpperCase()+b.toLowerCase())}</span></>
                        )}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {step>1&&(
                    <button onClick={() => { setStep(1); setCourseId('adv'); setSelectedTopicId(null); setSelectedSubtopic(null); }}
                      className="text-[10px] font-medium text-neutral-600 hover:text-neutral-400 border-0 bg-transparent uppercase tracking-[0.1em]">Clear</button>
                  )}
                </div>
              </div>


              <AnimatePresence>
                {filterBodyOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                    <div className="flex border-t border-white/[0.04]">

                      <div className="w-[140px] shrink-0 border-r border-white/[0.04] py-3">
                        {[
                          {id:1,label:'Year',active:step===1},
                          {id:2,label:'Course',active:step===2},
                          {id:3,label:'Topics',active:step===3},
                        ].map(cat => (
                          <button key={cat.id}
                            onClick={() => { if(cat.id<=step) setStep(cat.id as 1|2|3); }}
                            disabled={cat.id>step}
                            className={`w-full text-left px-4 py-2.5 text-[12px] font-medium border-0 transition-colors ${
                              cat.active?'text-white':'text-neutral-600'
                            } ${cat.id>step?'cursor-not-allowed opacity-40':'hover:text-neutral-400 cursor-pointer'}`}>
                            {cat.label}
                          </button>
                        ))}
                      </div>


                      <div className="flex-1 p-4 min-h-[120px] max-h-[200px] overflow-y-auto">
                        {step===1&&(
                          <div className="space-y-1">
                            <p className="text-[11px] text-neutral-500 mb-3">Select your year level</p>
                            {([11,12] as const).map(y => (
                              <button key={y} onClick={() => { setYearLevel(y); setStep(2); }}
                                className={`w-full text-left px-4 py-2 text-[13px] border transition-colors no-round ${
                                  yearLevel===y
                                    ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                                    : 'bg-white/[0.01] border-white/[0.04] text-neutral-400 hover:border-white/[0.08] hover:text-neutral-300'
                                }`}>
                                Year {y}
                              </button>
                            ))}
                          </div>
                        )}
                        {step===2&&(
                          <div className="space-y-1">
                            <p className="text-[11px] text-neutral-500 mb-3">Select your course</p>
                            {(['adv','mx1','mx2'] as const).map(c => (
                              <button key={c} onClick={() => { setCourseId(c); setSelectedTopicId(null); setSelectedSubtopic(null); setStep(3); }}
                                className={`w-full text-left px-4 py-2 text-[13px] border transition-colors no-round ${
                                  courseId===c
                                    ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                                    : 'bg-white/[0.01] border-white/[0.04] text-neutral-400 hover:border-white/[0.08] hover:text-neutral-300'
                                }`}>
                                <span>{{adv:'Advanced',mx1:'Extension 1',mx2:'Extension 2'}[c]}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {step===3&&(
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-neutral-500 mb-2">
                              Topics <span className="text-neutral-700 mx-1">→</span> 
                              {courseId === 'mx2' ? 'Ext 1 + Ext 2' : courseId === 'mx1' ? 'Advanced + Ext 1' : 'Advanced'}
                            </p>
                            {allTopics.map(t => (
                              <button key={t.id} onClick={() => { handleTopicClick(t.id); handleGenerate(t.id, null, courseId); }}
                                className={`w-full text-left px-4 py-2 text-[13px] border transition-colors no-round ${
                                  selectedTopicId===t.id
                                    ? 'bg-emerald-500/15 border-emerald-500/60 text-white'
                                    : 'bg-white/[0.01] border-white/[0.04] text-neutral-400 hover:border-white/[0.08] hover:text-neutral-300'
                                }`}>
                                {t.name.split('(')[0].trim()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>


                    {step>=2&&(
                      <div className="border-t border-white/[0.04] px-5 py-3 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-600">
                          {selectedTopicId ? currentTopic?.name.split('(')[0].trim() : 'Select a topic'}
                          {selectedSubtopic ? ` → ${selectedSubtopic.replace(/^[A-Z0-9.]+:\\s*/, '')}` : ''}
                        </span>
                        <button onClick={() => handleGenerate()} disabled={problemLoading}
                          className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-bold border-0 transition-colors disabled:opacity-40">
                          {problemLoading ? <Spinner size={12} /> : currentProblem ? 'Next Question' : 'Generate'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
