import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, Moon, BookOpen, Dumbbell, Droplets, CheckCircle2, Flame, Award, Zap, Edit3, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DailyLog } from '@/lib/types';

export function Statistics() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'week' | 'month' | 'year'>('week');
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);

  async function loadLogs() {
    const days = range === 'week' ? 7 : range === 'month' ? 30 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .gte('log_date', startDate.toISOString().split('T')[0])
      .order('log_date', { ascending: true });
    setLogs((data as DailyLog[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, [range]);

  async function deleteLog(log: DailyLog) {
    await supabase.from('daily_logs').delete().eq('id', log.id);
    loadLogs();
  }

  const stats = useMemo(() => {
    if (logs.length === 0) return null;

    const avgSleep = Math.round(logs.reduce((sum, l) => sum + (l.estimated_sleep_min || l.sleep_duration_min || 0), 0) / logs.length);
    const totalStudy = logs.reduce((sum, l) => sum + (l.study_time_min || 0), 0);
    const totalExercise = logs.reduce((sum, l) => sum + (l.exercise_min || 0), 0);
    const avgWater = Math.round(logs.reduce((sum, l) => sum + (l.water_glasses || 0), 0) / logs.length);
    const avgScore = Math.round(logs.reduce((sum, l) => sum + (l.daily_score || 0), 0) / logs.length);
    const avgMood = (logs.reduce((sum, l) => sum + (l.mood || 0), 0) / logs.length).toFixed(1);
    const avgEnergy = (logs.reduce((sum, l) => sum + (l.energy || 0), 0) / logs.length).toFixed(1);
    const totalReading = logs.reduce((sum, l) => sum + (l.reading_min || 0), 0);

    const loggedDays = logs.filter((l) => l.mood !== null || l.water_glasses > 0 || l.study_time_min > 0).length;
    const streak = calculateStreak(logs);

    return { avgSleep, totalStudy, totalExercise, avgWater, avgScore, avgMood, avgEnergy, totalReading, loggedDays, streak };
  }, [logs]);

  const moodTrend = useMemo(() => {
    return logs.slice(-14).map((l) => ({
      date: new Date(l.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      mood: l.mood || 0,
      energy: l.energy || 0,
    }));
  }, [logs]);

  const waterBars = useMemo(() => {
    return logs.slice(-7).map((l) => ({
      date: new Date(l.log_date).toLocaleDateString('en-US', { weekday: 'short' }),
      glasses: l.water_glasses || 0,
    }));
  }, [logs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 glass-card animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="glass-card h-28 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!stats || logs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-cream">Statistics</h1>
          <RangeToggle range={range} setRange={setRange} />
        </div>
        <div className="glass-card p-12 text-center">
          <TrendingUp size={32} className="mx-auto text-cream-dim/40 mb-3" />
          <p className="text-sm text-cream-dim">No data yet for this period</p>
          <p className="text-xs text-cream-dim/60 mt-1">Daily logs will appear here once you start tracking</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Avg Sleep', value: stats.avgSleep ? `${Math.floor(stats.avgSleep / 60)}h ${stats.avgSleep % 60}m` : '—', icon: Moon, color: 'text-sage-300' },
    { label: 'Total Study', value: stats.totalStudy ? `${Math.floor(stats.totalStudy / 60)}h ${stats.totalStudy % 60}m` : '—', icon: BookOpen, color: 'text-accent-cool' },
    { label: 'Total Exercise', value: stats.totalExercise ? `${Math.floor(stats.totalExercise / 60)}h ${stats.totalExercise % 60}m` : '—', icon: Dumbbell, color: 'text-accent-warm' },
    { label: 'Avg Water', value: `${stats.avgWater} glasses`, icon: Droplets, color: 'text-accent-cool' },
    { label: 'Avg Score', value: stats.avgScore || '—', icon: TrendingUp, color: 'text-sage-300' },
    { label: 'Avg Mood', value: stats.avgMood, icon: CheckCircle2, color: 'text-sage-300' },
    { label: 'Avg Energy', value: stats.avgEnergy, icon: Zap, color: 'text-accent-warm' },
    { label: 'Total Reading', value: stats.totalReading ? `${stats.totalReading}m` : '—', icon: BookOpen, color: 'text-sage-300' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Statistics</h1>
        <RangeToggle range={range} setRange={setRange} />
      </div>

      {/* Streak & logged days */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent-warm/10 border border-accent-warm/20 flex items-center justify-center">
            <Flame size={22} className="text-accent-warm" />
          </div>
          <div>
            <p className="font-display text-2xl text-cream">{stats.streak}</p>
            <p className="text-xs text-cream-dim">day streak</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
            <Award size={22} className="text-sage-300" />
          </div>
          <div>
            <p className="font-display text-2xl text-cream">{stats.loggedDays}</p>
            <p className="text-xs text-cream-dim">days logged</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className={stat.color} />
                <span className="text-xs text-cream-dim uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-2xl font-display text-cream">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Mood & Energy trend */}
      {moodTrend.length > 1 && (
        <section>
          <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Mood & Energy Trend</h2>
          <div className="glass-card p-5">
            <div className="flex items-end justify-between gap-1 h-40">
              {moodTrend.map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-32">
                    <div
                      className="w-2 rounded-t bg-sage-500/40 transition-all"
                      style={{ height: `${(point.mood / 5) * 100}%`, minHeight: point.mood > 0 ? '4px' : '0' }}
                      title={`Mood: ${point.mood}/5`}
                    />
                    <div
                      className="w-2 rounded-t bg-accent-warm/40 transition-all"
                      style={{ height: `${(point.energy / 5) * 100}%`, minHeight: point.energy > 0 ? '4px' : '0' }}
                      title={`Energy: ${point.energy}/5`}
                    />
                  </div>
                  <span className="text-[9px] text-cream-dim/60 truncate w-full text-center">{point.date}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-cream-dim">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-sage-500/40" /> Mood</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-accent-warm/40" /> Energy</span>
            </div>
          </div>
        </section>
      )}

      {/* Water intake */}
      {waterBars.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Water This Week</h2>
          <div className="glass-card p-5">
            <div className="flex items-end justify-between gap-2 h-32">
              {waterBars.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-cream-dim font-mono">{day.glasses || ''}</span>
                  <div
                    className="w-full rounded-t bg-accent-cool/30 transition-all"
                    style={{ height: `${(day.glasses / 12) * 100}%`, minHeight: day.glasses > 0 ? '4px' : '0' }}
                  />
                  <span className="text-[10px] text-cream-dim/60">{day.date}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent days table */}
      <section>
        <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">Recent Days</h2>
        <div className="glass-card divide-y divide-white/[0.04]">
          {[...logs].reverse().slice(0, 10).map((log) => (
            <div key={log.id} className="px-4 py-3 flex items-center justify-between group">
              <div>
                <p className="text-sm text-cream">
                  {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-cream-dim">
                  {log.estimated_sleep_min ? <span>{Math.floor(log.estimated_sleep_min / 60)}h sleep</span> : null}
                  {log.study_time_min > 0 && <span>{log.study_time_min}m study</span>}
                  {log.exercise_min > 0 && <span>{log.exercise_min}m exercise</span>}
                  {log.water_glasses > 0 && <span>{log.water_glasses} glasses</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {log.mood && <span className="text-lg">{['😞', '😕', '😐', '🙂', '😄'][log.mood - 1]}</span>}
                {log.daily_score !== null && (
                  <div className="text-right">
                    <p className="text-lg font-display text-sage-300">{log.daily_score}</p>
                    <p className="text-[10px] text-cream-dim">score</p>
                  </div>
                )}
                <button onClick={() => setEditingLog(log)} className="p-1.5 rounded-lg text-cream-dim/40 hover:text-cream hover:bg-white/[0.03] transition-colors opacity-0 group-hover:opacity-100" title="Edit">
                  <Edit3 size={13} />
                </button>
                <button onClick={() => deleteLog(log)} className="p-1.5 rounded-lg text-cream-dim/40 hover:text-red-400/70 hover:bg-red-500/5 transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editingLog && (
        <DailyLogEditModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSaved={() => { loadLogs(); setEditingLog(null); }}
        />
      )}
    </div>
  );
}

function DailyLogEditModal({ log, onClose, onSaved }: { log: DailyLog; onClose: () => void; onSaved: () => void }) {
  const [sleepMin, setSleepMin] = useState(log.estimated_sleep_min?.toString() || '');
  const [studyMin, setStudyMin] = useState(log.study_time_min?.toString() || '');
  const [exerciseMin, setExerciseMin] = useState(log.exercise_min?.toString() || '');
  const [waterGlasses, setWaterGlasses] = useState(log.water_glasses?.toString() || '');
  const [readingMin, setReadingMin] = useState(log.reading_min?.toString() || '');
  const [mood, setMood] = useState(log.mood?.toString() || '');
  const [energy, setEnergy] = useState(log.energy?.toString() || '');
  const [dailyScore, setDailyScore] = useState(log.daily_score?.toString() || '');
  const [journal, setJournal] = useState(log.journal || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const data = {
      estimated_sleep_min: sleepMin ? parseInt(sleepMin) : null,
      study_time_min: studyMin ? parseInt(studyMin) : 0,
      exercise_min: exerciseMin ? parseInt(exerciseMin) : 0,
      water_glasses: waterGlasses ? parseInt(waterGlasses) : 0,
      reading_min: readingMin ? parseInt(readingMin) : 0,
      mood: mood ? parseInt(mood) : null,
      energy: energy ? parseInt(energy) : null,
      daily_score: dailyScore ? parseInt(dailyScore) : null,
      journal: journal.trim(),
    };
    try {
      const { error: updateError } = await supabase.from('daily_logs').update(data).eq('id', log.id);
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-cream">Edit Log — {new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Sleep (min)</label>
              <input type="number" value={sleepMin} onChange={(e) => setSleepMin(e.target.value)} className="input-field" min={0} />
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Study (min)</label>
              <input type="number" value={studyMin} onChange={(e) => setStudyMin(e.target.value)} className="input-field" min={0} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Exercise (min)</label>
              <input type="number" value={exerciseMin} onChange={(e) => setExerciseMin(e.target.value)} className="input-field" min={0} />
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Water (glasses)</label>
              <input type="number" value={waterGlasses} onChange={(e) => setWaterGlasses(e.target.value)} className="input-field" min={0} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Reading (min)</label>
              <input type="number" value={readingMin} onChange={(e) => setReadingMin(e.target.value)} className="input-field" min={0} />
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Daily Score (0-100)</label>
              <input type="number" value={dailyScore} onChange={(e) => setDailyScore(e.target.value)} className="input-field" min={0} max={100} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Mood (1-5)</label>
              <select value={mood} onChange={(e) => setMood(e.target.value)} className="input-field">
                <option value="" className="bg-charcoal-800">—</option>
                {[1, 2, 3, 4, 5].map((m) => <option key={m} value={m} className="bg-charcoal-800">{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream-dim mb-1.5">Energy (1-5)</label>
              <select value={energy} onChange={(e) => setEnergy(e.target.value)} className="input-field">
                <option value="" className="bg-charcoal-800">—</option>
                {[1, 2, 3, 4, 5].map((en) => <option key={en} value={en} className="bg-charcoal-800">{en}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Journal</label>
            <textarea value={journal} onChange={(e) => setJournal(e.target.value)} className="input-field min-h-[60px] resize-none" placeholder="Journal entry" />
          </div>
          {error && <div className="text-sm text-red-400/80 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RangeToggle({ range, setRange }: { range: 'week' | 'month' | 'year'; setRange: (r: 'week' | 'month' | 'year') => void }) {
  return (
    <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg">
      {(['week', 'month', 'year'] as const).map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
            range === r ? 'bg-charcoal-700 text-cream' : 'text-cream-dim hover:text-cream'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function calculateStreak(logs: DailyLog[]): number {
  if (logs.length === 0) return 0;
  const sorted = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const log of sorted) {
    const logDate = new Date(log.log_date);
    logDate.setHours(0, 0, 0, 0);
    const expected = new Date(today);
    expected.setDate(expected.getDate() - streak);
    if (logDate.getTime() === expected.getTime() && (log.mood !== null || log.water_glasses > 0 || log.study_time_min > 0)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
