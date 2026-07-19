import React, { useState, useRef, useEffect } from 'react';
import { transcribeAndMark } from '../services/geminiService';
import { getNextQuestion } from '../services/api';
import { SYLLABUS, SyllabusTopic } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { MathRenderer, autoFormatMath } from './MathRenderer';
import { CheckCircle2, Loader2, RefreshCw, Compass, Trash2, Star, PenTool, Keyboard, Upload, Lightbulb, Clock, ChevronRight, Sparkles, Zap, BookOpen, Hash, Search } from 'lucide-react';

const TOPIC_GUIDES: Record<string, { desc: string; tip: string }> = {
  'ma-f1': { desc: 'Functions, absolute values, domain/range.', tip: 'Graphing is key. Watch for denominators = 0 and negative square roots.' },
  'ma-t1': { desc: 'Radian measure, sector areas, trig identities.', tip: '180 = pi rad. Draw the unit circle for exact ratios.' },
  'ma-c1': { desc: 'Rates of change, first-principles derivatives.', tip: 'First principles: lim (f(x+h)-f(x))/h. Simplify fully.' },
  'ma-e1': { desc: 'Exponential & logarithmic functions, base e.', tip: 'y = e^x and y = ln(x) are inverses. Use log laws.' },
  'ma-s1': { desc: 'Probability models, Venn diagrams, discrete RVs.', tip: 'Sum P(X=x) = 1. E(X) = sum x*P(X=x).' },
  'ma-f2': { desc: 'Advanced graphing transformations.', tip: 'Sum y-values per x for ordinates. Transform outer to inner.' },
  'ma-t2': { desc: 'Trig function graphs, amplitude, period.', tip: 'y = A sin(Bx-C)+D: period = 2pi/B, shift = C/B.' },
  'ma-c234': { desc: 'Transcendental calculus, optimisation, integration.', tip: 'Set derivative = 0 for stationary points. Check 2nd derivative.' },
  'ma-m1': { desc: 'Arithmetic & geometric progressions, finance.', tip: 'Annuities are geometric series. Watch compounding periods.' },
  'ma-s23': { desc: 'Descriptive stats, continuous RVs, normal dist.', tip: 'PDF integrates to 1. Use z-scores to normalise.' },
  'me-f1': { desc: 'Inverse functions, graphing rational functions, polynomials.', tip: 'y = 1/f(x) has asymptotes where f(x) = 0. Use Remainder & Factor Theorems.' },
  'me-t12': { desc: 'Reciprocal trig (sec/cosec/cot), compound & double angles, t-formulae.', tip: 'Let t = tan(theta/2) to turn trig equations into quadratics.' },
  'me-c1': { desc: 'Related rates, implicit differentiation.', tip: 'dy/dt = (dy/dx)(dx/dt). Chain rule links rates of change.' },
  'me-a1': { desc: 'Circular permutations, Pigeonhole, Binomial Theorem.', tip: 'n around a circle: (n-1)! arrangements. Sum of nCr = 2^n.' },
  'me-p1': { desc: 'Proof by mathematical induction.', tip: 'Base (n=1), assume (n=k), prove (n=k+1) using the assumption.' },
  'me-v1': { desc: '2D vectors, scalar product, projections, projectile motion.', tip: 'Perpendicular means dot = 0. proj_v u = (u·v)/|v|^2 * v.' },
  'me-t3': { desc: 'Inverse trig functions, auxiliary angle method.', tip: 'arcsin domain [-1,1], range [-pi/2, pi/2]. a cos x + b sin x = R cos(x-α).' },
  'me-c23': { desc: 'Integration substitution, volumes, differential equations, kinematics.', tip: 'Volume = pi*integral y^2 dx. Adjust limits when substituting.' },
  'me-s1': { desc: 'Binomial distribution, normal approximation.', tip: 'P(X=k) = nCk p^k q^(n-k). Mean = np, Variance = npq.' },
  'mex-p12': { desc: 'Proof, AM-GM inequality, further induction.', tip: '(a+b)/2 >= sqrt(ab) for positives. Test boundaries.' },
  'mex-v1': { desc: '3D vectors, lines, skew lines, planes.', tip: 'Skew lines not parallel and do not intersect.' },
  'mex-n12': { desc: 'Complex numbers, Argand, De Moivre, loci.', tip: 'e^(i*theta) = cos(theta) + i sin(theta) for fast polar multiplication.' },
  'mex-c1': { desc: 'Integration by parts, partial fractions, reduction.', tip: 'Integral u dv = uv - integral v du. Choose u via LIATE rule.' },
  'mex-m1': { desc: 'Work, energy, resisted motion, circular motion.', tip: 'Resisted motion: set F = ma, integrate dv/dt or v dv/dx.' },
};

