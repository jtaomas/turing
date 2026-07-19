import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, Plus, Search, FolderOpen, Zap, GitGraph, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SYLLABUS, getEffectiveCourseIds } from '../constants';
import { getTopicYields, getNeuralRecommendations, analyzeUploadedSet, TopicYield, TopicRecommendation, SetAnalysis } from '../services/api';
import Spinner from './Spinner';

// Local topic metadata for fallback yields (mirrors backend TOPIC_META)
const TOPIC_META: Record<string, { exam_weight: number }> = {
  'ma-f1': { exam_weight: 8 }, 'ma-t1': { exam_weight: 7 }, 'ma-c1': { exam_weight: 6 },
  'ma-e1': { exam_weight: 5 }, 'ma-s1': { exam_weight: 6 }, 'ma-f2': { exam_weight: 7 },
  'ma-t2': { exam_weight: 6 }, 'ma-c234': { exam_weight: 10 }, 'ma-m1': { exam_weight: 5 },
  'ma-s23': { exam_weight: 8 }, 'me-f1': { exam_weight: 7 }, 'me-t12': { exam_weight: 8 },
  'me-c1': { exam_weight: 9 }, 'me-a1': { exam_weight: 6 }, 'me-p1': { exam_weight: 7 },
  'me-v1': { exam_weight: 7 }, 'me-t3': { exam_weight: 6 }, 'me-c23': { exam_weight: 8 },
  'me-s1': { exam_weight: 6 }, 'mex-p12': { exam_weight: 9 }, 'mex-v1': { exam_weight: 8 },
  'mex-n12': { exam_weight: 10 }, 'mex-c1': { exam_weight: 10 }, 'mex-m1': { exam_weight: 9 },
};

// ─── Types ──────────────────────────────────────────────────────
export interface SessionMode {
  type: 'test' | 'practice';
  setName: string;
  setId: string;
}

interface QuestionSet {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: Date;
  topicCount: number;
  questionCount: number;
  previewText: string;
  subject: string;
  completionScore: number;
}

// ─── Auto-naming ────────────────────────────────────────────────
function autoName(fileName: string): string {
  const base = fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, '').replace(/[-_]/g, ' ');
  const words = base.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 'Untitled Set';
  // Capitalize each word, remove common noise
  const clean = words
    .filter(w => !/^(img|scan|doc|file|photo|page|sheet|worksheet|unnamed|screenshot)$/i.test(w))
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (clean.length === 0) return 'Uploaded Set';
  if (clean.length > 4) return clean.slice(0, 4).join(' ') + '…';
  return clean.join(' ');
}

// ─── Mock preview generator ─────────────────────────────────────
function generatePreview(fileName: string): { topicCount: number; questionCount: number; preview: string; completionScore: number } {
  const seed = fileName.length * 31 + (fileName.charCodeAt(0) || 65);
  const topicCount = 1 + (seed % 4);
  const questionCount = 3 + (seed % 12);
  const completionScore = Math.round(20 + (seed % 61));
  const previewTopics = [
    '1. Differentiation — product & quotient rules, chain rule applications',
    '2. Integration — substitution method, area between curves',
    '3. Trigonometric equations — general solutions, identities',
    '4. Probability — binomial distributions, expected value',
    '5. Vectors — dot product, projections, 3D geometry',
  ];
  const preview = previewTopics.slice(0, topicCount).join('\n');
  return { topicCount, questionCount, preview, completionScore };
}

// ─── Vape.gg-style collapsible category ──────────────────────────
interface SyllabusCategoryProps {
  label: string;
  topics: Array<{
    id: string;
    name: string;
    courseId: string;
    courseName: string;
    subtopics: string[];
    count: number;
    yield: number;
    mastery: number;
  }>;
  selectedTopicId: string | null;
  onSelectTopic: (id: string) => void;
  onStartSession?: (mode: SessionMode) => void;
}

