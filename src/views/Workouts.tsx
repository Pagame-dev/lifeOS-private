import { useEffect, useState } from 'react';
import { Dumbbell, Plus, X, Trash2, Check, SkipForward, Activity, Moon, Sun, Repeat, Edit3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Workout, LogopedeSession, WorkoutRecurrence } from '@/lib/types';

type Tab = 'workouts' | 'logopede' | 'recurring';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Workouts() {
  const [tab, setTab] = useState<Tab>('workouts');

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-cream">Health & Wellness</h1>
      <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg w-fit">
        {(['workouts', 'recurring', 'logopede'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
              tab === t ? 'bg-charcoal-700 text-cream' : 'text-cream-dim hover:text-cream'
            }`}
          >
            {t === 'workouts' ? 'Workouts' : t === 'recurring' ? 'Recurring' : 'Logopède'}
          </button>
        ))}
      </div>
      {tab === 'workouts' ? <WorkoutsTab /> : tab === 'recurring' ? <RecurringTab /> : <LogopedeTab />}
    </div>
  );
}

function WorkoutsTab() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);

  async function loadData() {
    const { data } = await supabase.from('workouts').select('*').order('scheduled_date', { ascending: false });
    setWorkouts((data as Workout[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleStatus(workout: Workout) {
    const newStatus = workout.status === 'completed' ? 'planned' : 'completed';
    await supabase.from('workouts').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', workout.id);
    loadData();
  }

  async function skipWorkout(workout: Workout) {
    await supabase.from('workouts').update({ status: 'skipped' }).eq('id', workout.id);
    loadData();
  }

  async function deleteWorkout(workout: Workout) {
    await supabase.from('workouts').delete().eq('id', workout.id);
    loadData();
  }

  if (loading) return <div className="glass-card h-64 animate-pulse" />;

  const now = new Date().toISOString().split('T')[0];
  const upcoming = workouts.filter((w) => w.scheduled_date >= now && w.status === 'planned');
  const completed = workouts.filter((w) => w.status === 'completed');
  const skipped = workouts.filter((w) => w.status === 'skipped');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider">Workouts</h2>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Plus size={16} /> Add
        </button>
      </div>

      {creating && (
        <WorkoutEditModal workout={null} onClose={() => setCreating(false)} onSaved={() => { loadData(); setCreating(false); }} />
      )}
      {editing && (
        <WorkoutEditModal workout={editing} onClose={() => setEditing(null)} onSaved={() => { loadData(); setEditing(null); }} />
      )}

      {upcoming.length === 0 && !creating ? (
        <div className="glass-card p-8 text-center">
          <Dumbbell size={28} className="mx-auto text-cream-dim/40 mb-3" />
          <p className="text-sm text-cream-dim">No upcoming workouts</p>
          <p className="text-xs text-cream-dim/60 mt-1">Schedule a workout or set up a recurring routine</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((workout) => {
            const isToday = workout.scheduled_date === now;
            return (
              <div key={workout.id} className="glass-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-warm/10 border border-accent-warm/15 flex items-center justify-center shrink-0">
                    <Dumbbell size={18} className="text-accent-warm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream">{workout.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-cream-dim">
                      <span>{new Date(workout.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      {workout.scheduled_time && <span>· {workout.scheduled_time}</span>}
                      {workout.workout_type && <span>· {workout.workout_type}</span>}
                      {workout.duration_min && <span>· {workout.duration_min}m</span>}
                      {isToday && <span className="text-sage-300">· Today</span>}
                    </div>
                  </div>
                  <button onClick={() => setEditing(workout)} className="p-2 rounded-lg text-cream-dim hover:bg-white/[0.03] transition-colors" title="Edit">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => toggleStatus(workout)} className="p-2 rounded-lg text-sage-300 hover:bg-sage-500/10 transition-colors" title="Complete">
                    <Check size={16} />
                  </button>
                  <button onClick={() => skipWorkout(workout)} className="p-2 rounded-lg text-cream-dim hover:bg-white/[0.03] transition-colors" title="Skip">
                    <SkipForward size={16} />
                  </button>
                  <button onClick={() => deleteWorkout(workout)} className="p-2 rounded-lg text-cream-dim/30 hover:text-red-400/70 transition-colors" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
                {workout.jefit_link && (
                  <a href={workout.jefit_link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-cool hover:underline mt-2 inline-block">
                    View Jefit routine
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Completed ({completed.length})</h3>
          <div className="space-y-2">
            {completed.slice(0, 10).map((w) => (
              <div key={w.id} className="glass-card px-4 py-2.5 flex items-center gap-3 opacity-60">
                <Check size={16} className="text-sage-300 shrink-0" />
                <span className="text-sm text-cream-dim line-through">{w.title}</span>
                <span className="text-xs text-cream-dim ml-auto">{new Date(w.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {skipped.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Skipped ({skipped.length})</h3>
          <div className="space-y-2">
            {skipped.slice(0, 5).map((w) => (
              <div key={w.id} className="glass-card px-4 py-2.5 flex items-center gap-3 opacity-40">
                <SkipForward size={16} className="text-cream-dim shrink-0" />
                <span className="text-sm text-cream-dim">{w.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RecurringTab() {
  const [recurrences, setRecurrences] = useState<WorkoutRecurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WorkoutRecurrence | null>(null);

  async function loadData() {
    const { data } = await supabase.from('workout_recurrences').select('*').order('day_of_week');
    setRecurrences((data as WorkoutRecurrence[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleActive(rec: WorkoutRecurrence) {
    await supabase.from('workout_recurrences').update({ is_active: !rec.is_active }).eq('id', rec.id);
    loadData();
  }

  async function deleteRecurrence(rec: WorkoutRecurrence) {
    await supabase.from('workout_recurrences').delete().eq('id', rec.id);
    loadData();
  }

  if (loading) return <div className="glass-card h-64 animate-pulse" />;

  const active = recurrences.filter((r) => r.is_active);
  const inactive = recurrences.filter((r) => !r.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider">Recurring Workouts</h2>
          <p className="text-xs text-cream-dim/60 mt-1">Set up workouts that repeat every week automatically</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Plus size={16} /> Add
        </button>
      </div>

      {creating && (
        <RecurrenceEditModal recurrence={null} onClose={() => setCreating(false)} onSaved={() => { loadData(); setCreating(false); }} />
      )}
      {editing && (
        <RecurrenceEditModal recurrence={editing} onClose={() => setEditing(null)} onSaved={() => { loadData(); setEditing(null); }} />
      )}

      {recurrences.length === 0 && !creating ? (
        <div className="glass-card p-8 text-center">
          <Repeat size={28} className="mx-auto text-cream-dim/40 mb-3" />
          <p className="text-sm text-cream-dim">No recurring workouts</p>
          <p className="text-xs text-cream-dim/60 mt-1">Create a recurring workout to automatically schedule it each week</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((rec) => (
            <div key={rec.id} className="glass-card px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-warm/10 border border-accent-warm/15 flex items-center justify-center shrink-0">
                  <Repeat size={18} className="text-accent-warm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cream">{rec.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-cream-dim">
                    <span>{DAY_SHORT[rec.day_of_week]}</span>
                    {rec.scheduled_time && <span>· {rec.scheduled_time}</span>}
                    {rec.workout_type && <span>· {rec.workout_type}</span>}
                    {rec.duration_min && <span>· {rec.duration_min}m</span>}
                  </div>
                </div>
                <button onClick={() => setEditing(rec)} className="p-2 rounded-lg text-cream-dim hover:bg-white/[0.03] transition-colors" title="Edit">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => toggleActive(rec)} className="p-2 rounded-lg text-sage-300 hover:bg-sage-500/10 transition-colors" title="Pause">
                  <Check size={16} />
                </button>
                <button onClick={() => deleteRecurrence(rec)} className="p-2 rounded-lg text-cream-dim/30 hover:text-red-400/70 transition-colors" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
              {rec.jefit_link && (
                <a href={rec.jefit_link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-cool hover:underline mt-2 inline-block">
                  View Jefit routine
                </a>
              )}
            </div>
          ))}
          {inactive.map((rec) => (
            <div key={rec.id} className="glass-card px-4 py-3 opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                  <Repeat size={18} className="text-cream-dim" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cream-dim">{rec.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-cream-dim/60">
                    <span>{DAY_SHORT[rec.day_of_week]}</span>
                    <span>· Paused</span>
                  </div>
                </div>
                <button onClick={() => toggleActive(rec)} className="p-2 rounded-lg text-sage-300 hover:bg-sage-500/10 transition-colors" title="Resume">
                  <Check size={16} />
                </button>
                <button onClick={() => deleteRecurrence(rec)} className="p-2 rounded-lg text-cream-dim/30 hover:text-red-400/70 transition-colors" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutEditModal({ workout, onClose, onSaved }: { workout: Workout | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(workout?.title || '');
  const [workoutType, setWorkoutType] = useState(workout?.workout_type || '');
  const [date, setDate] = useState(workout?.scheduled_date || new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState(workout?.scheduled_time || '');
  const [duration, setDuration] = useState(workout?.duration_min?.toString() || '');
  const [jefitLink, setJefitLink] = useState(workout?.jefit_link || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const data = {
      title: title.trim(),
      workout_type: workoutType.trim(),
      scheduled_date: date,
      scheduled_time: scheduledTime || null,
      duration_min: duration ? parseInt(duration) : null,
      jefit_link: jefitLink.trim(),
    };
    try {
      const result = workout
        ? await supabase.from('workouts').update(data).eq('id', workout.id)
        : await supabase.from('workouts').insert(data);
      if (result.error) throw result.error;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!workout) return;
    setSaving(true);
    await supabase.from('workouts').delete().eq('id', workout.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">{workout ? 'Edit Workout' : 'New Workout'}</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Workout title" autoFocus />
          <input type="text" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} className="input-field" placeholder="Type (e.g. Push, Pull, Legs)" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="input-field" placeholder="Time" />
          </div>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field" placeholder="Duration (min)" min={5} />
          <input type="url" value={jefitLink} onChange={(e) => setJefitLink(e.target.value)} className="input-field" placeholder="Jefit link (optional)" />
          {error && <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            {workout && <button onClick={handleDelete} disabled={saving} className="rounded-lg border border-red-500/15 px-4 py-2.5 text-sm text-red-400/80 transition-colors hover:bg-red-500/5 disabled:opacity-50"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecurrenceEditModal({ recurrence, onClose, onSaved }: { recurrence: WorkoutRecurrence | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(recurrence?.title || '');
  const [workoutType, setWorkoutType] = useState(recurrence?.workout_type || '');
  const [dayOfWeek, setDayOfWeek] = useState(recurrence?.day_of_week ?? 1);
  const [scheduledTime, setScheduledTime] = useState(recurrence?.scheduled_time || '');
  const [duration, setDuration] = useState(recurrence?.duration_min?.toString() || '');
  const [jefitLink, setJefitLink] = useState(recurrence?.jefit_link || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const data = {
      title: title.trim(),
      workout_type: workoutType.trim(),
      day_of_week: dayOfWeek,
      scheduled_time: scheduledTime || null,
      duration_min: duration ? parseInt(duration) : null,
      jefit_link: jefitLink.trim(),
    };
    try {
      const result = recurrence
        ? await supabase.from('workout_recurrences').update(data).eq('id', recurrence.id)
        : await supabase.from('workout_recurrences').insert(data);
      if (result.error) throw result.error;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!recurrence) return;
    setSaving(true);
    await supabase.from('workout_recurrences').delete().eq('id', recurrence.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">{recurrence ? 'Edit Recurring Workout' : 'New Recurring Workout'}</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Workout title" autoFocus />
          <input type="text" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} className="input-field" placeholder="Type (e.g. Push, Pull, Legs)" />
          <div className="grid grid-cols-2 gap-3">
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(parseInt(e.target.value))} className="input-field">
              {DAY_NAMES.map((d, i) => <option key={d} value={i} className="bg-charcoal-800">{d}</option>)}
            </select>
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="input-field" placeholder="Time" />
          </div>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field" placeholder="Duration (min)" min={5} />
          <input type="url" value={jefitLink} onChange={(e) => setJefitLink(e.target.value)} className="input-field" placeholder="Jefit link (optional)" />
          {error && <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            {recurrence && <button onClick={handleDelete} disabled={saving} className="rounded-lg border border-red-500/15 px-4 py-2.5 text-sm text-red-400/80 transition-colors hover:bg-red-500/5 disabled:opacity-50"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogopedeTab() {
  const [sessions, setSessions] = useState<LogopedeSession[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('logopede_sessions').select('*').gte('session_date', today).order('session_date', { ascending: false });
    setSessions((data as LogopedeSession[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleSession(session: LogopedeSession) {
    const newStatus = session.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('logopede_sessions').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', session.id);
    loadData();
  }

  if (loading) return <div className="glass-card h-64 animate-pulse" />;

  const today = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.session_date === today);
  const upcomingSessions = sessions.filter((s) => s.session_date > today);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Today</h2>
        {todaySessions.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <Activity size={24} className="mx-auto text-cream-dim/40 mb-2" />
            <p className="text-sm text-cream-dim">No logopède sessions today</p>
            <p className="text-xs text-cream-dim/60 mt-1">Sessions are generated automatically based on your settings</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {todaySessions.map((session) => (
              <button
                key={session.id}
                onClick={() => toggleSession(session)}
                className={`glass-card p-4 text-left transition-all ${session.status === 'completed' ? 'opacity-50' : 'hover:border-sage-500/15'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {session.session_type === 'morning' ? <Sun size={16} className="text-accent-warm" /> : <Moon size={16} className="text-accent-cool" />}
                  <span className="text-sm font-medium text-cream capitalize">{session.session_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${session.status === 'completed' ? 'bg-sage-500/30 border-sage-500/40' : 'border-white/[0.1]'}`}>
                    {session.status === 'completed' && <Check size={12} className="text-sage-200" />}
                  </div>
                  <span className="text-xs text-cream-dim">{session.status === 'completed' ? 'Completed' : 'Pending'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {upcomingSessions.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Upcoming</h3>
          <div className="space-y-2">
            {upcomingSessions.slice(0, 7).map((session) => (
              <div key={session.id} className="glass-card px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {session.session_type === 'morning' ? <Sun size={14} className="text-accent-warm" /> : <Moon size={14} className="text-accent-cool" />}
                  <span className="text-sm text-cream capitalize">{session.session_type} session</span>
                </div>
                <span className="text-xs text-cream-dim">{new Date(session.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