const FEATURED_LATEX: Record<string, string[]> = {
  'ma-f1': ["Determine the domain and range of $f(x) = \\frac{1}{\\sqrt{x^2 - 16}}$ and sketch its graph.", "Solve $|2x - 3| = x + 5$ and verify solutions algebraically."],
  'ma-t1': ["Prove: $$\\frac{\\sin \\theta}{1 - \\cos \\theta} + \\frac{1 - \\cos \\theta}{\\sin \\theta} = 2 \\csc \\theta$$", "Solve $2 \\cos^2\\theta - 1 = 0$ for $0 \\le \\theta \\le 2\\pi$."],
  'ma-c234': ["**(a)** By differentiating $e^{\\ln x} = x$ for $x>0$, show $\\frac{d}{dx}(\\ln x) = \\frac{1}{x}$. *(2 marks)*\n\n**(b)** Hence show $y = \\frac{\\ln(3x)}{x^2}$ has a stationary point at $x = \\frac{\\sqrt{e}}{3}$. *(3 marks)*", "Find the maximum of $y = x e^{-x}$ for $x \\ge 0$."],
  'me-p1': ["Prove by induction: $1^2+2^2+\\cdots+n^2 = \\frac{n(n+1)(2n+1)}{6}$.", "Prove $3^{2n} - 1$ is divisible by 8 for all $n \\ge 1$."],
  'me-t3': ["Evaluate the exact value of $\\cos(\\arcsin(-\\frac{1}{2}) + \\arctan(\\sqrt{3}))$.", "State the domain and range of $f(x) = 2\\arcsin(3x-1)$ and sketch its graph."],
  'me-c23': ["Use the substitution $u = \\sin x$ to evaluate $\\int \\sin^2 x \\cos^3 x\\,dx$.", "Find the volume when the region bounded by $y = \\frac{1}{x}$, $x = 1$, $x = 3$, and the x-axis is rotated about the x-axis."],
};

interface ProblemsProps { selectedTopicId?: string | null; onSelectTopic?: (id: string | null) => void; }

