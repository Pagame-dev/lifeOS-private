import { useState, useEffect } from 'react';
import { LogOut, User, Bell, Moon, Sparkles, GraduationCap, CalendarOff, Repeat, Target, AlertCircle, Dumbbell, Lightbulb, FileText, BarChart3, ChevronLeft, Mic, Volume2, Brain, Trash2, Plus } from 'lucide-react';
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
import type { AIMemory, VoiceSettings } from '@/lib/types';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';

type Section =
  | 'menu'
  | 'profile'
  | 'notifications'
  | 'sleep'
  | 'planning'
  | 'ai_personalisation'
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
        { id: 'ai_personalisation', label: 'AI Personalisation & Voice', icon: Brain },
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
        {section === 'ai_personalisation' && <AIPersonalisationSettings />}
        {section === 'subjects' && <SubjectsManager />}
        {section === 'routines' && <RoutinesManager />}
        {section === 'holidays' && <HolidaysManager />}
        {section === 'goals' && <Goals />}
        {section === 'tests' && <TestsExams />}
        {section === 'workouts' && <Workouts />}
        {section === 'notes' && <Notes />}
        {section === 'dailylog' && <DailyLogView />}
        {section === 'statistics' && <Statistics />}
        {section === 'notifications' && <PushNotificationSettings />}
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

