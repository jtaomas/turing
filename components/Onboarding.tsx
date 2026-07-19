import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, BookOpen, Target, Zap, GraduationCap, School } from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: { year: 11|12; course: string; goal: string; institution: string }) => void;
}

const steps = [
  { id: 'welcome', title: 'Welcome to Turing', subtitle: 'Your NSW HSC mathematics workspace' },
  { id: 'year', title: 'What year are you in?', subtitle: 'This determines your curriculum stage' },
  { id: 'institution', title: 'Which school do you attend?', subtitle: 'Helps us contextualise your learning' },
  { id: 'course', title: 'Which course are you taking?', subtitle: 'Select your exact HSC mathematics enrolment' },
  { id: 'goal', title: 'What\'s your target?', subtitle: 'Set a goal to stay motivated' },
  { id: 'done', title: 'You\'re all set', subtitle: 'Ready to start practising' },
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [year, setYear] = useState<11|12>(12);
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('mx2');
  const [goal, setGoal] = useState('');

  const isLast = stepIdx === steps.length - 1;
  const currentStep = steps[stepIdx];

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('turing_onboarded', 'true');
      localStorage.setItem('turing_onboarding_course', course);
      localStorage.setItem('turing_institution', institution);
      onComplete({ year, course, goal, institution });
    } else {
      setStepIdx(s => s + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i}
              className={`h-1 transition-all duration-300 ${
                i < stepIdx ? 'w-6 bg-white' : i === stepIdx ? 'w-8 bg-white' : 'w-2 bg-white/[0.08]'
              }`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-white">{currentStep.title}</h1>
              <p className="text-[13px] text-neutral-500">{currentStep.subtitle}</p>
            </div>

            {}
            {stepIdx === 0 && (
              <div className="flex justify-center pt-4">
                <div className="w-20 h-20 bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <GraduationCap size={36} className="text-white" />
                </div>
              </div>
            )}

            {}
            {stepIdx === 1 && (
              <div className="space-y-3 pt-2">
                {([11, 12] as const).map(y => (
                  <button key={y} onClick={() => setYear(y)}
                    className={`w-full text-left px-5 py-4 border transition-colors ${
                      year === y ? 'border-white/[0.15] bg-white/[0.04]' : 'border-white/[0.04] hover:border-white/[0.08]'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-semibold text-white">Year {y}</p>
                        <p className="text-[12px] text-neutral-500 mt-0.5">{y === 11 ? 'Preliminary HSC — building foundations' : 'HSC — final examination year'}</p>
                      </div>
                      {year === y && <Check size={16} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {}
            {stepIdx === 2 && (
              <div className="space-y-4 pt-2">
                <div className="flex justify-center pt-2 pb-2">
                  <div className="w-14 h-14 bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <School size={24} className="text-neutral-400" />
                  </div>
                </div>
                <input
                  type="text"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  placeholder="e.g. Sydney Boys High School"
                  className="w-full bg-[#0b0c10] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder-neutral-600 focus:outline-none focus:border-white/[0.2] transition-colors"
                  autoFocus
                />
                <p className="text-[11px] text-neutral-600 text-center">Optional — you can skip this</p>
              </div>
            )}

            {}
            {stepIdx === 3 && (
              <div className="space-y-3 pt-2">
                {[
                  { id: 'mx2', label: 'Extension 2 (MX2)', units: '4U', desc: 'Mathematics Advanced + Extension 1 + Extension 2. Highest level — required for top engineering/science courses.' },
                  { id: 'mx1', label: 'Extension 1 (MX1)', units: '3U', desc: 'Mathematics Advanced + Extension 1. Strong foundation for university STEM.' },
                  { id: 'adv', label: 'Advanced (MA)', units: '2U', desc: 'Standard Mathematics Advanced. Counts toward ATAR with solid calculus and stats coverage.' },
                ].map(c => (
                  <button key={c.id} onClick={() => setCourse(c.id)}
                    className={`w-full text-left px-5 py-4 border transition-colors ${
                      course === c.id ? 'border-white/[0.15] bg-white/[0.04]' : 'border-white/[0.04] hover:border-white/[0.08]'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-neutral-400 bg-white/[0.04] px-2 py-0.5 shrink-0">{c.units}</span>
                          <p className="text-[14px] font-semibold text-white">{c.label}</p>
                        </div>
                        <p className="text-[12px] text-neutral-500 mt-1.5 leading-relaxed">{c.desc}</p>
                      </div>
                      {course === c.id && <Check size={16} className="text-white shrink-0 ml-3" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {}
            {stepIdx === 4 && (
              <div className="space-y-3 pt-2">
                {[
                  { id: 'band6', label: 'Band 6 / E4', desc: 'Top tier — 90+ ATAR contribution', icon: Zap },
                  { id: 'band5', label: 'Band 5 / E3', desc: 'Strong — solid marks across the board', icon: Target },
                  { id: 'improve', label: 'Improve my marks', desc: 'Focused on getting better each week', icon: BookOpen },
                ].map(g => (
                  <button key={g.id} onClick={() => setGoal(g.label)}
                    className={`w-full text-left px-5 py-4 border transition-colors ${
                      goal === g.label ? 'border-white/[0.15] bg-white/[0.04]' : 'border-white/[0.04] hover:border-white/[0.08]'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <g.icon size={18} className="text-neutral-500" />
                        <div>
                          <p className="text-[14px] font-semibold text-white">{g.label}</p>
                          <p className="text-[12px] text-neutral-500 mt-0.5">{g.desc}</p>
                        </div>
                      </div>
                      {goal === g.label && <Check size={16} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {}
            {stepIdx === 5 && (
              <div className="text-center pt-4 space-y-3">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <Check size={28} className="text-white" />
                  </div>
                </div>
                <div className="text-[13px] text-neutral-400 space-y-1.5">
                  <p>Year {year}</p>
                  <p className="text-white font-semibold">{{adv:'Advanced (2U)',mx1:'Extension 1 (3U)',mx2:'Extension 2 (4U)'}[course]}</p>
                  {institution && <p className="text-neutral-500">{institution}</p>}
                  {goal && <p>{goal}</p>}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {}
        <div className="mt-8 flex justify-center">
          {stepIdx > 0 && stepIdx < 5 && (
            <button onClick={() => setStepIdx(s => s - 1)}
              className="mr-4 text-[13px] text-neutral-600 hover:text-neutral-400 transition-colors border-0 bg-transparent">
              Back
            </button>
          )}
          <button onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-white text-black text-[13px] font-semibold border-0 hover:bg-neutral-200 transition-colors">
            {isLast ? 'Get started' : 'Continue'}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