const Problems: React.FC<ProblemsProps> = ({ selectedTopicId: externalTopicId, onSelectTopic }) => {
  const [courseId, setCourseId] = useState<'adv' | 'mx1' | 'mx2'>('adv');
  const [localTopicId, setLocalTopicId] = useState<string | null>(null);
  const selectedTopicId = externalTopicId ?? localTopicId;
  const setSelectedTopicId = (id: string | null) => { setLocalTopicId(id); onSelectTopic?.(id); };
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [problemLoading, setProblemLoading] = useState(false);
  const [currentProblem, setCurrentProblem] = useState('');
  const [result, setResult] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isExplorerExpanded, setIsExplorerExpanded] = useState(false);
  const [isAllTopicsSelected, setIsAllTopicsSelected] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [isStarred, setIsStarred] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [activeInputMode, setActiveInputMode] = useState<'draw' | 'text' | 'upload'>('draw');
  const [typedAnswer, setTypedAnswer] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showHintIndex, setShowHintIndex] = useState<number | null>(null);
  const [aiHintLoading, setAiHintLoading] = useState(false);
  const [dynamicAiHint, setDynamicAiHint] = useState<string | null>(null);
  const [feedDetails, setFeedDetails] = useState<{ topicName: string; subtopicName?: string } | null>(null);

  const activeCourse = SYLLABUS.find(c => c.id === courseId);
  const currentTopic = activeCourse?.sections.flatMap(s => s.topics).find(t => t.id === selectedTopicId);

  useEffect(() => { if (!isTimerActive) return; const i = setInterval(() => setTimerSeconds(p => p + 1), 1000); return () => clearInterval(i); }, [isTimerActive]);
  const fmt = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  const handleGetAiHint = async () => {
    if (aiHintLoading) return; setAiHintLoading(true);
    try { const r = await fetch('/api/generate-hint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problemDescription: currentProblem }) }); const d = await r.json(); setDynamicAiHint(d.hint || 'Try a variable substitution.'); setShowHintIndex(2); }
    catch { setDynamicAiHint('Try a variable substitution or split into separate terms.'); setShowHintIndex(2); }
    finally { setAiHintLoading(false); }
  };

  const getHintsForProblem = (): string[] => { const g = currentTopic ? TOPIC_GUIDES[currentTopic.id] : null; return [g?.desc || 'Review the relevant NESA syllabus dot point.', g?.tip || 'Break the problem into smaller steps and apply the relevant formula.', dynamicAiHint || 'Loading Turing AI hint...']; };

  const handleGenerateProblem = async (topicOverride?: SyllabusTopic, subtopicOverride?: string | null) => {
    setProblemLoading(true); setResult(null); clearCanvas();
    setTimerSeconds(0); setIsTimerActive(true); setIsStarred(false);
    setShowHintIndex(null); setDynamicAiHint(null); setTypedAnswer(''); setUploadedImage(null);

    const courseMap: Record<string, string> = { adv: 'adv', mx1: 'mx1', mx2: 'mx2' };
    let question = '', tName = '', sName = '';

    let chosenTopicId: string | null = null;
    let chosenSubtopic: string | null = null;
    const allTopics = activeCourse?.sections.flatMap(s => s.topics) || [];

    if (isAllTopicsSelected || selectedTopicIds.size > 0) {
      const pool = isAllTopicsSelected
        ? allTopics
        : allTopics.filter(t => selectedTopicIds.has(t.id));
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        chosenTopicId = pick.id;
        const subs = pick.subtopics || [];
        chosenSubtopic = subs.length > 0 && Math.random() > 0.4 ? subs[Math.floor(Math.random() * subs.length)] : null;
      }
    } else {
      const t = topicOverride || currentTopic;
      if (t) {
        chosenTopicId = t.id;
        chosenSubtopic = subtopicOverride !== undefined ? subtopicOverride : selectedSubtopic;
      }
    }

    try {
      const params: any = { course: courseMap[courseId], limit: 1 };
      if (chosenTopicId) params.topic_id = chosenTopicId;
      if (chosenSubtopic) params.subtopic = chosenSubtopic;

      const result = await getNextQuestion(params);
      if (result.questions && result.questions.length > 0) {
        const q = result.questions[0];
        question = q.question_text;
        tName = q.topic_id;
        sName = q.subtopic || '';
      }
    } catch {
    }

    if (!question) {
      let pool: string[] = [];
      const t = chosenTopicId ? allTopics.find(tp => tp.id === chosenTopicId) : (topicOverride || currentTopic);
      if (t) {
        tName = t.name;
        const sub = chosenSubtopic || selectedSubtopic;
        if (sub && t.problemsBySubtopic?.[sub]) { pool = t.problemsBySubtopic[sub]; sName = sub; }
        else pool = t.problems;
      } else if (allTopics.length > 0) {
        const ft = allTopics[Math.floor(Math.random() * allTopics.length)];
        tName = ft.name; pool = ft.problems;
        setSelectedTopicId(ft.id); setSelectedSubtopic(ft.subtopics?.[0] || null);
      }
      if (pool.length > 0) question = autoFormatMath(pool[Math.floor(Math.random() * pool.length)]);
    }

    const matchingTopic = allTopics.find(t => t.id === tName || t.name === tName);
    setCurrentProblem(question || 'Could not load a problem.');
    setFeedDetails({ topicName: matchingTopic?.name || tName || 'Unknown', subtopicName: sName || undefined });
    setProblemLoading(false);
  };

  useEffect(() => { if (selectedTopicId && currentTopic) { if (!selectedSubtopic || !currentTopic.subtopics?.includes(selectedSubtopic)) { setSelectedSubtopic(currentTopic.subtopics?.[0] || null); handleGenerateProblem(currentTopic, currentTopic.subtopics?.[0] || null); } } else setSelectedSubtopic(null); }, [selectedTopicId]);

  useEffect(() => { const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return; ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.fillStyle = '#090a0e'; ctx.fillRect(0, 0, c.width, c.height); }, []);
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => { setIsDrawing(true); draw(e); };
  const endDrawing = () => { setIsDrawing(false); canvasRef.current?.getContext('2d')?.beginPath(); };
  const draw = (e: React.MouseEvent | React.TouchEvent) => { if (!isDrawing || !canvasRef.current) return; const ctx = canvasRef.current.getContext('2d'); if (!ctx) return; const rect = canvasRef.current.getBoundingClientRect(); const sx = canvasRef.current.width / rect.width, sy = canvasRef.current.height / rect.height; let x: number, y: number; if ('touches' in e) { e.preventDefault(); x = (e.touches[0].clientX - rect.left) * sx; y = (e.touches[0].clientY - rect.top) * sy; } else { x = (e.clientX - rect.left) * sx; y = (e.clientY - rect.top) * sy; } ctx.lineTo(x, y); ctx.stroke(); };
  const clearCanvas = () => { const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return; ctx.fillStyle = '#090a0e'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 2.5; setResult(null); };

  const handleMark = async () => { if (!currentProblem) return; setLoading(true); setIsTimerActive(false); try { let resp; if (activeInputMode === 'text') { if (!typedAnswer.trim()) { setLoading(false); setIsTimerActive(true); return; } resp = await transcribeAndMark(currentProblem, undefined, typedAnswer); } else if (activeInputMode === 'draw') { if (!canvasRef.current) return; resp = await transcribeAndMark(currentProblem, canvasRef.current.toDataURL('image/png')); } else { if (!uploadedImage) { setLoading(false); setIsTimerActive(true); return; } resp = await transcribeAndMark(currentProblem, uploadedImage); } setResult(resp); } catch (e) { } finally { setLoading(false); } };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setUploadedImage(ev.target?.result as string); r.readAsDataURL(f); } };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setUploadedImage(ev.target?.result as string); r.readAsDataURL(f); } };
  const insertLatexSymbol = (s: string) => { const ta = document.getElementById('latex-textarea') as HTMLTextAreaElement; if (!ta) return; const st = ta.selectionStart, se = ta.selectionEnd; setTypedAnswer(typedAnswer.substring(0, st) + s + typedAnswer.substring(se)); requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = st + s.length; }); };

  const hasActiveSelection = selectedTopicId || isAllTopicsSelected || selectedTopicIds.size > 0 || currentProblem;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 pb-32">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div><h1 className="text-3xl font-black text-white">Practise</h1><p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mt-0.5">NSW syllabus question engine</p></div>
        <div className="flex bg-white/[0.03] border border-white/10 rounded-lg p-1 gap-0.5">
          {(['adv','mx1','mx2'] as const).map(c => (<button key={c} onClick={() => { setCourseId(c); setSelectedTopicId(null); setSelectedSubtopic(null); setIsAllTopicsSelected(false); setSelectedTopicIds(new Set()); }} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all border-0 ${courseId === c ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}>{{adv:'Advanced',mx1:'Ext 1',mx2:'Ext 2'}[c]}</button>))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!hasActiveSelection ? (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="min-h-[420px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center mb-6 text-emerald-400"><Compass size={28} /></div>
            <h2 className="text-3xl font-black text-white mb-3">Select a Topic</h2>
            <p className="text-sm text-neutral-400 max-w-sm mb-8">Browse the NSW syllabus or blend topics to start solving curriculum-aligned problems.</p>
            <button onClick={() => setIsExplorerExpanded(true)} className="px-6 py-3 bg-white text-black text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-white/20"><Search size={14} /> Browse Syllabus</button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="space-y-5">
            <div className="bg-[#0b0c10] border border-white/10 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.015]">
                <div className="flex items-center gap-2"><Hash size={13} className="text-emerald-400" /><span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{currentTopic?.name || 'Current Problem'}</span></div>
                <div className="flex items-center gap-2"><span className="mono-font text-[10px] text-neutral-500 flex items-center gap-1"><Clock size={11} /> {fmt(timerSeconds)}</span><button onClick={() => setIsStarred(!isStarred)} className={`p-1.5 ${isStarred ? 'text-yellow-400' : 'text-neutral-500 hover:text-white'}`}><Star size={13} fill={isStarred ? 'currentColor' : 'none'} /></button><button onClick={() => handleGenerateProblem()} disabled={problemLoading} className="p-1.5 text-neutral-500 hover:text-white"><RefreshCw size={13} className={problemLoading ? 'animate-spin' : ''} /></button></div>
              </div>
              <div className="px-6 py-5">{problemLoading ? (<div className="flex items-center gap-3 py-8 justify-center"><Loader2 size={20} className="animate-spin text-emerald-400" /><span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Loading...</span></div>) : (<MathRenderer text={currentProblem} className="text-base text-neutral-100 leading-relaxed" />)}</div>
              <div className="px-6 py-2.5 border-t border-white/5 bg-white/[0.01] flex items-center gap-1.5 text-[10px] text-neutral-500"><span>{activeCourse?.sections[0]?.name || 'Year 11 & 12'}</span><ChevronRight size={10} /><span className="text-neutral-400 font-medium">{activeCourse?.name}</span>{feedDetails?.subtopicName && (<><ChevronRight size={10} /><span className="text-emerald-400 font-medium">{feedDetails.subtopicName}</span></>)}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[{ idx:0, label:'Core Concept', icon:BookOpen, desc:'NESA syllabus reference', color:'border-emerald-500/20 bg-emerald-500/[0.06]' },{ idx:1, label:'Strategy Tip', icon:Zap, desc:'Keyword-based guidance', color:'border-emerald-500/20 bg-emerald-500/[0.06]' },{ idx:2, label:'Ask Turing AI', icon:Sparkles, desc:'Dynamic AI-generated hint', color:'border-emerald-500/20 bg-emerald-500/[0.06]' }].map(h => { const isOpen = showHintIndex === h.idx; return (<button key={h.idx} onClick={async () => { if (h.idx === 2 && !dynamicAiHint) await handleGetAiHint(); else setShowHintIndex(isOpen ? null : h.idx); }} disabled={h.idx === 2 && aiHintLoading} className={`p-4 border rounded-lg text-left transition-all hover:border-white/15'}`}><div className="flex items-center gap-2"><h.icon size={14} className={isOpen ? 'text-white' : 'text-neutral-400'} /><span className="text-[10px] font-bold uppercase tracking-wider text-neutral-200">{h.label}</span>{h.idx === 2 && aiHintLoading && <Loader2 size={11} className="animate-spin ml-auto" />}</div><p className={`text-[10px] mt-1.5 leading-relaxed ${isOpen ? 'text-neutral-200' : 'text-neutral-500'}`}>{isOpen ? getHintsForProblem()[h.idx] : h.desc}</p></button>); })}
            </div>

            <div className="flex bg-[#0b0c10] border border-white/10 rounded-lg p-1 gap-1 self-start">
              {[{ id:'draw' as const, icon:PenTool, label:'Ink' },{ id:'text' as const, icon:Keyboard, label:'Type' },{ id:'upload' as const, icon:Upload, label:'Upload' }].map(m => (<button key={m.id} onClick={() => setActiveInputMode(m.id)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeInputMode === m.id ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}><m.icon size={12} /> {m.label}</button>))}
            </div>

            <div className="bg-[#0b0c10] border border-white/10 rounded-lg overflow-hidden">
              {activeInputMode === 'draw' && (<div className="relative"><div className="absolute top-3 left-3 z-10 bg-black/60 text-[8px] font-bold text-emerald-400 uppercase px-2.5 py-1 border border-white/10 pointer-events-none tracking-wider">Handwriting Canvas</div><canvas ref={canvasRef} width={1000} height={420} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseOut={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} className="w-full cursor-crosshair bg-[#08090d]" /></div>)}
              {activeInputMode === 'text' && (<div className="p-5 space-y-4"><div className="flex items-center justify-between border-b border-white/5 pb-3"><span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">LaTeX Math Input</span><span className="text-[9px] text-neutral-500 mono-font">$...$ for inline math</span></div><div className="flex flex-wrap gap-1 bg-black/40 p-2.5 border border-white/5">{[['\\frac{a}{b}','Frac'],['\\sqrt{x}','Sqrt'],['x^2','x^2'],['\\theta','th'],['\\pi','pi'],['\\int','int'],['\\sum','sum'],['\\infty','inf'],['\\lim','lim']].map(([code,label]) => (<button key={code} onClick={() => insertLatexSymbol(code)} className="px-2 py-1 text-[9px] font-bold mono-font bg-white/5 border border-white/5 text-neutral-300 hover:text-white hover:bg-white/10 transition-all">{label}</button>))}</div><textarea id="latex-textarea" value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)} placeholder="Type your working out using $...$ for math." className="w-full h-36 bg-black/50 border border-white/5 p-4 text-xs mono-font text-neutral-200 resize-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20" />{typedAnswer.trim() && (<div className="bg-black/50 border border-white/5 p-4"><h4 className="text-[8px] font-bold uppercase text-neutral-500 tracking-widest mb-2">Live Preview</h4><MathRenderer text={typedAnswer} className="text-xs text-neutral-200 leading-relaxed" /></div>)}</div>)}
              {activeInputMode === 'upload' && (<div className="p-5 space-y-4"><div className="border border-dashed border-white/20 hover:border-emerald-400/40 bg-black/20 p-10 flex flex-col items-center justify-center cursor-pointer relative" onDragOver={handleDragOver} onDrop={handleDrop}><input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />{uploadedImage ? (<div className="flex flex-col items-center gap-3"><img src={uploadedImage} alt="Upload" className="max-h-48 object-contain border border-white/10" /><p className="text-[9px] font-bold text-neutral-400 mono-font">Worksheet loaded</p><button onClick={e => { e.stopPropagation(); setUploadedImage(null); }} className="px-3 py-1.5 text-[8px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 uppercase">Remove</button></div>) : (<><Upload size={28} className="text-emerald-400 mb-3" /><p className="text-[11px] font-bold text-neutral-200 uppercase">Drop worksheet image</p><p className="text-[10px] text-neutral-500 mt-1">or click to browse</p></>)}</div></div>)}

              <div className="flex gap-3 px-5 py-4 border-t border-white/5 bg-white/[0.01]">
                <button onClick={() => { if (activeInputMode === 'draw') clearCanvas(); else if (activeInputMode === 'text') { setTypedAnswer(''); setResult(null); } else { setUploadedImage(null); setResult(null); } }} className="px-5 py-2.5 text-[10px] font-bold border border-white/10 rounded-md rounded-md text-neutral-400 hover:text-white uppercase tracking-wider">Clear</button>
                <button onClick={handleMark} disabled={loading} className="flex-1 py-2.5 text-xs font-bold bg-emerald-500 rounded-md rounded-md hover:bg-emerald-400 text-white uppercase tracking-wider flex items-center justify-center gap-2 border-0 transition-colors">{loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{loading ? 'Evaluating...' : 'Submit & Check'}</button>
              </div>
            </div>

            {result && (<motion.div initial={{ opacity:0, scale:0.98 }} animate={{ opacity:1, scale:1 }} className="bg-[#0b0c10] border border-white/10 rounded-lg overflow-hidden"><div className="flex items-center justify-between px-6 py-4 border-b border-white/5"><div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /><span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">Assessment</span></div><div className={`text-2xl font-black mono-font flex items-baseline gap-1 ${result.score >= 4 ? 'text-emerald-400' : result.score >= 2 ? 'text-emerald-400' : 'text-red-400'}`}>{result.score}<span className="text-sm text-neutral-500 font-medium">/{result.totalMarks || 5}</span></div></div><div className="p-5 space-y-4">{result.transcription && (<div><h4 className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider mb-2">Transcription</h4><div className="bg-black/50 border border-white/5 p-4 text-xs text-neutral-300 mono-font whitespace-pre-wrap max-h-48 overflow-y-auto">{result.transcription}</div></div>)}{result.feedback && (<div><h4 className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider mb-2">Feedback</h4><div className="bg-emerald-500/[0.03] border border-emerald-500/10 p-4"><MathRenderer text={result.feedback} className="text-sm text-neutral-200 leading-relaxed" /></div></div>)}{result.steps?.length > 0 && (<div><h4 className="text-[9px] font-bold uppercase text-neutral-500 tracking-wider mb-2">Steps</h4><div className="space-y-2">{result.steps.map((s:string, i:number) => (<div key={i} className="flex gap-3 items-start bg-black/30 border border-white/5 p-3"><span className="text-emerald-400 mono-font text-[10px] font-bold w-5 h-5 bg-emerald-400/10 flex items-center justify-center shrink-0">{i+1}</span><MathRenderer text={s} className="text-xs text-neutral-300" /></div>))}</div></div>)}</div></motion.div>)}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-neutral-900/95 border border-white/10 backdrop-blur-xl px-5 py-3 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-2.5 pr-3 border-r border-white/[0.08]">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <BookOpen size={12} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-neutral-200 leading-tight">
              {{adv:'Advanced Mathematics',mx1:'Extension 1',mx2:'Extension 2'}[courseId]}
            </p>
            <p className="text-[9px] text-neutral-500 font-medium">
              {isAllTopicsSelected ? 'All topics blended' : selectedTopicIds.size > 0 ? `${selectedTopicIds.size} topics selected` : currentTopic ? currentTopic.name : 'NSW HSC 2026'}
            </p>
          </div>
        </div>
        <button onClick={() => handleGenerateProblem()} disabled={problemLoading} className="ml-auto px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-colors border-0 flex items-center gap-1.5">
          {problemLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {problemLoading ? 'Loading...' : 'Generate'}
        </button>
        <button onClick={() => setIsExplorerExpanded(!isExplorerExpanded)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${isExplorerExpanded ? 'bg-white text-black' : 'bg-white/[0.05] text-neutral-400 hover:text-white'} rounded-xl transition-colors border-0`}><Search size={13} /> {isExplorerExpanded ? 'Close' : 'Explore'}</button>
        <button onClick={() => handleGenerateProblem()} disabled={problemLoading} className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white"><RefreshCw size={13} className={problemLoading ? 'animate-spin' : ''} /></button>
        <button onClick={clearCanvas} className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white"><Trash2 size={13} /></button>
      </div>

      <AnimatePresence>
        {isExplorerExpanded && (<>
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setIsExplorerExpanded(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30" />
          <motion.div initial={{ opacity:0, scale:0.97, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.97, y:20 }} className="fixed inset-0 z-40 flex items-center justify-center p-6">
            <div className="bg-[#0b0c10] border border-white/[0.08] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
              <div className="px-6 py-5 border-b border-white/[0.06]"><h3 className="text-lg font-bold text-white">Select your year, course and topic</h3><p className="text-xs text-neutral-500 mt-1">Choose below and press Generate to get a curriculum-aligned question.</p></div>
              <div className="p-6 space-y-5">
                <div><span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2 block">Year</span><div className="flex gap-2">{['Year 11','Year 12'].map((y,i) => (<button key={y} onClick={() => { setCourseId((i===0?'adv':'mx2') as any); setSelectedTopicId(null); setSelectedSubtopic(null); }} className={`px-5 py-2.5 text-xs font-semibold border rounded-md transition-colors ${((i===0&&courseId==='adv')||(i===1&&courseId==='mx2')) ? 'bg-emerald-500/15 border-emerald-500/30 rounded-md text-emerald-300' : 'bg-white/[0.02] border-white/[0.06] rounded-md text-neutral-400 hover:text-white hover:border-white/15'}`}>{y}</button>))}</div></div>
                <div><span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2 block">Course</span><div className="flex flex-wrap gap-2">{([{ id:'adv' as const, label:'Advanced' },{ id:'mx1' as const, label:'Extension 1' },{ id:'mx2' as const, label:'Extension 2' }]).map(c => (<button key={c.id} onClick={() => { setCourseId(c.id); setSelectedTopicId(null); setSelectedSubtopic(null); }} className={`px-4 py-2 text-xs font-semibold border rounded-md transition-colors ${courseId === c.id ? 'bg-emerald-500/15 border-emerald-500/30 rounded-md text-emerald-300' : 'bg-white/[0.02] border-white/[0.06] rounded-md text-neutral-400 hover:text-white hover:border-white/15'}`}>{c.label}</button>))}</div></div>
                <div><span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2 block">Topics</span><div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">{activeCourse?.sections.flatMap(s => s.topics).map(t => (<button key={t.id} onClick={() => { setSelectedTopicId(t.id); setSelectedSubtopic(t.subtopics?.[0] || null); }} className={`px-3 py-1.5 text-[11px] font-semibold border rounded-md transition-colors ${selectedTopicId === t.id ? 'bg-emerald-500/15 border-emerald-500/30 rounded-md text-emerald-300' : 'bg-white/[0.02] border-white/[0.06] rounded-md text-neutral-400 hover:text-white hover:border-white/15'}`}>{t.name.split('(')[0].trim()}</button>))}</div></div>
                {currentTopic?.subtopics && currentTopic.subtopics.length > 0 && (<div><span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2 block">Dot Points</span><div className="flex flex-wrap gap-2">{currentTopic.subtopics.map(sub => (<button key={sub} onClick={() => { setSelectedSubtopic(sub); }} className={`px-3 py-1.5 text-[11px] font-semibold border rounded-md transition-colors ${selectedSubtopic === sub ? 'bg-emerald-500/15 border-emerald-500/30 rounded-md text-emerald-300' : 'bg-white/[0.02] border-white/[0.06] rounded-md text-neutral-400 hover:text-white hover:border-white/15'}`}>{sub}</button>))}</div></div>)}
              </div>
              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
                <button onClick={() => { setIsAllTopicsSelected(true); setSelectedTopicIds(new Set()); setSelectedTopicId(null); setSelectedSubtopic(null); }} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors border-0">Blend All Topics</button>
                <div className="flex gap-2"><button onClick={() => setIsExplorerExpanded(false)} className="px-4 py-2 text-xs font-semibold border border-white/[0.08] text-neutral-400 hover:text-white transition-colors">Cancel</button><button onClick={() => { setIsExplorerExpanded(false); setTimeout(() => handleGenerateProblem(), 50); }} disabled={!selectedTopicId} className="px-5 py-2 text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors border-0 disabled:opacity-30">Generate</button></div>
              </div>
            </div>
          </motion.div>
        </>)}
      </AnimatePresence>
    </div>
  );
};

export default Problems;
