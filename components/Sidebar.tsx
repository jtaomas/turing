import React, { useEffect, useState, useCallback } from 'react';
import { BarChart3, BookOpen, GitGraph, Settings, ChevronDown, ChevronRight, User as UserIcon, X, History as HistoryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAttempts, deleteAttempt, getCurrentUser, ProblemAttempt, User, setAuthToken } from '../services/api';

interface HistoryEntry {
  id: string; question: string; topicName: string; subtopicName?: string;
  courseId: 'adv'|'mx1'|'mx2'; yearLevel: 11|12; createdAt: Date; score?: number; answer?: string;
  imageData?: string; attemptId?: number;
}

interface SidebarProps { currentTab: string; setTab: (tab: string) => void; onHistorySelect?: (entry: HistoryEntry) => void; }

const Sidebar: React.FC<SidebarProps> = ({ currentTab, setTab, onHistorySelect }) => {
  const [user, setUser] = useState<User | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);

  const [sessions, setSessions] = useState<Array<{ date: string; label: string; count: number; avg: number }>>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await getAttempts(100);

      const grouped = new Map<string, typeof r.attempts>();
      for (const a of r.attempts) {
        if (!a.problem_text || a.problem_text === '[deleted]') continue;
        const d = a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : 'unknown';
        if (!grouped.has(d)) grouped.set(d, []);
        grouped.get(d)!.push(a);
      }
      const entries = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
      const result = entries.map(([date, items]) => {
        const d = new Date(date + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
        const dayLabel = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? `${diff}d ago` :
          d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
        const avg = items.reduce((s: number, x: any) => s + (x.score || 0), 0) / items.length;
        return { date, label: `${dayLabel} · ${items.length} problems`, count: items.length, avg };
      });
      setSessions(result);
    } catch { setSessions([]); }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const onStorage = () => refreshHistory();
    window.addEventListener('storage', onStorage);
    window.addEventListener('turing_history_changed', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('turing_history_changed', onStorage);
    };
  }, [refreshHistory]);

  useEffect(() => {
    (async () => {
      try { const token = localStorage.getItem('turing_auth_token');
        if (token) { const d = await getCurrentUser(); setUser(d.user); }
      } catch { }
    })();
  }, []);

  const handleDelete = useCallback(async (idx: number) => {

  }, []);

  const mainNav = [
    { id: 'home', label: 'Home', icon: BarChart3 },
    { id: 'map', label: 'Topic Map', icon: GitGraph },
    { id: 'marking', label: 'My Sets', icon: BookOpen },
    { id: 'config', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-[#0a0a0c] border-r border-white/[0.04] flex flex-col py-5 sticky top-0 h-screen z-20">
      {}
      <div className="px-5 mb-4 flex items-center gap-2.5">
        <img
          src="/logo.png"
          className="w-7 h-7 shrink-0 object-cover"
          onError={(e) => {

            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
          alt="Turing"
        />
        <div className="w-7 h-7 shrink-0 hidden relative" style={{
          background: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a1e 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            position:'absolute',inset:2,
            background: 'linear-gradient(45deg, transparent 40%, rgba(16,185,129,0.15) 45%, transparent 50%), linear-gradient(135deg, transparent 30%, rgba(168,85,247,0.12) 35%, transparent 40%)'
          }} />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-400/80">T</span>
        </div>
        <span className="text-[14px] font-bold text-white tracking-wide">TURING</span>
      </div>

      {}
      <nav className="flex flex-col gap-0.5 px-3">
        {mainNav.map((item) => {
          const active = currentTab === item.id;
          return (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-[12px] transition-all border-0 font-medium text-left ${
                active
                  ? 'text-white bg-white/[0.03] border-l-2 border-l-emerald-500'
                  : 'text-neutral-500 hover:text-neutral-300 border-l-2 border-l-transparent hover:bg-white/[0.01]'
              }`}>
              <item.icon size={15} className={active ? 'text-emerald-400' : 'text-neutral-600'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {}
      <div className="mx-4 my-4 border-t border-white/[0.05]" />

      {}
      <div className="px-3 flex flex-col gap-0.5 flex-1 overflow-hidden">
        <button onClick={() => setHistoryOpen(!historyOpen)}
          className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-semibold text-neutral-500 hover:text-neutral-300 transition-colors border-0 bg-transparent uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5"><HistoryIcon size={10}/> History</span>
          <span className="flex items-center gap-1">
            {historyLoading && <span className="w-2 h-2 bg-neutral-600 animate-pulse" />}
            <span className="text-[9px] text-neutral-600">{sessions.length}</span>
            {historyOpen ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
          </span>
        </button>
        <AnimatePresence>
          {historyOpen && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.15}} className="overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto py-1 space-y-0.5 min-h-0" style={{maxHeight:'calc(100vh - 360px)'}}>
                {sessions.length === 0 && !historyLoading && (
                  <p className="text-[10px] text-neutral-600 px-3 py-4 text-center">No history yet</p>
                )}
                {sessions.map(s => (
                  <div key={s.date} className="flex items-center gap-2.5 px-3 py-1.5 cursor-default hover:bg-white/[0.02] transition-colors">
                    <div className="w-1.5 h-1.5 shrink-0 rounded-full" style={{
                      background: s.avg >= 4 ? '#34d399' : s.avg >= 2.5 ? '#10b981' : s.avg > 0 ? '#fbbf24' : '#3f3f46'
                    }} />
                    <span className="text-[12px] text-neutral-400 truncate flex-1">{s.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {}
      <div className="mx-3 mt-auto border-t border-white/[0.06]" />
      <div className="px-3 py-2">
        <button onClick={() => setFullProfileOpen(true)}
          className="flex items-center gap-2.5 px-2 py-2 w-full hover:bg-white/[0.02] transition-colors border-0 bg-transparent text-left group">
          {user?.picture_url ? <img src={user.picture_url} alt="" className="w-6 h-6 shrink-0" /> :
            <div className="w-6 h-6 bg-emerald-500/20 flex items-center justify-center shrink-0">
              <UserIcon size={12} className="text-emerald-400" />
            </div>}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-neutral-300 truncate group-hover:text-white transition-colors">{user?.display_name || 'Student'}</p>
            <p className="text-[10px] text-neutral-600 truncate">{user?.institution || user?.course || 'NSW'}</p>
          </div>
          <Settings size={11} className="text-neutral-700 group-hover:text-neutral-500 transition-colors shrink-0" />
        </button>
      </div>

      {}
      <AnimatePresence>
        {fullProfileOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setFullProfileOpen(false)} className="fixed inset-0 bg-black/70 z-50" />
            <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}} transition={{duration:0.12}}
              className="fixed inset-0 z-[51] flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-[#0c0d13] border border-white/[0.06] w-full max-w-[340px] pointer-events-auto">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05]">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">Profile</span>
                  <button onClick={() => setFullProfileOpen(false)} className="text-neutral-600 hover:text-white border-0 bg-transparent p-1"><X size={14} /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    {user?.picture_url ? <img src={user.picture_url} alt="" className="w-10 h-10" /> :
                      <div className="w-10 h-10 bg-emerald-500/20 flex items-center justify-center text-lg font-bold text-emerald-400">{(user?.display_name || 'S')[0]}</div>}
                    <div>
                      <p className="text-[13px] font-semibold text-white">{user?.display_name || 'Student'}</p>
                      <p className="text-[11px] text-neutral-500">{user?.email || ''}</p>
                    </div>
                  </div>
                  <div className="border-t border-white/[0.04]" />
                  <button onClick={() => { setFullProfileOpen(false); setTab('config'); }}
                    className="w-full text-left px-2 py-2 text-[12px] text-neutral-400 hover:text-white transition-colors border-0 bg-transparent">Appearance</button>
                  <button onClick={() => { setFullProfileOpen(false); setTab('config'); }}
                    className="w-full text-left px-2 py-2 text-[12px] text-neutral-400 hover:text-white transition-colors border-0 bg-transparent">Account settings</button>
                  <div className="border-t border-white/[0.04]" />
                  <button onClick={() => { setAuthToken(null); window.location.reload(); }}
                    className="w-full text-center py-2 text-[11px] text-neutral-600 hover:text-red-400 transition-colors border-0 bg-transparent">Sign out</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </aside>
  );
};

export default Sidebar;
