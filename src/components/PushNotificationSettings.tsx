import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Send, CheckCircle2, AlertCircle, Loader2, Smartphone, Monitor } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  subscribeToPush,
  unsubscribeFromPush,
  sendTestNotification,
  getDiagnostics,
  getNotificationPermission,
  isPushSupported,
  isIOS,
  isStandalone,
  type PushDiagnostics,
} from '@/lib/push-manager';
import type { PushSubscription } from '@/lib/types';

export function PushNotificationSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subs, setSubs] = useState<PushSubscription[]>([]);
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [permission, setPermission] = useState(getNotificationPermission());

  const loadPrefs = useCallback(async () => {
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) setPrefs(data as Record<string, unknown>);
    setLoading(false);
  }, [user]);

  const loadSubs = useCallback(async () => {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setSubs((data as PushSubscription[]) || []);
  }, [user]);

  const loadDiagnostics = useCallback(async () => {
    const diag = await getDiagnostics();
    setDiagnostics(diag);
  }, []);

  useEffect(() => {
    loadPrefs();
    loadSubs();
    loadDiagnostics();
  }, [loadPrefs, loadSubs, loadDiagnostics]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('notification_preferences').update(prefs).eq('user_id', user!.id);
    setSaving(false);
  }

  async function handleEnableNotifications() {
    setSubscribing(true);
    const result = await subscribeToPush();
    setSubscribing(false);
    setPermission(getNotificationPermission());
    if (result) {
      await loadSubs();
      await loadDiagnostics();
    }
  }

  async function handleDisableNotifications() {
    setSubscribing(true);
    await unsubscribeFromPush();
    setSubscribing(false);
    setPermission(getNotificationPermission());
    await loadSubs();
    await loadDiagnostics();
  }

  async function handleTestNotification() {
    setTesting(true);
    setTestResult(null);
    const result = await sendTestNotification();
    setTesting(false);
    setTestResult({
      success: result.success,
      message: result.success ? 'Test notification sent! Check your device.' : result.error || 'Failed to send',
    });
    setTimeout(() => setTestResult(null), 5000);
  }

  async function handleRemoveDevice(subId: string) {
    await supabase.from('push_subscriptions').delete().eq('id', subId);
    await loadSubs();
    await loadDiagnostics();
  }

  const pushSupported = isPushSupported();
  const ios = isIOS();
  const standalone = isStandalone();
  const notificationsEnabled = permission === 'granted' && subs.length > 0;

  const categoryToggles = [
    { key: 'important_enabled', label: 'Important events' },
    { key: 'events_enabled', label: 'Upcoming activities' },
    { key: 'homework_enabled', label: 'Homework' },
    { key: 'tests_enabled', label: 'Tests & exams' },
    { key: 'routines_enabled', label: 'Routines' },
    { key: 'workout_enabled', label: 'Workout' },
    { key: 'ai_intervention_enabled', label: 'AI interventions' },
    { key: 'daily_briefing_enabled', label: 'Daily briefing' },
    { key: 'bedtime_preview_enabled', label: 'Evening / bedtime preview' },
  ];

  if (loading) return <div className="glass-card h-40 animate-pulse" />;

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl text-cream">Notifications</h2>

      {/* Enable / Disable push */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${notificationsEnabled ? 'bg-sage-500/10 border border-sage-500/20' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
              {notificationsEnabled ? <Bell size={18} className="text-sage-300" /> : <BellOff size={18} className="text-cream-dim" />}
            </div>
            <div>
              <p className="text-sm font-medium text-cream">Push Notifications</p>
              <p className="text-xs text-cream-dim">
                {notificationsEnabled ? 'Enabled on this device' : 'Not enabled'}
              </p>
            </div>
          </div>
          {notificationsEnabled ? (
            <button
              onClick={handleDisableNotifications}
              disabled={subscribing}
              className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-red-500/10 hover:border-red-500/20"
            >
              {subscribing ? 'Disabling...' : 'Disable'}
            </button>
          ) : (
            <button
              onClick={handleEnableNotifications}
              disabled={subscribing || !pushSupported}
              className="btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {subscribing ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
              {subscribing ? 'Enabling...' : 'Enable notifications'}
            </button>
          )}
        </div>

        {!pushSupported && (
          <div className="text-xs text-accent-warm/70 bg-accent-warm/5 border border-accent-warm/10 rounded-lg px-3 py-2">
            {ios && !standalone
              ? 'Push notifications require adding Life OS to your Home Screen first (iOS 16.4+).'
              : 'Push notifications are not supported in this browser.'}
          </div>
        )}

        {pushSupported && permission === 'denied' && (
          <div className="text-xs text-accent-warm/70 bg-accent-warm/5 border border-accent-warm/10 rounded-lg px-3 py-2">
            Notification permission was denied. To re-enable, go to your browser/site settings and allow notifications for Life OS.
          </div>
        )}

        {pushSupported && permission === 'default' && (
          <p className="text-xs text-cream-dim/60">
            LifeOS can remind you about lessons, homework, routines and important events.
          </p>
        )}

        {/* Test button */}
        {notificationsEnabled && (
          <div className="pt-2 border-t border-white/[0.04]">
            <button
              onClick={handleTestNotification}
              disabled={testing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-sage-500/15 bg-sage-500/5 text-sage-300 text-sm hover:bg-sage-500/10 transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {testing ? 'Sending...' : 'Send test notification'}
            </button>
            {testResult && (
              <div className={`mt-2 flex items-center gap-2 text-xs ${testResult.success ? 'text-sage-300' : 'text-accent-warm'}`}>
                {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {testResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diagnostics */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-xs font-medium text-cream-dim uppercase tracking-wider">Diagnostics</h3>
        <DiagnosticRow label="Browser supported" ok={diagnostics?.browserSupported} />
        <DiagnosticRow label="PWA installed" ok={diagnostics?.pwaInstalled} warning={!diagnostics?.pwaInstalled && ios} warningText="Add Life OS to Home Screen" />
        <DiagnosticRow label="Permission granted" ok={diagnostics?.permissionGranted} warning={diagnostics?.permissionGranted === false} warningText="Enable notifications" />
        <DiagnosticRow label="Push subscription active" ok={diagnostics?.subscriptionActive} warning={diagnostics?.subscriptionActive === false} warningText="Push subscription missing" />
        <DiagnosticRow label="Server connected" ok={subs.length > 0 || notificationsEnabled} />
      </div>

      {/* Registered devices */}
      {subs.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-xs font-medium text-cream-dim uppercase tracking-wider">Registered Devices</h3>
          {subs.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
              <div className="flex items-center gap-3">
                {sub.device_label?.includes('iPhone') || sub.device_label?.includes('iPad') || sub.device_label?.includes('Android') ? (
                  <Smartphone size={16} className="text-cream-dim" />
                ) : (
                  <Monitor size={16} className="text-cream-dim" />
                )}
                <div>
                  <p className="text-sm text-cream">{sub.device_label || 'Device'}</p>
                  <p className="text-[10px] text-cream-dim/50">
                    {sub.is_active ? 'Active' : 'Inactive'} · Added {new Date(sub.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveDevice(sub.id)}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Master toggle + categories */}
      <div className="glass-card p-5 space-y-4">
        <label className="flex items-center justify-between cursor-pointer pb-3 border-b border-white/[0.06]">
          <span className="text-sm font-medium text-cream">All Notifications</span>
          <input
            type="checkbox"
            checked={(prefs.notifications_master_enabled as boolean) ?? true}
            onChange={(e) => setPrefs({ ...prefs, notifications_master_enabled: e.target.checked })}
            className="accent-sage-500 w-4 h-4"
          />
        </label>

        <div className="space-y-2.5">
          {categoryToggles.map((toggle) => (
            <label key={toggle.key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-cream-dim">{toggle.label}</span>
              <input
                type="checkbox"
                checked={(prefs[toggle.key] as boolean) ?? true}
                onChange={(e) => setPrefs({ ...prefs, [toggle.key]: e.target.checked })}
                className="accent-sage-500 w-4 h-4"
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Briefing Time</label>
            <input
              type="time"
              value={(prefs.daily_briefing_time as string) || '07:00'}
              onChange={(e) => setPrefs({ ...prefs, daily_briefing_time: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Bedtime Preview</label>
            <input
              type="time"
              value={(prefs.bedtime_preview_time as string) || '21:00'}
              onChange={(e) => setPrefs({ ...prefs, bedtime_preview_time: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Quiet hours */}
      <div className="glass-card p-5 space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-cream">Quiet Hours</span>
          <input
            type="checkbox"
            checked={(prefs.quiet_hours_enabled as boolean) ?? false}
            onChange={(e) => setPrefs({ ...prefs, quiet_hours_enabled: e.target.checked })}
            className="accent-sage-500 w-4 h-4"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">Start</label>
            <input
              type="time"
              value={(prefs.quiet_hours_start as string) || '22:00'}
              onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-cream-dim mb-1.5">End</label>
            <input
              type="time"
              value={(prefs.quiet_hours_end as string) || '07:00'}
              onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
        <p className="text-[11px] text-cream-dim/50">
          Notifications won't be sent during quiet hours. They'll be delivered when quiet hours end.
        </p>
      </div>

      <button onClick={handleSave} disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save preferences'}
      </button>
    </div>
  );
}

function DiagnosticRow({ label, ok, warning, warningText }: { label: string; ok?: boolean; warning?: boolean; warningText?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-cream-dim">{label}</span>
      {ok ? (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-sage-400" />
          <span className="text-[11px] text-sage-300">OK</span>
        </div>
      ) : warning ? (
        <div className="flex items-center gap-1.5">
          <AlertCircle size={14} className="text-accent-warm" />
          <span className="text-[11px] text-accent-warm">{warningText || 'Needs attention'}</span>
        </div>
      ) : ok === false ? (
        <div className="flex items-center gap-1.5">
          <AlertCircle size={14} className="text-cream-dim/40" />
          <span className="text-[11px] text-cream-dim/50">Not set</span>
        </div>
      ) : (
        <Loader2 size={14} className="text-cream-dim/30 animate-spin" />
      )}
    </div>
  );
}