function AIPersonalisationSettings() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPref, setNewPref] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');

  async function fetchApiKeyStatus() {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-api-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { hasKey: boolean };
        setHasApiKey(data.hasKey);
      }
    } catch { /* ignore */ }
  }

  async function saveApiKey() {
    setApiKeySaving(true);
    setApiKeyError('');
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setApiKeyError('Not signed in.');
      setApiKeySaving(false);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      if (res.ok) {
        setHasApiKey(true);
        setApiKeyInput('');
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to save' }));
        setApiKeyError(data.error || 'Failed to save');
      }
    } catch {
      setApiKeyError('Network error.');
    }
    setApiKeySaving(false);
  }

  async function deleteApiKey() {
    setApiKeySaving(true);
    setApiKeyError('');
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) { setApiKeySaving(false); return; }
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-api-key`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setHasApiKey(false);
    } catch { /* ignore */ }
    setApiKeySaving(false);
  }

  useEffect(() => {
    fetchApiKeyStatus();
    Promise.all([
      supabase.from('ai_memories').select('*').order('updated_at', { ascending: false }),
      supabase.from('voice_settings').select('*').maybeSingle(),
    ]).then(([memRes, voiceRes]) => {
      setMemories((memRes.data as AIMemory[]) || []);
      setVoiceSettings((voiceRes.data as VoiceSettings) || null);
      setLoading(false);
    });
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) setVoices(v);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      return () => { window.speechSynthesis.onvoiceschanged = null; };
    }
  }, []);

  async function saveVoiceSettings(updates: Partial<VoiceSettings>) {
    if (!voiceSettings) {
      const { data } = await supabase.from('voice_settings').insert({ user_id: user!.id, ...updates }).select('*').maybeSingle();
      setVoiceSettings(data as VoiceSettings);
      return;
    }
    setSaving(true);
    await supabase.from('voice_settings').update(updates).eq('id', voiceSettings.id);
    setVoiceSettings({ ...voiceSettings, ...updates });
    setSaving(false);
  }

  async function deleteMemory(id: string) {
    await supabase.from('ai_memories').delete().eq('id', id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function addExplicitPreference() {
    if (!newPref.trim()) return;
    const patternKey = newPref.slice(0, 60).replace(/\s+/g, '_').toLowerCase();
    const { data } = await supabase
      .from('ai_memories')
      .insert({ memory_type: 'explicit_preference', pattern_key: patternKey, pattern_value: newPref.trim(), confidence_score: 1.0, observation_count: 1, is_temporary: false })
      .select('*')
      .maybeSingle();
    if (data) setMemories((prev) => [data as AIMemory, ...prev]);
    setNewPref('');
  }

  async function clearAllMemories() {
    await supabase.from('ai_memories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setMemories([]);
  }

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  const explicitPrefs = memories.filter((m) => m.memory_type === 'explicit_preference');
  const learnedPats = memories.filter((m) => m.memory_type === 'learned_pattern');
  const tempCtx = memories.filter((m) => m.memory_type === 'temporary_context');

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl text-cream">AI Personalisation & Voice</h2>

      {/* OpenAI API key */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-cream flex items-center gap-2"><Sparkles size={15} className="text-sage-300" /> OpenAI API Key</h3>
          <p className="text-xs text-cream-dim/60 mt-1">The AI assistant needs an OpenAI API key to work. It's stored securely on the server and never exposed in the browser.</p>
        </div>
        {hasApiKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-sage-300">
              <span className="w-2 h-2 rounded-full bg-sage-400" />
              API key is set
            </div>
            <button onClick={deleteApiKey} disabled={apiKeySaving} className="w-full text-xs text-red-400/60 hover:text-red-400/80 py-2 transition-colors disabled:opacity-50">
              {apiKeySaving ? 'Removing...' : 'Remove key'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
              className="input-field text-sm"
              autoComplete="off"
            />
            {apiKeyError && <p className="text-xs text-red-400/70">{apiKeyError}</p>}
            <button onClick={saveApiKey} disabled={!apiKeyInput.trim() || apiKeySaving} className="w-full btn-primary py-2.5 disabled:opacity-50">
              {apiKeySaving ? 'Saving...' : 'Save API key'}
            </button>
            <p className="text-[11px] text-cream-dim/50">Get a key at platform.openai.com/api-keys</p>
          </div>
        )}
      </div>

      {/* Memory section */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-cream flex items-center gap-2"><Brain size={15} className="text-sage-300" /> What I know about you</h3>
          <p className="text-xs text-cream-dim/60 mt-1">The assistant uses these to give better, more personalised advice.</p>
        </div>

        {/* Explicit preferences */}
        <div>
          <p className="text-xs text-cream-dim mb-2 font-medium">Explicit preferences</p>
          <div className="space-y-1.5">
            {explicitPrefs.length === 0 ? (
              <p className="text-xs text-cream-dim/50 italic">None yet. Tell the assistant "I always split long homework into shorter sessions" to add one.</p>
            ) : explicitPrefs.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-xs text-cream-muted flex-1">{m.pattern_value}</span>
                <button onClick={() => deleteMemory(m.id)} className="text-cream-dim/50 hover:text-red-400/70 transition-colors shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newPref}
              onChange={(e) => setNewPref(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addExplicitPreference(); }}
              placeholder="Add a preference..."
              className="input-field flex-1 text-xs"
            />
            <button onClick={addExplicitPreference} disabled={!newPref.trim()} className="btn-primary px-3 py-2 disabled:opacity-50">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Learned patterns */}
        <div>
          <p className="text-xs text-cream-dim mb-2 font-medium">Observed patterns</p>
          <div className="space-y-1.5">
            {learnedPats.length === 0 ? (
              <p className="text-xs text-cream-dim/50 italic">No patterns observed yet. The assistant learns from how you use Life OS over time.</p>
            ) : learnedPats.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="flex-1">
                  <span className="text-xs text-cream-muted">{m.pattern_value}</span>
                  <span className="text-[10px] text-cream-dim/40 ml-2">{m.observation_count}x · {Math.round(m.confidence_score * 100)}%</span>
                </div>
                <button onClick={() => deleteMemory(m.id)} className="text-cream-dim/50 hover:text-red-400/70 transition-colors shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Temporary context */}
        {tempCtx.length > 0 && (
          <div>
            <p className="text-xs text-cream-dim mb-2 font-medium">Temporary context</p>
            <div className="space-y-1.5">
              {tempCtx.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-xs text-cream-muted flex-1">{m.pattern_value}</span>
                  <button onClick={() => deleteMemory(m.id)} className="text-cream-dim/50 hover:text-red-400/70 transition-colors shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {memories.length > 0 && (
          <button onClick={clearAllMemories} className="w-full text-xs text-red-400/60 hover:text-red-400/80 py-2 transition-colors">
            Clear all AI memory
          </button>
        )}
      </div>

      {/* Voice settings */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-cream flex items-center gap-2"><Mic size={15} className="text-sage-300" /> Voice settings</h3>
          <p className="text-xs text-cream-dim/60 mt-1">Control how the assistant listens and responds.</p>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-cream-dim flex items-center gap-2"><Mic size={14} /> Voice input enabled</span>
          <input
            type="checkbox"
            checked={voiceSettings?.voice_input_enabled ?? true}
            onChange={(e) => saveVoiceSettings({ voice_input_enabled: e.target.checked })}
            className="accent-sage-500"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-cream-dim flex items-center gap-2"><Volume2 size={14} /> Voice output enabled</span>
          <input
            type="checkbox"
            checked={voiceSettings?.voice_output_enabled ?? false}
            onChange={(e) => saveVoiceSettings({ voice_output_enabled: e.target.checked })}
            className="accent-sage-500"
          />
        </label>

        {voices.length > 0 && (
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Selected voice</label>
            <select
              value={voiceSettings?.selected_voice || ''}
              onChange={(e) => saveVoiceSettings({ selected_voice: e.target.value })}
              className="input-field"
            >
              <option value="" className="bg-charcoal-800">Default</option>
              {voices.filter((v) => v.lang.startsWith('en')).map((v) => (
                <option key={v.name} value={v.name} className="bg-charcoal-800">{v.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-cream-dim mb-1.5">Speaking speed: {((voiceSettings?.speaking_speed ?? 1.0)).toFixed(1)}x</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={voiceSettings?.speaking_speed ?? 1.0}
            onChange={(e) => saveVoiceSettings({ speaking_speed: parseFloat(e.target.value) })}
            className="w-full accent-sage-500"
          />
        </div>

        <div className="border-t border-white/[0.06] pt-3 space-y-2">
          <p className="text-xs text-cream-dim font-medium">When I type, reply with:</p>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-cream-dim">Text</span>
            <input type="checkbox" checked={voiceSettings?.text_when_type ?? true} onChange={(e) => saveVoiceSettings({ text_when_type: e.target.checked })} className="accent-sage-500" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-cream-dim">Voice</span>
            <input type="checkbox" checked={voiceSettings?.voice_when_type ?? false} onChange={(e) => saveVoiceSettings({ voice_when_type: e.target.checked })} className="accent-sage-500" />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-cream-dim font-medium">When I speak, reply with:</p>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-cream-dim">Text</span>
            <input type="checkbox" checked={voiceSettings?.text_when_speak ?? true} onChange={(e) => saveVoiceSettings({ text_when_speak: e.target.checked })} className="accent-sage-500" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-cream-dim">Voice</span>
            <input type="checkbox" checked={voiceSettings?.voice_when_speak ?? true} onChange={(e) => saveVoiceSettings({ voice_when_speak: e.target.checked })} className="accent-sage-500" />
          </label>
        </div>

        {saving && <p className="text-[11px] text-cream-dim/50">Saving...</p>}
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
