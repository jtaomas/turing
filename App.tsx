import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Home from './components/Home';
import TopicMap from './components/TopicMap';
import QuestionSets from './components/Scanner';
import Config from './components/Config';
import AuthGuard from './components/AuthGuard';
import { User } from './services/api';
import { setAuthToken } from './services/api';
import type { SessionMode } from './components/Scanner';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null);
  const [historyEntries, setHistoryEntries] = useState<Array<{ question: string }> | null>(null);
  const handleAuthChange = (user: User | null) => { setCurrentUser(user); };
  const handleLogout = () => { setAuthToken(null); setCurrentUser(null); window.location.reload(); };

  const handleStartSession = (mode: SessionMode) => {
    setSessionMode(mode);
    setActiveTab('home');
  };

  const handleClearSession = () => {
    setSessionMode(null);
  };

  const handleSessionSelect = (entries: Array<{ question: string }>) => {
    setHistoryEntries(entries);
    setActiveTab('home');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <Home sessionMode={sessionMode} onClearSession={handleClearSession} historyEntries={historyEntries} onHistoryLoaded={() => setHistoryEntries(null)} />;
      case 'map': return <TopicMap />;
      case 'marking': return <QuestionSets onStartSession={handleStartSession} />;
      case 'config': return <Config selectedTopicId={selectedTopicId} onSelectTopic={setSelectedTopicId} />;
      default: return <div className="flex flex-col items-center justify-center h-full p-20 text-center"><h2 className="text-2xl font-bold text-neutral-400">No Content Found</h2></div>;
    }
  };

  return (
    <AuthGuard onAuthChange={handleAuthChange}>
      <div className="min-h-screen bg-[#060608] flex text-zinc-200">
        <Sidebar currentTab={activeTab} setTab={setActiveTab} onHistorySelect={(e) => setHistoryEntries([e])} onSessionSelect={handleSessionSelect} />
        <main className="flex-1 overflow-y-auto">
          <header className="h-10 flex items-center px-4 lg:px-6 sticky top-0 bg-[#060608]/95 z-10 border-b border-white/[0.03] gap-3">
          </header>
          <div className="pb-10">{renderContent()}</div>
        </main>
      </div>
    </AuthGuard>
  );
};

export default App;
