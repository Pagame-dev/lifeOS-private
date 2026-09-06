import { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, GraduationCap, CalendarDays, BookOpen, Moon, Sparkles, Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const SUBJECT_COLORS = [
  '#8b9a6b', '#7a8fa3', '#c4a97d', '#a070a0',
  '#5e8b7e', '#b07d5e', '#6b7a8e', '#9e8b6b',
  '#7e6b8b', '#5e9e8b', '#8b7e5e', '#6b9e9e',
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

interface OnboardingData {
  displayName: string;
  usesWeekAB: boolean;
  currentWeek: 'A' | 'B';
  schoolDays: number[];
  subjects: { name: string; color: string; teacher: string }[];
  routines: { name: string; startTime: string; days: number[] }[];
  bedtime: string;
  wakeTime: string;
  planningMode: string;
  logopedeEnabled: boolean;
}

export function OnboardingWizard() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    usesWeekAB: true,
    currentWeek: 'A',
    schoolDays: [1, 2, 3, 4, 5],
    subjects: [],
    routines: [],
    bedtime: '22:30',
    wakeTime: '07:00',
    planningMode: 'balanced',
    logopedeEnabled: false,
  });

  const steps = [
    { title: 'Welcome', icon: Sparkles },
    { title: 'About You', icon: Check },
    { title: 'School', icon: GraduationCap },
    { title: 'Week A/B', icon: CalendarDays },
    { title: 'Subjects', icon: BookOpen },
    { title: 'Routines', icon: Moon },
    { title: 'Preferences', icon: Bell },
  ];

  function update(patch: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  async function finish() {
    setSaving(true);
    try {
      if (user) {
        await supabase
          .from('profiles')
          .update({
            display_name: data.displayName,
            current_week_type: data.currentWeek,
            onboarding_completed: true,
          })
          .eq('id', user.id);

        await supabase
          .from('user_settings')
          .update({
            bedtime: data.bedtime,
            wake_time: data.wakeTime,
            planning_mode: data.planningMode,
            logopede_enabled: data.logopedeEnabled,
          })
          .eq('user_id', user.id);

        if (data.subjects.length > 0) {
          await supabase.from('subjects').insert(
            data.subjects.map((s) => ({
              name: s.name,
              color: s.color,
              teacher: s.teacher,
            }))
          );
        }

        if (data.routines.length > 0) {
          for (const routine of data.routines) {
            const { data: routineData } = await supabase
              .from('routines')
              .insert({
                name: routine.name,
                start_time: routine.startTime,
                applicable_days: routine.days,
                is_active: true,
              })
              .select('id')
              .single();
            if (routineData) {
              // no steps added during onboarding — user can add later
            }
          }
        }

        await refreshProfile();
      }
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setSaving(false);
    }
  }

  const canProceed = (() => {
    switch (step) {
      case 1: return data.displayName.trim().length > 0;
      case 3: return data.schoolDays.length > 0;
      default: return true;
    }
  })();

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sage-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-warm/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg animate-fade-in">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 transition-all ${
                  active ? 'text-sage-300' : done ? 'text-sage-500/50' : 'text-cream-dim/30'
                }`}
              >
                {i > 0 && <div className={`w-4 h-px ${done ? 'bg-sage-500/30' : 'bg-white/[0.06]'}`} />}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                  active ? 'border-sage-500/30 bg-sage-500/10' : done ? 'border-sage-500/15 bg-sage-500/5' : 'border-white/[0.06]'
                }`}>
                  <Icon size={13} strokeWidth={active ? 2 : 1.5} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="glass-card p-6 md:p-8 min-h-[340px] flex flex-col">
          {/* Step content */}
          <div className="flex-1">
            {step === 0 && (
              <div className="text-center space-y-4 animate-slide-up">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-sage-500/10 border border-sage-500/20 mb-2">
                  <span className="font-display text-2xl text-sage-300">L</span>
                </div>
                <h1 className="font-display text-2xl text-cream">Welcome to Life OS</h1>
                <p className="text-sm text-cream-dim leading-relaxed max-w-sm mx-auto">
                  Your personal operating system for school, tasks, routines, and everything in between.
                  Let's set things up so the system can adapt to your life.
                </p>
                <p className="text-xs text-cream-dim/60 mt-4">
                  This takes about 2 minutes. You can change everything later.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5 animate-slide-up">
                <div>
                  <h2 className="font-display text-xl text-cream mb-1">About You</h2>
                  <p className="text-sm text-cream-dim">What should we call you?</p>
                </div>
                <div>
                  <label className="block text-xs text-cream-dim mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={data.displayName}
                    onChange={(e) => update({ displayName: e.target.value })}
                    className="input-field"
                    placeholder="Your name"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-slide-up">
                <div>
                  <h2 className="font-display text-xl text-cream mb-1">School Setup</h2>
                  <p className="text-sm text-cream-dim">Which days do you have school?</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DAY_INDICES.map((dayIdx) => {
                    const selected = data.schoolDays.includes(dayIdx);
                    return (
                      <button
                        key={dayIdx}
                        onClick={() => {
                          const days = selected
                            ? data.schoolDays.filter((d) => d !== dayIdx)
                            : [...data.schoolDays, dayIdx];
                          update({ schoolDays: days });
                        }}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                          selected
                            ? 'bg-sage-500/10 text-sage-200 border-sage-500/25'
                            : 'text-cream-dim border-white/[0.06] hover:text-cream'
                        }`}
                      >
                        {DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-slide-up">
                <div>
                  <h2 className="font-display text-xl text-cream mb-1">Week A / Week B</h2>
                  <p className="text-sm text-cream-dim">Does your school alternate between two weekly schedules?</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.usesWeekAB}
                    onChange={(e) => update({ usesWeekAB: e.target.checked })}
                    className="accent-sage-500 w-4 h-4"
                  />
                  <span className="text-sm text-cream">Yes, my school uses Week A / Week B</span>
                </label>
                {data.usesWeekAB && (
                  <div>
                    <label className="block text-xs text-cream-dim mb-1.5">Which week are you currently in?</label>
                    <div className="flex gap-2">
                      {(['A', 'B'] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() => update({ currentWeek: w })}
                          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                            data.currentWeek === w
                              ? 'bg-sage-500/15 text-sage-200 border-sage-500/25'
                              : 'text-cream-dim border-white/[0.06] hover:text-cream'
                          }`}
                        >
                          Week {w}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!data.usesWeekAB && (
                  <p className="text-xs text-cream-dim/60">
                    No problem — all events will apply to every week. You can enable this later if needed.
                  </p>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <h2 className="font-display text-xl text-cream mb-1">Your Subjects</h2>
                  <p className="text-sm text-cream-dim">Add your school subjects. You can skip this and add later.</p>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {data.subjects.map((subject, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const subjects = [...data.subjects];
                          subjects[i].color = SUBJECT_COLORS[(i + 1) % SUBJECT_COLORS.length];
                          update({ subjects });
                        }}
                        className="w-6 h-6 rounded-full shrink-0 border border-white/10"
                        style={{ backgroundColor: subject.color }}
                      />
                      <input
                        type="text"
                        value={subject.name}
                        onChange={(e) => {
                          const subjects = [...data.subjects];
                          subjects[i].name = e.target.value;
                          update({ subjects });
                        }}
                        className="input-field flex-1"
                        placeholder="Subject name"
                      />
                      <input
                        type="text"
                        value={subject.teacher}
                        onChange={(e) => {
                          const subjects = [...data.subjects];
                          subjects[i].teacher = e.target.value;
                          update({ subjects });
                        }}
                        className="input-field w-28"
                        placeholder="Teacher"
                      />
                      <button
                        onClick={() => update({ subjects: data.subjects.filter((_, idx) => idx !== i) })}
                        className="text-cream-dim hover:text-red-400 transition-colors px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => update({
                    subjects: [...data.subjects, { name: '', color: SUBJECT_COLORS[data.subjects.length % SUBJECT_COLORS.length], teacher: '' }]
                  })}
                  className="btn-ghost flex items-center gap-1.5 text-sm"
                >
                  + Add subject
                </button>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <h2 className="font-display text-xl text-cream mb-1">Daily Routines</h2>
                  <p className="text-sm text-cream-dim">Set up recurring routines like morning or evening routines. Optional.</p>
                </div>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {data.routines.map((routine, i) => (
                    <div key={i} className="glass-card p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={routine.name}
                          onChange={(e) => {
                            const routines = [...data.routines];
                            routines[i].name = e.target.value;
                            update({ routines });
                          }}
                          className="input-field flex-1"
                          placeholder="Routine name (e.g. Morning routine)"
                        />
                        <input
                          type="time"
                          value={routine.startTime}
                          onChange={(e) => {
                            const routines = [...data.routines];
                            routines[i].startTime = e.target.value;
                            update({ routines });
                          }}
                          className="input-field w-28"
                        />
                        <button
                          onClick={() => update({ routines: data.routines.filter((_, idx) => idx !== i) })}
                          className="text-cream-dim hover:text-red-400 transition-colors px-1"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {DAY_INDICES.map((dayIdx) => {
                          const dayName = DAY_NAMES[dayIdx === 0 ? 6 : dayIdx - 1];
                          const selected = routine.days.includes(dayIdx);
                          return (
                            <button
                              key={dayIdx}
                              onClick={() => {
                                const routines = [...data.routines];
                                routines[i].days = selected
                                  ? routine.days.filter((d) => d !== dayIdx)
                                  : [...routine.days, dayIdx];
                                update({ routines });
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                selected
                                  ? 'bg-sage-500/15 text-sage-200 border border-sage-500/20'
                                  : 'text-cream-dim/50 border border-white/[0.04]'
                              }`}
                            >
                              {dayName.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => update({
                    routines: [...data.routines, { name: '', startTime: '07:00', days: [1, 2, 3, 4, 5] }]
                  })}
                  className="btn-ghost flex items-center gap-1.5 text-sm"
                >
                  + Add routine
                </button>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-5 animate-slide-up">
                <div>
                  <h2 className="font-display text-xl text-cream mb-1">Preferences</h2>
                  <p className="text-sm text-cream-dim">A few defaults to get you started.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-cream-dim mb-1.5">Target Bedtime</label>
                    <input
                      type="time"
                      value={data.bedtime}
                      onChange={(e) => update({ bedtime: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cream-dim mb-1.5">Target Wake Time</label>
                    <input
                      type="time"
                      value={data.wakeTime}
                      onChange={(e) => update({ wakeTime: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-cream-dim mb-1.5">Default Planning Mode</label>
                  <select
                    value={data.planningMode}
                    onChange={(e) => update({ planningMode: e.target.value })}
                    className="input-field"
                  >
                    <option value="balanced" className="bg-charcoal-800">Balanced — mix of work and rest</option>
                    <option value="productive" className="bg-charcoal-800">Productive — prioritise work</option>
                    <option value="relaxed" className="bg-charcoal-800">Relaxed — prioritise rest</option>
                    <option value="custom" className="bg-charcoal-800">Custom — I'll configure later</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.logopedeEnabled}
                    onChange={(e) => update({ logopedeEnabled: e.target.checked })}
                    className="accent-sage-500 w-4 h-4"
                  />
                  <span className="text-sm text-cream">I have logopède exercises (2x/day)</span>
                </label>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0 || saving}
              className="btn-ghost flex items-center gap-1.5 disabled:opacity-30"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed || saving}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-30"
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={saving}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? 'Setting up...' : 'Complete Setup'} <Check size={16} />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-cream-dim/40 mt-4">
          Step {step + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
}
