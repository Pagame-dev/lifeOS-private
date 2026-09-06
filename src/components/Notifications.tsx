import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, X, Clock, AlertCircle, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Notification, TimetableEvent, Homework, Task, TestExam, Workout } from '@/lib/types';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    loadNotifications();
  }, [open]);

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadNotifications();
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unread.map((n) => n.id));
    loadNotifications();
  }

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-charcoal-950/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-card mt-0 md:mt-16 mr-0 md:mr-4 w-full md:w-96 max-h-[80vh] flex flex-col rounded-none md:rounded-2xl animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-sage-300" />
            <h2 className="font-display text-sm text-cream">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sage-500/15 text-sage-300 border border-sage-500/20">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-sage-300 hover:text-sage-200 transition-colors">
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-sage-500/20 border-t-sage-300 rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
              <Bell size={20} className="text-cream-dim/40" />
              <p className="text-xs text-cream-dim">No notifications yet</p>
              <p className="text-[10px] text-cream-dim/60">Smart alerts will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`w-full px-4 py-3 flex items-start gap-3 text-left transition-colors hover:bg-white/[0.02] ${
                    !n.is_read ? 'bg-sage-500/[0.03]' : ''
                  }`}
                >
                  <NotificationIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? 'text-cream font-medium' : 'text-cream-dim'}`}>{n.title}</p>
                    <p className="text-xs text-cream-dim/70 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-cream-dim/40 mt-1">
                      {new Date(n.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-sage-400 mt-1.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  const iconMap: Record<string, { icon: typeof Bell; color: string }> = {
    important: { icon: AlertCircle, color: 'text-accent-warm' },
    upcoming: { icon: Clock, color: 'text-sage-300' },
    ai_intervention: { icon: Sparkles, color: 'text-accent-cool' },
    summary: { icon: CheckCircle2, color: 'text-cream-dim' },
  };
  const config = iconMap[type] || iconMap.upcoming;
  const Icon = config.icon;
  return (
    <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center shrink-0">
      <Icon size={14} className={config.color} />
    </div>
  );
}

interface ToastNotification {
  id: string;
  type: string;
  title: string;
  message: string;
}

export function NotificationToasts() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    async function checkForNewNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      const notifs = (data as Notification[]) || [];
      const newToasts: ToastNotification[] = [];
      for (const n of notifs) {
        if (!seenIdsRef.current.has(n.id)) {
          seenIdsRef.current.add(n.id);
          newToasts.push({ id: n.id, type: n.type, title: n.title, message: n.message });
        }
      }
      if (newToasts.length > 0) {
        setToasts((prev) => [...prev, ...newToasts]);
      }
    }

    checkForNewNotifications();
    const interval = setInterval(checkForNewNotifications, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismissToast(t.id), 8000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col items-center px-4 pt-4 md:pt-6 pointer-events-none">
      <div className="w-full max-w-3xl space-y-2">
        {toasts.map((toast) => (
          <ToastBanner key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

function ToastBanner({ toast, onDismiss }: { toast: ToastNotification; onDismiss: () => void }) {
  const iconMap: Record<string, { icon: typeof Bell; color: string; accent: string }> = {
    important: { icon: AlertCircle, color: 'text-accent-warm', accent: 'border-accent-warm/25 bg-accent-warm/[0.08]' },
    upcoming: { icon: Clock, color: 'text-sage-300', accent: 'border-sage-500/20 bg-sage-500/[0.06]' },
    ai_intervention: { icon: Sparkles, color: 'text-accent-cool', accent: 'border-accent-cool/20 bg-accent-cool/[0.06]' },
    summary: { icon: CheckCircle2, color: 'text-cream-dim', accent: 'border-white/[0.08] bg-white/[0.03]' },
  };
  const config = iconMap[toast.type] || iconMap.upcoming;
  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto flex items-center gap-4 rounded-2xl border ${config.accent} backdrop-blur-xl px-5 py-4 shadow-2xl animate-slide-down`}
    >
      <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
        <Icon size={20} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-cream">{toast.title}</p>
        <p className="text-sm text-cream-muted mt-0.5 truncate">{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-2 rounded-lg text-cream-dim hover:text-cream hover:bg-white/[0.06] transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function useSmartNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastGenRef = useRef<Date | null>(null);
  const generatedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function checkUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      setUnreadCount(count || 0);
    }
    checkUnread();
    const interval = setInterval(checkUnread, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function generateSmartNotifications() {
      const now = new Date();
      if (lastGenRef.current) {
        const elapsed = now.getTime() - lastGenRef.current.getTime();
        if (elapsed < 300_000) return;
      }
      lastGenRef.current = now;

      const todayKey = now.toISOString().split('T')[0];
      const dayOfWeek = now.getDay();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [eventsRes, hwRes, tasksRes, testsRes, workoutsRes] = await Promise.all([
        supabase.from('timetable_events').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
        supabase.from('homework').select('*').in('status', ['todo', 'in_progress']).order('due_date'),
        supabase.from('tasks').select('*').in('status', ['todo', 'in_progress']),
        supabase.from('tests_exams').select('*').eq('status', 'upcoming'),
        supabase.from('workouts').select('*').eq('scheduled_date', todayKey).eq('status', 'planned'),
      ]);

      const events = (eventsRes.data as TimetableEvent[]) || [];
      const homework = (hwRes.data as Homework[]) || [];
      const tasks = (tasksRes.data as Task[]) || [];
      const tests = (testsRes.data as TestExam[]) || [];
      const workouts = (workoutsRes.data as Workout[]) || [];

      const newNotifications: Array<{ type: string; title: string; message: string; dedupKey: string }> = [];

      const nextEvent = events.find((e) => e.start_time > currentTime);
      if (nextEvent) {
        const [eh, em] = nextEvent.start_time.split(':').map(Number);
        const eventMinutes = eh * 60 + em;
        const minutesUntil = eventMinutes - currentMinutes;

        if (minutesUntil > 0 && minutesUntil <= 5) {
          const key = `event-5min-${nextEvent.id}-${todayKey}`;
          if (!generatedKeysRef.current.has(key)) {
            generatedKeysRef.current.add(key);
            newNotifications.push({
              type: 'important',
              title: 'Starting Soon',
              message: `${nextEvent.title} starts in ${minutesUntil} minute${minutesUntil > 1 ? 's' : ''}${nextEvent.room ? ` · Room ${nextEvent.room}` : ''}`,
              dedupKey: key,
            });
          }
        }
      }

      const currentEvent = events.find((e) => currentTime >= e.start_time && currentTime < e.end_time);
      if (currentEvent) {
        const [eh, em] = currentEvent.end_time.split(':').map(Number);
        const minutesUntilEnd = eh * 60 + em - currentMinutes;
        if (minutesUntilEnd > 0 && minutesUntilEnd <= 3) {
          const key = `event-ending-${currentEvent.id}-${todayKey}`;
          if (!generatedKeysRef.current.has(key)) {
            generatedKeysRef.current.add(key);
            newNotifications.push({
              type: 'upcoming',
              title: 'Class Ending Soon',
              message: `${currentEvent.title} ends in ${minutesUntilEnd} minutes — get ready for what's next.`,
              dedupKey: key,
            });
          }
        }
      }

      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (const hw of homework) {
        const d = new Date(hw.due_date + 'T00:00:00');
        const daysUntil = Math.round((d.getTime() - today.getTime()) / 86400000);
        if (daysUntil === 0) {
          const key = `hw-today-${hw.id}-${todayKey}`;
          if (!generatedKeysRef.current.has(key)) {
            generatedKeysRef.current.add(key);
            newNotifications.push({ type: 'important', title: 'Due Today', message: `${hw.title} is due today. Make sure to finish it.`, dedupKey: key });
          }
        }
      }

      for (const test of tests) {
        const d = new Date(test.exam_date + 'T00:00:00');
        const daysUntil = Math.round((d.getTime() - today.getTime()) / 86400000);
        if (daysUntil === 1) {
          const key = `test-tomorrow-${test.id}-${todayKey}`;
          if (!generatedKeysRef.current.has(key)) {
            generatedKeysRef.current.add(key);
            newNotifications.push({ type: 'important', title: 'Test Tomorrow', message: `${test.title} is tomorrow — ${test.revision_progress}% revised so far.`, dedupKey: key });
          }
        }
      }

      for (const workout of workouts) {
        if (workout.scheduled_time) {
          const [wh, wm] = workout.scheduled_time.split(':').map(Number);
          const minutesUntil = wh * 60 + wm - currentMinutes;
          if (minutesUntil > 0 && minutesUntil <= 10) {
            const key = `workout-${workout.id}-${todayKey}`;
            if (!generatedKeysRef.current.has(key)) {
              generatedKeysRef.current.add(key);
              newNotifications.push({ type: 'upcoming', title: 'Workout Soon', message: `Your workout "${workout.title}" starts in about ${minutesUntil} minutes.`, dedupKey: key });
            }
          }
        }
      }

      const highPriorityTasks = tasks.filter((t) => t.priority >= 4 && !t.due_date);
      if (highPriorityTasks.length > 0 && now.getHours() >= 16 && now.getHours() < 20) {
        const key = `high-priority-tasks-${todayKey}`;
        if (!generatedKeysRef.current.has(key)) {
          generatedKeysRef.current.add(key);
          newNotifications.push({ type: 'ai_intervention', title: 'Unscheduled Priorities', message: `You have ${highPriorityTasks.length} high-priority task${highPriorityTasks.length > 1 ? 's' : ''} without a deadline. Consider scheduling time this evening.`, dedupKey: key });
        }
      }

      if (newNotifications.length > 0) {
        const inserts = newNotifications.map((n) => ({
          type: n.type,
          title: n.title,
          message: n.message,
          is_read: false,
          is_acted_upon: false,
          scheduled_for: now.toISOString(),
        }));
        await supabase.from('notifications').insert(inserts);
        setUnreadCount((prev) => prev + newNotifications.length);
      }
    }

    generateSmartNotifications();
    const interval = setInterval(generateSmartNotifications, 300_000);
    return () => clearInterval(interval);
  }, []);

  return { unreadCount };
}
