import React, { useState, useEffect } from 'react';
import { User, Shield, Monitor, Bell, Palette, Database, Trash2, Download, LogOut, CheckCircle2, Loader2, ChevronRight, Globe, Eye, Moon, Sun, Type, Zap, CreditCard, AlertTriangle, Lock, Key, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrentUser, updateProfile, setAuthToken, User as UserType } from '../services/api';

interface ConfigProps { selectedTopicId?: string | null; onSelectTopic?: (id: string | null) => void; }

const Config: React.FC<ConfigProps> = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [user, setUser] = useState<UserType | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifReminders, setNotifReminders] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontScale, setFontScale] = useState(100);
  const [dataCollection, setDataCollection] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('turing_auth_token');
    if (token) getCurrentUser().then(data => { setUser(data.user); setDisplayName(data.user.display_name); setInstitution(data.user.institution); setCourse(data.user.course); }).catch(() => {});
  }, []);

  const handleSaveProfile = async () => { setSaving(true); try { await updateProfile({ display_name: displayName, institution, course } as any); setSaved(true); setTimeout(() => setSaved(false), 3000); } catch (e) { } finally { setSaving(false); } };

  const tabs = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Data', icon: Lock },
    { id: 'account', label: 'Account', icon: Shield },
  ];

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 border-0 transition-colors ${checked ? 'bg-emerald-500' : 'bg-white/[0.08]'}`}>
      <div className={`absolute top-0.5 h-4 w-4 bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );

  const SettingRow = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.04]">
      <div className="pr-4"><p className="text-[13px] font-medium text-white">{label}</p>{desc && <p className="text-[11px] text-neutral-500 mt-0.5">{desc}</p>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const SectionTitle = ({ title }: { title: string }) => (
    <h3 className="text-xs font-semibold text-neutral-400 mt-6 first:mt-0 mb-1">{title}</h3>
  );

  const SettingsBlock = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-[#0b0c10] border border-white/[0.06] p-6">
      {children}
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 pb-20">
      <header className="border-b border-white/5 pb-6"><h1 className="text-3xl font-light tracking-tight text-white">Settings</h1></header>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        <div className="space-y-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all border-0 ${activeTab===tab.id?'bg-white/[0.06] text-white':'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]'}`}>
              <tab.icon size={15} className={activeTab===tab.id?'text-emerald-400':'text-neutral-600'} />{tab.label}{activeTab===tab.id&&<ChevronRight size={13} className="ml-auto text-emerald-400"/>}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.2}}>
            <div className="bg-[#0b0c10] border border-white/[0.06] p-6">
            {activeTab==='general'&&(<>
              <SectionTitle title="Language & Region"/>
              <SettingRow label="Language" desc="Interface display language"><select className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-white"><option value="en" className="bg-[#0b0c10]">English (Australia)</option><option value="en-US" className="bg-[#0b0c10]">English (US)</option></select></SettingRow>
              <SettingRow label="Startup page" desc="Which page opens when you launch Turing"><select className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-white"><option value="home" className="bg-[#0b0c10]">Home</option><option value="map" className="bg-[#0b0c10]">Topic Map</option><option value="sets" className="bg-[#0b0c10]">My Sets</option></select></SettingRow>
              <SectionTitle title="Typing & Input"/>
              <SettingRow label="Auto-correct LaTeX" desc="Automatically fix common LaTeX errors"><Toggle checked={true} onChange={()=>{}}/></SettingRow>
              <SettingRow label="Math input mode" desc="Default input method for answering"><select className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-white"><option value="draw" className="bg-[#0b0c10]">Handwriting (Ink)</option><option value="text" className="bg-[#0b0c10]">LaTeX Text</option></select></SettingRow>
            </>)}
            {activeTab==='profile'&&(<>
              <SectionTitle title="Personal Information"/>
              {user&&(<div className="flex items-center gap-4 py-4 border-b border-white/[0.04]">{user.picture_url?<img src={user.picture_url} alt="" className="w-16 h-16 rounded-full border-2 border-white/[0.1]"/>:<div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/20 flex items-center justify-center text-2xl">{(user.display_name||'S')[0].toUpperCase()}</div>}<div><p className="text-base font-bold text-white">{user.display_name}</p><p className="text-xs text-neutral-500">{user.email}</p><p className="text-[10px] text-neutral-600 mt-0.5">Google SSO · Managed by your institution</p></div></div>)}
              <SettingRow label="Display name" desc="How your name appears across Turing"><input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value)} className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-white w-48 focus:outline-none focus:border-emerald-500/50"/></SettingRow>
              <SectionTitle title="Academic Profile"/>
              <SettingRow label="Academic ID" desc="Your unique Turing identifier"><span className="text-xs text-neutral-500 mono-font">{user?.academic_id||'TURING--'}</span></SettingRow>
              <SettingRow label="Current course" desc="NSW HSC mathematics course"><select value={course} onChange={e=>setCourse(e.target.value)} className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-white"><option value="Mathematics Advanced (MA-ADV)" className="bg-[#0b0c10]">Mathematics Advanced</option><option value="Mathematics Extension 1 (MX1)" className="bg-[#0b0c10]">Mathematics Extension 1</option><option value="Mathematics Extension 2 (MX2)" className="bg-[#0b0c10]">Mathematics Extension 2</option></select></SettingRow>
              <SettingRow label="Institution" desc="Your school or tutoring centre"><input type="text" value={institution} onChange={e=>setInstitution(e.target.value)} className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-white w-48 focus:outline-none focus:border-emerald-500/50"/></SettingRow>
              <div className="pt-4"><button onClick={handleSaveProfile} disabled={saving} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-all border-0 flex items-center gap-2">{saving?<Loader2 size={14} className="animate-spin"/>:saved?<CheckCircle2 size={14}/>:null}{saving?'Saving…':saved?'Saved':'Save changes'}</button></div>
            </>)}
            {activeTab==='appearance'&&(<>
              <SectionTitle title="Theme"/>
              <SettingRow label="Interface theme" desc="Dark, light, or follow your system"><div className="flex gap-1.5 bg-white/[0.03] rounded-lg p-1">{[{id:'dark',icon:Moon,label:'Dark'},{id:'light',icon:Sun,label:'Light'},{id:'system',icon:Monitor,label:'System'}].map(t=>(<button key={t.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border-0 transition-colors ${t.id==='dark'?'bg-white/[0.08] text-white':'text-neutral-500 hover:text-neutral-300'}`}><t.icon size={12}/> {t.label}</button>))}</div></SettingRow>
              <SectionTitle title="Typography"/>
              <SettingRow label="Font scale" desc={`${fontScale}% of default size`}><div className="flex items-center gap-2"><span className="text-[10px] text-neutral-500">A</span><input type="range" min={80} max={150} value={fontScale} onChange={e=>setFontScale(Number(e.target.value))} className="w-24 h-1 accent-emerald-500"/><span className="text-sm text-neutral-300">A</span></div></SettingRow>
              <SectionTitle title="Display"/>
              <SettingRow label="Reduce motion" desc="Minimise animations and transitions"><Toggle checked={reduceMotion} onChange={setReduceMotion}/></SettingRow>
              <SettingRow label="High contrast" desc="Increase contrast for better visibility"><Toggle checked={highContrast} onChange={setHighContrast}/></SettingRow>
              <SettingRow label="Dyslexic-friendly font" desc="Use OpenDyslexic for easier reading"><Toggle checked={false} onChange={()=>{}}/></SettingRow>
            </>)}
            {activeTab==='notifications'&&(<>
              <SectionTitle title="Channels"/>
              <SettingRow label="Email notifications" desc="Receive updates via email"><Toggle checked={notifEmail} onChange={setNotifEmail}/></SettingRow>
              <SettingRow label="Push notifications" desc="Browser push notifications"><Toggle checked={notifPush} onChange={setNotifPush}/></SettingRow>
              <SectionTitle title="Study Alerts"/>
              <SettingRow label="Daily study reminders" desc="Get a reminder to practise each day"><Toggle checked={notifReminders} onChange={setNotifReminders}/></SettingRow>
              <SettingRow label="Weekly progress report" desc="Summary of your week every Monday"><Toggle checked={notifWeekly} onChange={setNotifWeekly}/></SettingRow>
            </>)}
            {activeTab==='privacy'&&(<>
              <SectionTitle title="Data Collection"/>
              <SettingRow label="Usage analytics" desc="Help improve Turing with anonymous usage data"><Toggle checked={dataCollection} onChange={setDataCollection}/></SettingRow>
              <SettingRow label="Share with institution" desc="Allow your school to view your progress"><Toggle checked={false} onChange={()=>{}}/></SettingRow>
              <SectionTitle title="Your Data"/>
              <SettingRow label="Export all data" desc="Download your questions, history, and progress"><button className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] font-medium text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"><Download size={11}/> Export</button></SettingRow>
              <SettingRow label="Clear question history" desc="Remove all past questions from your history"><button onClick={()=>{localStorage.removeItem('turing_history');}} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"><Trash2 size={11}/> Clear history</button></SettingRow>
              <SettingRow label="Delete account" desc="Permanently remove your account and all data"><button onClick={()=>setShowDeleteConfirm(true)} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"><AlertTriangle size={11}/> Delete account</button></SettingRow>
              <AnimatePresence>{showDeleteConfirm&&(<motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden"><div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 mt-2"><p className="text-xs font-bold text-red-400 mb-2">Are you absolutely sure?</p><p className="text-[11px] text-neutral-400 mb-3">This will permanently delete your account, question history, and all associated data. This action cannot be undone.</p><div className="flex gap-2"><button onClick={()=>setShowDeleteConfirm(false)} className="px-3 py-1.5 text-[10px] font-medium border border-white/[0.08] rounded-lg text-neutral-400 bg-transparent">Cancel</button><button className="px-3 py-1.5 text-[10px] font-bold bg-red-500 text-white rounded-lg border-0">Delete my account</button></div></div></motion.div>)}</AnimatePresence>
            </>)}
            {activeTab==='account'&&(<>
              <SectionTitle title="Plan"/>
              <div className="py-4 border-b border-white/[0.04]"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-white">Free Plan</p><p className="text-[11px] text-neutral-500 mt-0.5">Basic access to all syllabus topics</p></div><button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-bold rounded-xl border-0 transition-colors flex items-center gap-1.5"><Zap size={11}/> Upgrade to Pro</button></div><div className="mt-3 space-y-1.5">{[{label:'Full syllabus access'},{label:'Unlimited question history'},{label:'AI-powered feedback'},{label:'PDF worksheet import'}].map((f,i)=>(<div key={i} className="flex items-center gap-2 text-[11px] text-neutral-400"><CheckCircle2 size={11} className="text-emerald-400"/>{f.label}</div>))}</div></div>
              <SectionTitle title="Sessions"/>
              <SettingRow label="Sign out everywhere" desc="Sign out of all devices and sessions"><button onClick={()=>{setAuthToken(null);window.location.reload();}} className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] font-medium text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5"><LogOut size={11}/> Sign out</button></SettingRow>
            </>)}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Config;
