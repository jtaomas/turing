import React, { useEffect, useState, useCallback } from 'react';
import { BarChart3, BookOpen, GitGraph, Settings, ChevronDown, ChevronRight, User as UserIcon, X, History as HistoryIcon, Trash2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAttempts, deleteAttempt, getCurrentUser, User, setAuthToken } from '../services/api';

interface HistoryEntry {
  id: string; question: string; topicName: string; subtopicName?: string;
  courseId: string; yearLevel: number; createdAt: Date; score?: number;
  imageData?: string; attemptId?: number; sessionId?: string;
}

interface Chat { id: string; title: string; entries: HistoryEntry[]; count: number; }

interface SidebarProps { currentTab: string; setTab: (tab: string) => void; onHistorySelect?: (entry: HistoryEntry) => void; }

function makeTitle(e: HistoryEntry[]): string {
  const t = e[0]?.topicName || '';
  return t ? t.replace(/\(.*\)/, '').trim() || 'Question' : 'Question';
}

const Sidebar: React.FC<SidebarProps> = ({ currentTab, setTab, onHistorySelect }) => {
  const [user, setUser] = useState<User | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [openChat, setOpenChat] = useState<string | null>(null);

  const chats: Chat[] = (() => {
    const m = new Map<string, HistoryEntry[]>();
    for (const e of entries) { const k = e.sessionId || e.id; if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); }
    return Array.from(m.entries()).map(([id, items]) => ({ id, title: makeTitle(items), entries: items, count: items.length }));
  })();

  const load = useCallback(async () => {
    setLoading(true);
    const seen = new Set<string>();
    const all: HistoryEntry[] = [];
    try {
      const r = await getAttempts(200);
      for (const a of r.attempts) {
        if (!a.problem_text || a.problem_text === '[deleted]') continue;
        const n = a.problem_text.trim().replace(/\s+/g, ' ');
        if (seen.has(n)) continue; seen.add(n);
        all.push({ id: 'be_'+a.id, question: a.problem_text, topicName: a.topic_id||'', sessionId: a.session_id||undefined, createdAt: a.created_at?new Date(a.created_at):new Date(), score: a.score??undefined, attemptId: a.id });
      }
    } catch {}
    try {
      const loc: HistoryEntry[] = JSON.parse(localStorage.getItem('turing_history')||'[]');
      for (const e of loc) { const n = (e.question||'').trim().replace(/\s+/g,' '); if (!n||seen.has(n)) continue; seen.add(n); all.push({...e, id: e.id||'lh_'+Date.now()}); }
    } catch {}
    setEntries(all); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = () => load(); window.addEventListener('turing_history_changed', h); return () => window.removeEventListener('turing_history_changed', h); }, [load]);
  useEffect(() => { (async () => { try { const t = localStorage.getItem('turing_auth_token'); if (t) { const d = await getCurrentUser(); setUser(d.user); } } catch {} })(); }, []);

  const del = useCallback(async (id: string) => {
    const c = chats.find(x => x.id === id); if (!c) return;
    setEntries(p => p.filter(e => (e.sessionId||e.id) !== id));
    for (const e of c.entries) { if (e.attemptId) { try { await deleteAttempt(e.attemptId); } catch {} } }
    try { const loc: HistoryEntry[] = JSON.parse(localStorage.getItem('turing_history')||'[]'); const ids = new Set(c.entries.map(e=>e.id)); localStorage.setItem('turing_history', JSON.stringify(loc.filter(e=>!ids.has(e.id)))); window.dispatchEvent(new CustomEvent('turing_history_changed')); } catch {}
  }, [chats]);

  const nav = [
    { id: 'home', label: 'Home', icon: BarChart3 },
    { id: 'map', label: 'Topic Map', icon: GitGraph },
    { id: 'marking', label: 'My Sets', icon: BookOpen },
    { id: 'config', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-[#0a0a0c] border-r border-white/[0.04] flex flex-col py-5 sticky top-0 h-screen z-20">
      <div className="px-5 mb-4 flex items-center gap-2.5">
        <img src="/logo.png" className="w-7 h-7 shrink-0 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} alt="Turing" />
        <span className="text-[14px] font-bold text-white tracking-wide">TURING</span>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {nav.map((item) => {
          const a = currentTab === item.id;
          return <button key={item.id} onClick={() => setTab(item.id)} className={'flex items-center gap-2.5 px-3 py-2.5 text-[12px] transition-all border-0 font-medium text-left '+(a?'text-white bg-white/[0.03] border-l-2 border-l-emerald-500':'text-neutral-500 hover:text-neutral-300 border-l-2 border-l-transparent hover:bg-white/[0.01]')}><item.icon size={15} className={a?'text-emerald-400':'text-neutral-600'}/><span>{item.label}</span></button>;
        })}
      </nav>
      <div className="mx-4 my-4 border-t border-white/[0.05]" />
      <div className="px-3 flex flex-col gap-0.5 flex-1 overflow-hidden">
        <button onClick={() => setHistoryOpen(!historyOpen)} className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-semibold text-neutral-500 hover:text-neutral-300 transition-colors border-0 bg-transparent uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5"><HistoryIcon size={10}/> Sessions</span>
          <span className="flex items-center gap-1">{loading&&<span className="w-2 h-2 bg-neutral-600 animate-pulse"/>}<span className="text-[9px] text-neutral-600">{chats.length}</span>{historyOpen?<ChevronDown size={10}/>:<ChevronRight size={10}/>}</span>
        </button>
        <AnimatePresence>
          {historyOpen && <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto py-1 space-y-0.5 min-h-0" style={{maxHeight:'calc(100vh - 360px)'}}>
              {chats.length===0&&!loading&&<p className="text-[10px] text-neutral-600 px-3 py-4 text-center">No sessions yet</p>}
              {chats.map(c => { const is = openChat===c.id; return <div key={c.id}>
                <div className="group flex items-center gap-1 px-2 py-1.5 hover:bg-white/[0.02] transition-colors">
                  <MessageSquare size={11} className="text-neutral-700 shrink-0"/>
                  <button onClick={() => setOpenChat(is?null:c.id)} className="flex-1 text-left border-0 bg-transparent min-w-0 block">
                    <p className="text-[11px] text-neutral-300 leading-snug truncate">{c.title}</p>
                    <p className="text-[9px] text-neutral-600">{c.count} questions</p>
                  </button>
                  <button onClick={e => { e.stopPropagation(); del(c.id); }} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-700 hover:text-red-400 border-0 bg-transparent p-0.5"><Trash2 size={11}/></button>
                </div>
                {is && <div className="ml-5 border-l border-white/[0.04] pl-2 space-y-0.5">{c.entries.map(e => <button key={e.id} onClick={() => { onHistorySelect?.(e); setTab('home'); }} className="w-full text-left px-2 py-1 hover:bg-white/[0.02] transition-colors border-0 bg-transparent block"><p className="text-[10px] text-neutral-400 leading-snug truncate">{e.question.replace(/\$+/g,'').substring(0,60)}</p>{e.score!==undefined&&<span className={'text-[9px] '+(e.score>=4?'text-emerald-500':e.score>=2.5?'text-amber-500':'text-red-400')}>{e.score}/5</span>}</button>)}</div>}
              </div>; })}
            </div>
          </motion.div>}
        </AnimatePresence>
      </div>
      <div className="mx-3 mt-auto border-t border-white/[0.06]" />
      <div className="px-3 py-2">
        <button onClick={() => setFullProfileOpen(true)} className="flex items-center gap-2.5 px-2 py-2 w-full hover:bg-white/[0.02] transition-colors border-0 bg-transparent text-left group">
          {user?.picture_url ? <img src={user.picture_url} alt="" className="w-6 h-6 shrink-0"/> : <div className="w-6 h-6 bg-emerald-500/20 flex items-center justify-center shrink-0"><UserIcon size={12} className="text-emerald-400"/></div>}
          <div className="min-w-0 flex-1"><p className="text-[12px] text-neutral-300 truncate group-hover:text-white transition-colors">{user?.display_name||'Student'}</p><p className="text-[10px] text-neutral-600 truncate">{user?.institution||user?.course||'NSW'}</p></div>
          <Settings size={11} className="text-neutral-700 group-hover:text-neutral-500 transition-colors shrink-0"/>
        </button>
      </div>
      <AnimatePresence>
        {fullProfileOpen && <><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setFullProfileOpen(false)} className="fixed inset-0 bg-black/70 z-50"/><motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}} className="fixed inset-0 z-[51] flex items-center justify-center p-4 pointer-events-none"><div className="bg-[#0c0d13] border border-white/[0.06] w-full max-w-[340px] pointer-events-auto"><div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05]"><span className="text-[11px] font-bold text-white uppercase tracking-wider">Profile</span><button onClick={() => setFullProfileOpen(false)} className="text-neutral-600 hover:text-white border-0 bg-transparent p-1"><X size={14}/></button></div><div className="p-5 space-y-4"><div className="flex items-center gap-3">{user?.picture_url?<img src={user.picture_url} alt="" className="w-10 h-10"/>:<div className="w-10 h-10 bg-emerald-500/20 flex items-center justify-center text-lg font-bold text-emerald-400">{(user?.display_name||'S')[0]}</div>}<div><p className="text-[13px] font-semibold text-white">{user?.display_name||'Student'}</p><p className="text-[11px] text-neutral-500">{user?.email||''}</p></div></div><div className="border-t border-white/[0.04]"/><button onClick={() => { setFullProfileOpen(false); setTab('config'); }} className="w-full text-left px-2 py-2 text-[12px] text-neutral-400 hover:text-white transition-colors border-0 bg-transparent">Appearance</button><button onClick={() => { setFullProfileOpen(false); setTab('config'); }} className="w-full text-left px-2 py-2 text-[12px] text-neutral-400 hover:text-white transition-colors border-0 bg-transparent">Account settings</button><div className="border-t border-white/[0.04]"/><button onClick={() => { setAuthToken(null); window.location.reload(); }} className="w-full text-center py-2 text-[11px] text-neutral-600 hover:text-red-400 transition-colors border-0 bg-transparent">Sign out</button></div></div></motion.div></>}
      </AnimatePresence>
    </aside>
  );
};

export default Sidebar;