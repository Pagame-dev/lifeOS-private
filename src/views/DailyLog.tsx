import { useEffect, useState } from 'react';
import { Droplets, Moon, Dumbbell, BookOpen, Smile, Zap, Save, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DailyLog } from '@/lib/types';

export function DailyLogView() {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const todayKey = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function loadLog() {
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('log_date', todayKey)
        .maybeSingle();
      setLog(data as DailyLog | null);
      setLoading(false);
    }
    loadLog();
  }, [todayKey]);

  const defaults: Partial<DailyLog> = {
    water_glasses: 0,
    exercise_min: 0,
    study_time_min: 0,
    screen_time_min: 0,
    hygiene: false,
    skincare: false,
    food: '',
    reading_min: 0,
    mood: null,
    energy: null,
    money_spent: 0,
    journal: '',
    daily_rating: null,
  };

  const current = { ...defaults, ...log } as DailyLog;

  function update(patch: Partial<DailyLog>) {
    setLog({ ...current, ...patch } as DailyLog);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (log?.id) {
        await supabase.from('daily_logs').update(current).eq('id', log.id);
      } else {
        await supabase.from('daily_logs').insert({ ...current, log_date: todayKey });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="glass-card h-96 animate-pulse" />;

  const moodEmojis = ['😞', '😕', '😐', '🙂', '😄'];
  const energyLabels = ['Exhausted', 'Tired', 'Okay', 'Good', 'Energized'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">Daily Log</h1>
          <p className="text-sm text-cream-dim mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 py-2.5 px-5">
          {saved ? <><Check size={16} /> Saved</> : saving ? 'Saving...' : <><Save size={16} /> Save</>}
        </button>
      </div>

      {/* Mood & Energy */}
      <div className="glass-card p-5 space-y-5">
        <div>
          <label className="flex items-center gap-2 text-xs text-cream-dim uppercase tracking-wider mb-3">
            <Smile size={14} /> Mood
          </label>
          <div className="flex justify-between">
            {moodEmojis.map((emoji, i) => (
              <button
                key={i}
                onClick={() => update({ mood: i + 1 })}
                className={`w-12 h-12 rounded-xl text-2xl transition-all ${
                  current.mood === i + 1 ? 'bg-sage-500/15 border border-sage-500/25 scale-110' : 'border border-white/[0.04] hover:bg-white/[0.03]'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs text-cream-dim uppercase tracking-wider mb-3">
            <Zap size={14} /> Energy
          </label>
          <div className="flex justify-between gap-1">
            {energyLabels.map((label, i) => (
              <button
                key={i}
                onClick={() => update({ energy: i + 1 })}
                className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  current.energy === i + 1 ? 'bg-sage-500/15 text-sage-200 border border-sage-500/25' : 'text-cream-dim border border-white/[0.04] hover:text-cream'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-cream-dim uppercase tracking-wider mb-3">Daily Rating</label>
          <div className="flex justify-between gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => update({ daily_rating: rating })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  current.daily_rating === rating ? 'bg-sage-500/15 text-sage-200 border border-sage-500/25' : 'text-cream-dim border border-white/[0.04] hover:text-cream'
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Water */}
      <div className="glass-card p-5">
        <label className="flex items-center gap-2 text-xs text-cream-dim uppercase tracking-wider mb-3">
          <Droplets size={14} /> Water Intake
        </label>
        <div className="flex items-center gap-3">
          <button onClick={() => update({ water_glasses: Math.max(0, current.water_glasses - 1) })} className="w-10 h-10 rounded-lg border border-white/[0.06] text-cream-dim hover:text-cream transition-colors text-lg">
            −
          </button>
          <div className="flex-1 text-center">
            <span className="font-display text-3xl text-cream">{current.water_glasses}</span>
            <span className="text-sm text-cream-dim ml-1">glasses</span>
          </div>
          <button onClick={() => update({ water_glasses: current.water_glasses + 1 })} className="w-10 h-10 rounded-lg border border-white/[0.06] text-cream-dim hover:text-cream transition-colors text-lg">
            +
          </button>
        </div>
        <div className="flex gap-1 mt-3">
          {[...Array(Math.min(current.water_glasses, 12))].map((_, i) => (
            <div key={i} className="flex-1 h-2 rounded-full bg-accent-cool/30" />
          ))}
          {[...Array(Math.max(0, 12 - current.water_glasses))].map((_, i) => (
            <div key={i} className="flex-1 h-2 rounded-full bg-white/[0.04]" />
          ))}
        </div>
      </div>

      {/* Time tracking */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <label className="flex items-center gap-2 text-xs text-cream-dim uppercase tracking-wider mb-2">
            <Moon size={14} /> Sleep (hours)
          </label>
          <input
            type="number"
            value={current.estimated_sleep_min ? (current.estimated_sleep_min / 60).toFixed(1) : ''}
            onChange={(e) => update({ estimated_sleep_min: e.target.value ? Math.round(parseFloat(e.target.value) * 60) : null })}
            className="input-field"
            placeholder="0"
            step={0.5}
            min={0}
            max={14}
          />
        </div>
        <div className="glass-card p-4">
          <label className="flex items-center gap-2 text-xs text-cream-dim uppercase tracking-wider mb-2">
            <Dumbbell size={14} /> Exercise (min)
          </label>
          <input
            type="number"
            value={current.exercise_min || ''}
            onChange={(e) => update({ exercise_min: parseInt(e.target.value) || 0 })}
            className="input-field"
            placeholder="0"
            min={0}
          />
        </div>
        <div className="glass-card p-4">
          <label className="flex items-center gap-2 text-xs text-cream-dim uppercase tracking-wider mb-2">
            <BookOpen size={14} /> Study (min)
          </label>
          <input
            type="number"
            value={current.study_time_min || ''}
            onChange={(e) => update({ study_time_min: parseInt(e.target.value) || 0 })}
            className="input-field"
            placeholder="0"
            min={0}
          />
        </div>
        <div className="glass-card p-4">
          <label className="block text-xs text-cream-dim uppercase tracking-wider mb-2">Screen Time (min)</label>
          <input
            type="number"
            value={current.screen_time_min || ''}
            onChange={(e) => update({ screen_time_min: parseInt(e.target.value) || 0 })}
            className="input-field"
            placeholder="0"
            min={0}
          />
        </div>
      </div>

      {/* Habits */}
      <div className="glass-card p-5 space-y-3">
        <label className="block text-xs text-cream-dim uppercase tracking-wider">Habits</label>
        {[
          { key: 'hygiene' as const, label: 'Hygiene' },
          { key: 'skincare' as const, label: 'Skincare' },
        ].map((habit) => (
          <button
            key={habit.key}
            onClick={() => update({ [habit.key]: !current[habit.key] } as Partial<DailyLog>)}
            className="w-full flex items-center justify-between py-2"
          >
            <span className="text-sm text-cream">{habit.label}</span>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${current[habit.key] ? 'bg-sage-500/30' : 'bg-white/[0.06]'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-transform ${current[habit.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Reading (min)</label>
            <input type="number" value={current.reading_min || ''} onChange={(e) => update({ reading_min: parseInt(e.target.value) || 0 })} className="input-field" placeholder="0" min={0} />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Money Spent</label>
            <input type="number" value={current.money_spent || ''} onChange={(e) => update({ money_spent: parseFloat(e.target.value) || 0 })} className="input-field" placeholder="0" step={0.5} min={0} />
          </div>
        </div>
      </div>

      {/* Journal */}
      <div className="glass-card p-5">
        <label className="block text-xs text-cream-dim uppercase tracking-wider mb-2">Journal</label>
        <textarea
          value={current.journal || ''}
          onChange={(e) => update({ journal: e.target.value })}
          className="input-field min-h-[120px] resize-none"
          placeholder="How was your day?"
        />
      </div>
    </div>
  );
}
