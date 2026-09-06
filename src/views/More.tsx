import { useState, useEffect } from 'react';
import { LogOut, User, Bell, Moon, Sparkles, GraduationCap, CalendarOff, Repeat, Target, AlertCircle, Dumbbell, Lightbulb, FileText, BarChart3, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { SubjectsManager } from '@/components/SubjectsManager';
import { RoutinesManager } from '@/components/RoutinesManager';
import { HolidaysManager } from '@/components/HolidaysManager';
import { Goals } from '@/views/Goals';
import { TestsExams } from '@/views/TestsExams';
import { Workouts } from '@/views/Workouts';
import { Notes } from '@/views/Notes';
import { DailyLogView } from '@/views/DailyLog';
import { Statistics } from '@/views/Statistics';

type Section =
  | 'menu'
  | 'profile'
  | 'notifications'
  | 'sleep'
  | 'planning'
  | 'subjects'
  | 'routines'
  | 'holidays'
  | 'goals'
  | 'tests'
  | 'workouts'
  | 'notes'
  | 'dailylog'
  | 'statistics';

export function More() {
  const { profile, signOut } = useAuth();
  const [section, setSection] = useState<Section>('menu');

  const menuGroups: { label: string; items: { id: Section; label: string; icon: typeof User }[] }[] = [
    {
      label: 'Daily',
      items: [
        { id: 'dailylog', label: 'Daily Log', icon: BarChart3 },
        { id: 'statistics', label: 'Statistics', icon: BarChart3 },
      ],
    },
    {
      label: 'School',
      items: [
        { id: 'subjects', label: 'School Subjects', icon: GraduationCap },
        { id: 'tests', label: 'Tests & Exams', icon: AlertCircle },
        { id: 'holidays', label: 'School Holidays', icon: CalendarOff },
      ],
    },
    {
      label: 'Life',
      items: [
        { id: 'goals', label: 'Goals & Projects', icon: Target },
        { id: 'routines', label: 'Routines', icon: Repeat },
        { id: 'workouts', label: 'Health & Wellness', icon: Dumbbell },
        { id: 'notes', label: 'Notes & Life Areas', icon: Lightbulb },
      ],
    },
    {
      label: 'Settings',
      items: [
        { id: 'profile', label: 'Profile & Display', icon: User },
        { id: 'planning', label: 'AI Planning Preferences', icon: Sparkles },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'sleep', label: 'Sleep & Lifestyle', icon: Moon },
      ],
    },
  ];

  if (section !== 'menu') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSection('menu')}
          className="text-sm text-sage-300 hover:text-sage-200 flex items-center gap-1 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        {section === 'profile' && <ProfileSettings />}
        {section === 'planning' && <PlanningSettings />}
        {section === 'subjects' && <SubjectsManager />}
        {section === 'routines' && <RoutinesManager />}
        {section === 'holidays' && <HolidaysManager />}
        {section === 'goals' && <Goals />}
        {section === 'tests' && <TestsExams />}
        {section === 'workouts' && <Workouts />}
        {section === 'notes' && <Notes />}
        {section === 'dailylog' && <DailyLogView />}
        {section === 'statistics' && <Statistics />}
        {section === 'notifications' && <NotificationSettings />}
        {section === 'sleep' && <SleepSettings />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-cream">More</h1>

      <div className="glass-card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
          <span className="font-display text-lg text-sage-300">
            {(profile?.display_name || 'U')[0].toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-cream">{profile?.display_name || 'User'}</p>
          <p className="text-xs text-cream-dim">Week {profile?.current_week_type || 'A'}</p>
        </div>
      </div>

      {menuGroups.map((group) => (
        <div key={group.label}>
          <h2 className="text-xs font-medium text-cream-dim/60 uppercase tracking-wider mb-2 px-1">{group.label}</h2>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className="glass-card w-full px-4 py-3.5 flex items-center justify-between text-left hover:border-sage-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="text-cream-dim" />
                    <span className="text-sm text-cream">{item.label}</span>
                  </div>
                  <span className="text-cream-dim text-xs">→</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={signOut}
        className="w-full glass-card px-4 py-3.5 flex items-center gap-3 text-left hover:border-red-500/15 transition-colors"
      >
        <LogOut size={18} className="text-red-400/70" />
        <span className="text-sm text-red-400/80">Sign Out</span>
      </button>

      <p className="text-center text-xs text-cream-dim/50">Life OS — Personal Operating System</p>
    </div>
  );
}

function ProfileSettings() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name || '');
  const [weekType, setWeekType] = useState(profile?.current_week_type || 'A');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ display_name: name, current_week_type: weekType })
      .eq('id', profile!.id);
    await refreshProfile();
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl text-cream">Profile</h2>
      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="block text-xs text-cream-dim mb-1.5">Display Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-cream-dim mb-1.5">Current School Week</label>
          <div className="flex gap-2">
            {(['A', 'B'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWeekType(w)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  weekType === w
                    ? 'bg-sage-500/15 text-sage-200 border border-sage-500/25'
                    : 'text-cream-dim border border-white/[0.06] hover:text-cream'
                }`}
              >
                Week {w}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function PlanningSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({
    planning_mode: 'balanced',
    preferred_work_start: '16:00',
    preferred_work_end: '21:00',
    protected_free_time_start: '20:00',
    protected_free_time_end: '22:00',
    max_study_hours_daily: 3,
    allow_late_night_work: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('ai_preferences')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs(data as typeof prefs);
        setLoading(false);
      });
  }, [user]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('ai_preferences').update(prefs).eq('user_id', user!.id);
    setSaving(false);
  }

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl text-cream">AI Planning</h2>
      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="block text-xs text-cream-dim mb-1.5">Planning Mode</label>
          <select value={prefs.planning_mode} onChange={(e) => setPrefs({ ...prefs, planning_mode: e.target.value })} className="input-field">
            <option value="balanced" className="bg-charcoal-800">Balanced</option>
            <option value="productive" className="bg-charcoal-800">Productive</option>
            <option value="relaxed" className="bg-charcoal-800">Relaxed</option>
            <option value="custom" className="bg-charcoal-800">Custom</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Work Start</label>
            <input type="time" value={prefs.preferred_work_start} onChange={(e) => setPrefs({ ...prefs, preferred_work_start: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Work End</label>
            <input type="time" value={prefs.preferred_work_end} onChange={(e) => setPrefs({ ...prefs, preferred_work_end: e.target.value })} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Protected Free Start</label>
            <input type="time" value={prefs.protected_free_time_start} onChange={(e) => setPrefs({ ...prefs, protected_free_time_start: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Protected Free End</label>
            <input type="time" value={prefs.protected_free_time_end} onChange={(e) => setPrefs({ ...prefs, protected_free_time_end: e.target.value })} className="input-field" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-cream-dim mb-1.5">Max Study Hours/Day</label>
          <input type="number" value={prefs.max_study_hours_daily} onChange={(e) => setPrefs({ ...prefs, max_study_hours_daily: parseInt(e.target.value) })} className="input-field" min={1} max={12} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={prefs.allow_late_night_work} onChange={(e) => setPrefs({ ...prefs, allow_late_night_work: e.target.checked })} className="accent-sage-500" />
          <span className="text-sm text-cream-dim">Allow late-night work recommendations</span>
        </label>
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs(data as Record<string, unknown>);
        setLoading(false);
      });
  }, [user]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('notification_preferences').update(prefs).eq('user_id', user!.id);
    setSaving(false);
  }

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  const toggles = [
    { key: 'important_enabled', label: 'Important notifications' },
    { key: 'upcoming_enabled', label: 'Upcoming reminders' },
    { key: 'ai_intervention_enabled', label: 'AI interventions' },
    { key: 'summary_enabled', label: 'Daily summaries' },
    { key: 'bedtime_preview_enabled', label: 'Bedtime tomorrow preview' },
    { key: 'quiet_hours_enabled', label: 'Quiet hours' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl text-cream">Notifications</h2>
      <div className="glass-card p-5 space-y-3">
        {toggles.map((toggle) => (
          <label key={toggle.key} className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-cream-dim">{toggle.label}</span>
            <input type="checkbox" checked={(prefs[toggle.key] as boolean) ?? true} onChange={(e) => setPrefs({ ...prefs, [toggle.key]: e.target.checked })} className="accent-sage-500" />
          </label>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Quiet Start</label>
            <input type="time" value={(prefs.quiet_hours_start as string) || '22:00'} onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Quiet End</label>
            <input type="time" value={(prefs.quiet_hours_end as string) || '07:00'} onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })} className="input-field" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function SleepSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    bedtime: '22:30',
    wake_time: '07:00',
    logopede_enabled: false,
    logopede_rest_day: 'Sunday',
    logopede_morning_time: '07:30',
    logopede_evening_time: '19:00',
    logopede_duration_min: 15,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as typeof settings);
        setLoading(false);
      });
  }, [user]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('user_settings').update(settings).eq('user_id', user!.id);
    setSaving(false);
  }

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl text-cream">Sleep & Lifestyle</h2>
      <div className="glass-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Target Bedtime</label>
            <input type="time" value={settings.bedtime} onChange={(e) => setSettings({ ...settings, bedtime: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Target Wake Time</label>
            <input type="time" value={settings.wake_time} onChange={(e) => setSettings({ ...settings, wake_time: e.target.value })} className="input-field" />
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input type="checkbox" checked={settings.logopede_enabled} onChange={(e) => setSettings({ ...settings, logopede_enabled: e.target.checked })} className="accent-sage-500" />
            <span className="text-sm text-cream">Logopède exercises enabled</span>
          </label>

          {settings.logopede_enabled && (
            <div className="space-y-3 pl-6">
              <div>
                <label className="block text-xs text-cream-dim mb-1.5">Rest Day</label>
                <select value={settings.logopede_rest_day} onChange={(e) => setSettings({ ...settings, logopede_rest_day: e.target.value })} className="input-field">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                    <option key={d} value={d} className="bg-charcoal-800">{d}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-cream-dim mb-1.5">Morning Time</label>
                  <input type="time" value={settings.logopede_morning_time} onChange={(e) => setSettings({ ...settings, logopede_morning_time: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-cream-dim mb-1.5">Evening Time</label>
                  <input type="time" value={settings.logopede_evening_time} onChange={(e) => setSettings({ ...settings, logopede_evening_time: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-cream-dim mb-1.5">Duration (minutes)</label>
                <input type="number" value={settings.logopede_duration_min} onChange={(e) => setSettings({ ...settings, logopede_duration_min: parseInt(e.target.value) })} className="input-field" min={5} max={60} />
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