const SyllabusCategory: React.FC<SyllabusCategoryProps> = ({ label, topics, selectedTopicId, onSelectTopic, onStartSession }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-white/[0.04]">
      {/* Category header — vape.gg collapsible */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-1 py-3 border-0 bg-transparent hover:bg-white/[0.01] transition-colors">
        <span className={`text-[10px] text-neutral-600 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>▶</span>
        <span className="text-[13px] font-semibold text-white">{label}</span>
        <span className="text-[10px] text-neutral-600 ml-auto">{topics.length} topics</span>
      </button>

      {open && (
        <div className="pb-2">
          {topics.map(topic => {
            const isSel = selectedTopicId === topic.id;
            return (
              <div key={topic.id}>
                <button
                  onClick={() => onSelectTopic(topic.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-0 bg-transparent hover:bg-white/[0.02] transition-colors ${
                    isSel ? 'bg-white/[0.02] border-l-2 border-l-emerald-500' : 'border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] ${isSel ? 'text-white font-semibold' : 'text-neutral-300'}`}>
                        {topic.name}
                      </span>
                      <span className="text-[9px] text-neutral-600 bg-white/[0.03] px-1.5 py-0.5 leading-none">
                        {topic.courseName}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5 truncate">
                      {topic.subtopics.slice(0, 3).join(' · ')}{topic.subtopics.length > 3 ? ' …' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9px] text-neutral-600 tabular-nums">{topic.count} qns</span>
                    {topic.yield > 0 && (
                      <span className={`text-[10px] font-bold tabular-nums min-w-[28px] text-right ${
                        topic.yield >= 70 ? 'text-emerald-400' : topic.yield >= 45 ? 'text-amber-400' : 'text-neutral-500'
                      }`}>
                        {Math.round(topic.yield)}
                      </span>
                    )}
                  </div>
                </button>
                {/* Actions shown when selected */}
                {isSel && (
                  <div className="flex items-center gap-2 px-4 py-2 pl-12 bg-white/[0.01] border-t border-white/[0.03]">
                    <button onClick={() => onStartSession?.({ type: 'practice', setName: topic.name, setId: topic.id })}
                      className="px-3 py-1.5 text-[10px] font-medium text-neutral-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15] bg-transparent transition-colors">
                      Practice
                    </button>
                    <button onClick={() => onStartSession?.({ type: 'test', setName: topic.name, setId: topic.id })}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-semibold border-0 transition-colors">
                      Timed Test
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
interface Props {
  onStartSession?: (mode: SessionMode) => void;
}

const QuestionSets: React.FC<Props> = ({ onStartSession }) => {
  const [sets, setSets] = useState<QuestionSet[]>(() => {
    try {
      const saved = localStorage.getItem('turing_sets');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({ ...s, uploadedAt: new Date(s.uploadedAt) }));
      }
    } catch {}
    return [];
  });
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeCourse, setActiveCourse] = useState<string>('');
  const [selectedHYTopic, setSelectedHYTopic] = useState<string | null>(null);

  // Persist sets to localStorage
  useEffect(() => {
    localStorage.setItem('turing_sets', JSON.stringify(sets));
  }, [sets]);

  // Neural yield data from backend
  const [yieldMap, setYieldMap] = useState<Record<string, number>>({});
  const [masteryMap, setMasteryMap] = useState<Record<string, number>>({});
  const [neuralRecs, setNeuralRecs] = useState<TopicRecommendation[]>([]);
  const [yieldsLoading, setYieldsLoading] = useState(false);
  const [yieldError, setYieldError] = useState(false);

  // Read user's onboarding course — but keep '' as default (no section open)
  useEffect(() => {
    const c = localStorage.getItem('turing_onboarding_course') || '';
    // Don't auto-set — user picks from template gallery
  }, []);

  // Fetch neural yield scores from backend
  useEffect(() => {
    let cancelled = false;
    async function fetchYields() {
      setYieldsLoading(true);
      setYieldError(false);
      try {
        const [yieldsRes, recsRes] = await Promise.all([
          getTopicYields().catch(() => null),
          getNeuralRecommendations(8).catch(() => null),
        ]);
        if (cancelled) return;

        if (yieldsRes) {
          const ym: Record<string, number> = {};
          const mm: Record<string, number> = {};
          for (const y of yieldsRes.yields) {
            ym[y.topic_id] = y.yield_score;
            mm[y.topic_id] = y.mastery_pct;
          }
          setYieldMap(ym);
          setMasteryMap(mm);
        }

        if (recsRes) {
          setNeuralRecs(recsRes.recommendations);
        }
      } catch {
        if (!cancelled) setYieldError(true);
      } finally {
        if (!cancelled) setYieldsLoading(false);
      }
    }
    fetchYields();
    return () => { cancelled = true; };
  }, []);

  // Build all syllabus topic sets dynamically with real neural yields
  const allSyllabusTopics = SYLLABUS.flatMap(course =>
    course.sections.flatMap(section =>
      section.topics.map(topic => ({
        id: topic.id,
        name: topic.name.split('(')[0].trim(),
        courseId: course.id,
        courseName: course.name,
        subtopics: topic.subtopics || [],
        count: topic.problems?.length || (topic.subtopics?.length || 1) * 3,
        yield: yieldMap[topic.id] ?? Math.round(50 + (TOPIC_META[topic.id]?.exam_weight || 5) * 2),
        mastery: masteryMap[topic.id] ?? 0,
      }))
    )
  );

  const courseNames: Record<string, string> = { adv: 'Advanced', mx1: 'Extension 1', mx2: 'Extension 2' };
  
  // Hierarchy-aware topic filtering
  // '' → nothing shown | all → all | adv → only Adv | mx1 → Adv+Ext1 | mx2 → Ext1+Ext2
  const HIERARCHY_COURSES: Record<string, string[]> = {
    adv: ['adv'],
    mx1: ['adv', 'mx1'],
    mx2: ['mx1', 'mx2'],
    all: ['adv', 'mx1', 'mx2'],
    yield: ['adv', 'mx1', 'mx2'],
  };
  const visibleCourseIds = HIERARCHY_COURSES[activeCourse] || [];
  const filteredTopics = allSyllabusTopics.filter(t => visibleCourseIds.includes(t.courseId));
  const showTopics = activeCourse !== ''; // only show topic sections when a course is selected

  // Default "All Sets" collection
  const totalQuestions = allSyllabusTopics.reduce((s, t) => s + t.count, 0);
  const syllabusSets = [
    { id: 'syllabus_all', name: 'Complete Syllabus', course: 'All Courses', topics: allSyllabusTopics.length, questions: totalQuestions },
    { id: 'syllabus_adv', name: 'Mathematics Advanced', course: 'Advanced', topics: allSyllabusTopics.filter(t => t.courseId === 'adv').length, questions: allSyllabusTopics.filter(t => t.courseId === 'adv').reduce((s, t) => s + t.count, 0) },
    { id: 'syllabus_mx1', name: 'Mathematics Extension 1', course: 'Extension 1', topics: allSyllabusTopics.filter(t => t.courseId === 'mx1').length, questions: allSyllabusTopics.filter(t => t.courseId === 'mx1').reduce((s, t) => s + t.count, 0) },
    { id: 'syllabus_mx2', name: 'Mathematics Extension 2', course: 'Extension 2', topics: allSyllabusTopics.filter(t => t.courseId === 'mx2').length, questions: allSyllabusTopics.filter(t => t.courseId === 'mx2').reduce((s, t) => s + t.count, 0) },
  ];

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(pdf|png|jpg|jpeg)$/i)) return;
    setUploading(true);
    // Simulate processing then call Gemini for analysis
    setTimeout(async () => {
      const { topicCount, questionCount, preview, completionScore } = generatePreview(file.name);
      const name = autoName(file.name);

      // Try Gemini assessment
      let analysis: SetAnalysis | null = null;
      try {
        analysis = await analyzeUploadedSet(file.name, preview);
      } catch { /* heuristic fallback handled in UI */ }

      const newSet: QuestionSet = {
        id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        fileName: file.name,
        uploadedAt: new Date(),
        topicCount: analysis?.estimated_topic_ids?.length || topicCount,
        questionCount: analysis?.question_count_estimate || questionCount,
        previewText: analysis?.summary || preview,
        subject: analysis?.course === 'mx2' ? 'Extension 2' : analysis?.course === 'mx1' ? 'Extension 1' : 'Advanced',
        completionScore: analysis ? Math.round(analysis.difficulty * 20) : completionScore,
      };
      setSets(prev => [newSet, ...prev]);
      setUploading(false);
    }, 1200);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) handleFile(files[i]);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) for (let i = 0; i < files.length; i++) handleFile(files[i]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFile]);

  const deleteSet = (id: string) => {
    setSets(prev => prev.filter(s => s.id !== id));
  };

  const filteredUser = searchQuery.trim()
    ? sets.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
    : sets;

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* ══════ Header ══════ */}
      <div className="px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <GitGraph size={22} className="text-emerald-400 shrink-0" />
            <h1 className="text-3xl font-light tracking-tight text-white">My Sets</h1>
            <div className="flex-1" />
          </div>
          {/* Search bar */}
          <div className="relative max-w-xl">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search in My Sets…"
              className="w-full bg-[#0b0c10] border border-white/[0.06] pl-10 pr-4 py-2.5 text-[13px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white/[0.12] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ══════ Template gallery — Start a new set ══════ */}
      <div className="px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.15em] mb-4">Start a new set</h2>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {/* New Set PLUS tile */}
            <button onClick={() => fileInputRef.current?.click()}
              className="text-left bg-[#0b0c10] border border-white/[0.06] hover:border-emerald-500/30 transition-all p-4 flex flex-col items-center justify-center min-h-[110px] group">
              <div className="w-10 h-10 bg-emerald-500/[0.08] flex items-center justify-center mb-2.5 group-hover:bg-emerald-500/[0.15] transition-colors">
                <Plus size={18} className="text-emerald-400" />
              </div>
              <p className="text-[11px] font-medium text-white text-center">New Set</p>
            </button>
            {/* Highest Yield tile */}
            <button onClick={() => setActiveCourse('yield')}
              className={`text-left bg-[#0b0c10] border p-4 transition-all hover:border-emerald-500/30 min-h-[110px] flex flex-col ${
                activeCourse === 'yield' ? 'border-emerald-500/40 bg-emerald-500/[0.02]' : 'border-white/[0.06]'
              }`}>
              <div className="w-10 h-10 bg-emerald-500/[0.08] flex items-center justify-center mb-2.5">
                <Zap size={16} className="text-emerald-400" />
              </div>
              <p className="text-[11px] font-medium text-white">Highest Yield</p>
              <p className="text-[9px] text-neutral-500 mt-0.5">AI recommended</p>
            </button>
            {/* Course tiles — order: Ext 2 → Ext 1 → Adv */}
            {['mx2', 'mx1', 'adv'].map(cId => {
              const cName = cId === 'mx2' ? 'Extension 2' : cId === 'mx1' ? 'Extension 1' : 'Advanced';
              const count = allSyllabusTopics.filter(t => t.courseId === cId).length;
              return (
                <button key={cId} onClick={() => setActiveCourse(cId)}
                  className={`text-left bg-[#0b0c10] border p-4 transition-all hover:border-white/[0.15] min-h-[110px] flex flex-col ${
                    activeCourse === cId ? 'border-white/[0.12] bg-white/[0.01]' : 'border-white/[0.06]'
                  }`}>
                  <div className="w-10 h-10 bg-white/[0.03] flex items-center justify-center mb-2.5">
                    <FileText size={16} className="text-neutral-400" />
                  </div>
                  <p className="text-[11px] font-medium text-white">{cName}</p>
                  <p className="text-[9px] text-neutral-500 mt-0.5">{count} topics</p>
                </button>
              );
            })}
            {/* All Courses tile */}
            <button onClick={() => setActiveCourse('all')}
              className={`text-left bg-[#0b0c10] border p-4 transition-all hover:border-white/[0.15] min-h-[110px] flex flex-col ${
                activeCourse === 'all' ? 'border-white/[0.12] bg-white/[0.01]' : 'border-white/[0.06]'
              }`}>
              <div className="w-10 h-10 bg-white/[0.03] flex items-center justify-center mb-2.5">
                <BookOpen size={16} className="text-neutral-400" />
              </div>
              <p className="text-[11px] font-medium text-white">All Courses</p>
              <p className="text-[9px] text-neutral-500 mt-0.5">{allSyllabusTopics.length} topics</p>
            </button>
          </div>
        </div>
      </div>

      {/* ══════ Topic sections — only shown when a course is selected ══════ */}
      {showTopics && (
        <div className="px-6 py-2">
          <div className="max-w-5xl mx-auto">
            {/* Yield grid */}
            {activeCourse === 'yield' && (
              <div className="py-4">
                {neuralRecs.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {neuralRecs.slice(0, 8).map((rec, i) => (
                      <button key={rec.topic_id}
                        onClick={() => { setActiveCourse(rec.course); setSelectedHYTopic(rec.topic_id); }}
                        className="text-left bg-[#0b0c10] border border-white/[0.05] hover:border-emerald-500/40 p-4 transition-all"
                      >
                        <div className="flex items-baseline gap-1 mb-1.5">
                          <span className={`text-[20px] font-bold ${
                            rec.yield_score >= 70 ? 'text-emerald-400' : rec.yield_score >= 45 ? 'text-amber-400' : 'text-neutral-500'
                          }`}>{Math.round(rec.yield_score)}</span>
                          <span className="text-[9px] text-neutral-500">yield</span>
                        </div>
                        <p className="text-[12px] font-medium text-white leading-tight">{rec.topic_name || rec.topic_id}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-[9px] text-neutral-600">
                          <span>{rec.course === 'mx2' ? 'Ext 2' : rec.course === 'mx1' ? 'Ext 1' : 'Advanced'}</span>
                          <span>·</span>
                          <span>Mastery {Math.round(rec.mastery_pct)}%</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Zap size={20} className="text-emerald-400/20 mx-auto mb-2" />
                    <p className="text-[13px] text-neutral-500">Practice to unlock yield scores</p>
                  </div>
                )}
              </div>
            )}

            {/* Syllabus topic sections — grouped by course, with hierarchy */}
            {activeCourse !== 'yield' && (
              <div>
                {visibleCourseIds.map(courseId => {
                  const ct = allSyllabusTopics.filter(t => t.courseId === courseId);
                  if (!ct.length) return null;
                  return (
                    <SyllabusCategory key={courseId} label={courseNames[courseId]} topics={ct}
                      selectedTopicId={selectedHYTopic}
                      onSelectTopic={id => setSelectedHYTopic(selectedHYTopic === id ? null : id)}
                      onStartSession={onStartSession} />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ Upload zone ══════ */}
      {sets.length === 0 && !uploading && (
        <div className="px-6 pb-6">
          <div className="max-w-5xl mx-auto">
            <div className="border border-dashed border-white/[0.06] p-8 text-center cursor-pointer hover:border-white/[0.12] transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}>
              <FolderOpen size={22} className="text-emerald-400/40 mx-auto mb-2" />
              <p className="text-[13px] text-neutral-400 mb-0.5">Drop worksheets here</p>
              <p className="text-[11px] text-neutral-600">PDF, PNG, JPG supported</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Uploading indicator ══════ */}
      <AnimatePresence>
        {uploading && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 bg-emerald-500/[0.04] border border-emerald-500/15 px-4 py-2.5 mx-6 mb-4 max-w-5xl">
            <Spinner size={14} />
            <p className="text-[11px] text-emerald-300">Processing…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ User uploaded sets ══════ */}
      {filteredUser.length > 0 && (
        <div className="px-6 pb-8">
          <div className="max-w-5xl mx-auto">
            <div className="pt-4">
              <h3 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">Uploaded Sets</h3>
              <div className="space-y-0.5">
                {filteredUser.map(set => {
                  const dateStr = set.uploadedAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
                  return (
                    <div key={set.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-[#0b0c10] border border-white/[0.04] hover:border-white/[0.08] transition-all group">
                      <FileText size={14} className="text-neutral-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-white truncate">{set.name}</p>
                        <p className="text-[10px] text-neutral-500">{dateStr} · {set.questionCount} questions</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onStartSession?.({ type: 'test', setName: set.name, setId: set.id })}
                          className="px-2 py-1 text-[10px] text-neutral-400 hover:text-white border-0 bg-transparent">Test</button>
                        <button onClick={() => onStartSession?.({ type: 'practice', setName: set.name, setId: set.id })}
                          className="px-2 py-1 text-[10px] text-neutral-400 hover:text-white border-0 bg-transparent">Practice</button>
                        <button onClick={() => deleteSet(set.id)}
                          className="px-2 py-1 text-[10px] text-neutral-600 hover:text-red-400 border-0 bg-transparent">Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={handleFileSelect} className="hidden" />
    </div>
  );
};

export default QuestionSets;