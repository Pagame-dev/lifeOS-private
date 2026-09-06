import { useEffect, useState, useRef } from 'react';
import { Bell, X, Clock, AlertCircle, Sparkles, CheckCircle2, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Notification, TimetableEvent, Homework, Task, TestExam, Routine, Workout } from '@/lib/types';

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

export function useSmartNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastCheckRef = useRef<Date | null>(null);

  useEffect(() => {
    async function checkNotifications() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      setUnreadCount(count || 0);
    }
    checkNotifications();
    const interval = setInterval(checkNotifications, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function generateSmartNotifications() {
      const now = new Date();
      if (lastCheckRef.current) {
        const elapsed = now.getTime() - lastCheckRef.current.getTime();
        if (elapsed < 60_000) return;
      }
      lastCheckRef.current = now;

      const todayKey = now.toISOString().split('T')[0];
      const dayOfWeek = now.getDay();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [eventsRes, hwRes, tasksRes, testsRes, workoutsRes, existingNotifsRes] = await Promise.all([
        supabase.from('timetable_events').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
        supabase.from('homework').select('*').in('status', ['todo', 'in_progress']).order('due_date'),
        supabase.from('tasks').select('*').in('status', ['todo', 'in_progress']),
        supabase.from('tests_exams').select('*').eq('status', 'upcoming'),
        supabase.from('workouts').select('*').eq('scheduled_date', todayKey).eq('status', 'planned'),
        supabase.from('notifications').select('*').gte('created_at', new Date(now.getTime() - 3600_000).toISOString()),
      ]);

      const events = (eventsRes.data as TimetableEvent[]) || [];
      const homework = (hwRes.data as Homework[]) || [];
      const tasks = (tasksRes.data as Task[]) || [];
      const tests = (testsRes.data as TestExam[]) || [];
      const workouts = (workoutsRes.data as Workout[]) || [];
      const recentNotifs = (existingNotifsRes.data as Notification[]) || [];

      const recentMessages = new Set(recentNotifs.map((n) => n.message));
      const newNotifications: Array<{ type: string; title: string; message: string; scheduled_for: string }> = [];

      const nextEvent = events.find((e) => e.start_time > currentTime);
      if (nextEvent) {
        const [eh, em] = nextEvent.start_time.split(':').map(Number);
        const eventMinutes = eh * 60 + em;
        const minutesUntil = eventMinutes - currentMinutes;

        if (minutesUntil > 0 && minutesUntil <= 10 && minutesUntil > 5) {
          const msg = `${nextEvent.title} starts in about 10 minutes${nextEvent.room ? ` in room ${nextEvent.room}` : ''}.`;
          if (!recentMessages.has(msg)) {
            newNotifications.push({ type: 'upcoming', title: 'Upcoming Event', message: msg, scheduled_for: now.toISOString() });
          }
        }

        if (minutesUntil > 0 && minutesUntil <= 5) {
          const msg = `${nextEvent.title} starts in ${minutesUntil} minutes${nextEvent.room ? ` in room ${nextEvent.room}` : ''}!`;
          if (!recentMessages.has(msg)) {
            newNotifications.push({ type: 'important', title: 'Starting Soon', message: msg, scheduled_for: now.toISOString() });
          }
        }

        const [prevEndH, prevEndM] = (events.find((e) => e.end_time <= currentTime)?.end_time || '00:00').split(':').map(Number);
        const prevEndMinutes = prevEndH * 60 + prevEndM;
        const gap = eventMinutes - prevEndMinutes;
        if (gap > 0 && currentMinutes > prevEndMinutes && currentMinutes < eventMinutes && gap > 5) {
          const minutesSincePrev = currentMinutes - prevEndMinutes;
          if (minutesSincePrev > gap * 0.5 && minutesSincePrev < gap) {
            const msg = `You're in a free period now. ${nextEvent.title} is at ${nextEvent.start_time}. You have about ${minutesUntil} minutes — good time for a quick task or homework.`;
            if (!recentMessages.has(msg)) {
              newNotifications.push({ type: 'ai_intervention', title: 'Free Period', message: msg, scheduled_for: now.toISOString() });
            }
          }
        }
      }

      const currentEvent = events.find((e) => currentTime >= e.start_time && currentTime < e.end_time);
      if (currentEvent) {
        const [eh, em] = currentEvent.end_time.split(':').map(Number);
        const endMinutes = eh * 60 + em;
        const minutesUntilEnd = endMinutes - currentMinutes;
        if (minutesUntilEnd > 0 && minutesUntilEnd <= 5) {
          const msg = `${currentEvent.title} ends in ${minutesUntilEnd} minutes. Get ready for your next activity.`;
          if (!recentMessages.has(msg)) {
            newNotifications.push({ type: 'upcoming', title: 'Class Ending Soon', message: msg, scheduled_for: now.toISOString() });
          }
        }
      }

      for (const hw of homework) {
        const dueDate = new Date(hw.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil === 0) {
          const msg = `${hw.title} is due today! Make sure to complete it.`;
          if (!recentMessages.has(msg)) {
            newNotifications.push({ type: 'important', title: 'Due Today', message: msg, scheduled_for: now.toISOString() });
          }
        } else if (daysUntil === 1) {
          const msg = `${hw.title} is due tomorrow. Have you started it yet?`;
          if (!recentMessages.has(msg)) {
            newNotifications.push({ type: 'upcoming', title: 'Due Tomorrow', message: msg, scheduled_for: now.toISOString() });
          }
        }
      }

      for (const test of tests) {
        const testDate = new Date(test.exam_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        testDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((testDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil === 2 && test.revision_progress < 50) {
          const msg = `${test.title} is in 2 days and your revision is only ${test.revision_progress}% done. Time to focus!`;
          if (!recentMessages.has(msg)) {
            newNotifications.push({ type: 'important', title: 'Test Warning', message: msg, scheduled_for: now.toISOString() });
          }
        } else if (daysUntil === 1) {
          const msg = `${test.title} is tomorrow. Make sure you've covered all topics: ${test.topics || 'all material'}.`;
          if (!recentMessages.has(msg)) {
            newNotifications.push({ type: 'important', title: 'Test Tomorrow', message: msg, scheduled_for: now.toISOString() });
          }
        }
      }

      for (const workout of workouts) {
        if (workout.scheduled_time) {
          const [wh, wm] = workout.scheduled_time.split(':').map(Number);
          const workoutMinutes = wh * 60 + wm;
          const minutesUntil = workoutMinutes - currentMinutes;
          if (minutesUntil > 0 && minutesUntil <= 15) {
            const msg = `Your workout "${workout.title}" is scheduled in about ${minutesUntil} minutes.`;
            if (!recentMessages.has(msg)) {
              newNotifications.push({ type: 'upcoming', title: 'Workout Reminder', message: msg, scheduled_for: now.toISOString() });
            }
          }
        }
      }

      const highPriorityTasks = tasks.filter((t) => t.priority >= 4 && !t.due_date);
      if (highPriorityTasks.length > 0 && now.getHours() >= 16 && now.getHours() < 20) {
        const msg = `You have ${highPriorityTasks.length} high-priority task(s) without a deadline. Consider scheduling time for them this evening.`;
        if (!recentMessages.has(msg)) {
          newNotifications.push({ type: 'ai_intervention', title: 'Task Reminder', message: msg, scheduled_for: now.toISOString() });
        }
      }

      if (newNotifications.length > 0) {
        const inserts = newNotifications.map((n) => ({
          type: n.type,
          title: n.title,
          message: n.message,
          is_read: false,
          is_acted_upon: false,
          scheduled_for: n.scheduled_for,
        }));
        await supabase.from('notifications').insert(inserts);
        setUnreadCount((prev) => prev + newNotifications.length);
      }
    }

    generateSmartNotifications();
    const interval = setInterval(generateSmartNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  return { unreadCount };
}
