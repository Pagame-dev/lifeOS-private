import { useEffect, useState } from 'react';
import { Bell, Settings, Clock, ChevronRight, Sparkles, Moon, BookOpen, AlertCircle, CheckSquare, Plus, Mic, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Holiday, TimetableEvent, Homework, TestExam, Task, Routine } from '@/lib/types';

interface DashboardProps {
  onNavigate: (view: 'home' | 'schedule' | 'tasks' | 'statistics' | 'more') => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getGreeting(hour: number): string {
  if (hour < 6) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
}

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { profile } = useAuth();
  const [now, setNow] = useState(new Date());
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [tests, setTests] = useState<TestExam[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadData() {
      const dayOfWeek = now.getDay();
      const weekType = profile?.current_week_type || 'A';

      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      const [eventsRes, hwRes, testsRes, tasksRes, routinesRes, holidayRes] = await Promise.all([
        supabase
          .from('timetable_events')
          .select('*')
          .eq('day_of_week', dayOfWeek)
          .order('start_time'),
        supabase
          .from('homework')
          .select('*')
          .in('status', ['todo', 'in_progress'])
          .order('due_date')
          .limit(5),
        supabase
          .from('tests_exams')
          .select('*')
          .eq('status', 'upcoming')
          .order('exam_date')
          .limit(3),
        supabase
          .from('tasks')
          .select('*')
          .in('status', ['todo', 'in_progress'])
          .order('priority', { ascending: false })
          .limit(5),
        supabase
          .from('routines')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('holidays')
          .select('*')
          .eq('date', todayKey)
          .maybeSingle(),
      ]);

      const todayHoliday = holidayRes.data as Holiday | null;
      setHoliday(todayHoliday);
      setEvents(((eventsRes.data as TimetableEvent[]) || []).filter((event) => {
        if (todayHoliday && event.is_school_lesson) return false;
        if (!event.is_school_lesson || !event.week_type) return true;
        return event.week_type === weekType;
      }));
      setHomework((hwRes.data as Homework[]) || []);
      setTests((testsRes.data as TestExam[]) || []);
      setTasks((tasksRes.data as Task[]) || []);
      setRoutines((routinesRes.data as Routine[]) || []);
      setLoading(false);
    }
    loadData();
  }, [now.getDay(), profile?.current_week_type]);

  const currentHour = now.getHours();
  const greeting = getGreeting(currentHour);
  const todayStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  const currentTimeStr = now.toTimeString().slice(0, 5);
  const currentEvent = events.find(
    (e) => currentTimeStr >= e.start_time && currentTimeStr < e.end_time
  );
  const nextEvent = events.find((e) => e.start_time > currentTimeStr);

  const applicableRoutines = routines.filter((r) =>
    r.applicable_days?.includes(now.getDay())
  );

  const today = now.toISOString().split('T')[0];
  const dueThisWeek = homework.filter((h) => {
    const diff = new Date(h.due_date).getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="space-y-6">
      {/* Top section */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <p className="text-xs text-cream-dim uppercase tracking-wider mb-1">{todayStr}</p>
          <h1 className="font-display text-2xl md:text-3xl text-cream">
            {greeting}, {profile?.display_name || 'there'}
          </h1>
          <div className="flex items-center gap-4 mt-2">
            {currentEvent ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-sage-400 animate-pulse" />
                <span className="text-cream">Now: {currentEvent.title}</span>
                <span className="text-cream-dim text-xs">
                  until {formatTime(currentEvent.end_time)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-cream-dim">
                {nextEvent
                  ? `Next: ${nextEvent.title} at ${formatTime(nextEvent.start_time)}`
                  : 'Nothing scheduled right now'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg text-cream-dim hover:text-cream hover:bg-white/[0.03] transition-colors">
            <Bell size={18} />
          </button>
          <button
            onClick={() => onNavigate('more')}
            className="p-2 rounded-lg text-cream-dim hover:text-cream hover:bg-white/[0.03] transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Mobile Now/Next hero */}
      <div className="md:hidden">
        {!loading && (currentEvent || nextEvent) && (
          <div className="fluorescent-card p-4 space-y-3">
            {currentEvent && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-sage-300 mb-1">Now</p>
                <p className="text-lg font-display text-cream">{currentEvent.title}</p>
                <p className="text-xs text-cream-dim mt-0.5">
                  until {formatTime(currentEvent.end_time)}
                  {currentEvent.room && ` · Room ${currentEvent.room}`}
                </p>
              </div>
            )}
            {nextEvent && (
              <div className={currentEvent ? 'pt-2 border-t border-white/[0.06]' : ''}>
                <p className="text-[10px] uppercase tracking-wider text-cream-dim mb-1">Next</p>
                <p className="text-sm font-medium text-cream">{nextEvent.title}</p>
                <p className="text-xs text-cream-dim mt-0.5">at {formatTime(nextEvent.start_time)}</p>
              </div>
            )}
          </div>
        )}

        {/* Mobile quick actions */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          <button
            onClick={() => onNavigate('tasks')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-cream-dim whitespace-nowrap active:scale-95 transition-transform"
          >
            <CheckCircle2 size={14} /> Tasks
          </button>
          <button
            onClick={() => onNavigate('schedule')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-cream-dim whitespace-nowrap active:scale-95 transition-transform"
          >
            <CalendarDays size={14} /> Timetable
          </button>
          <button
            onClick={() => onNavigate('more')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-cream-dim whitespace-nowrap active:scale-95 transition-transform"
          >
            <Bell size={14} /> Notifications
          </button>
        </div>
      </div>

      {holiday && (
        <div className="rounded-lg border border-accent-warm/15 bg-accent-warm/5 px-4 py-3 text-sm text-accent-warm">
          {holiday.label || 'School holiday'} — school lessons are hidden today. Your personal plans remain.
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Weekly timetable preview */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider">
                Today's Schedule
              </h2>
              <button
                onClick={() => onNavigate('schedule')}
                className="text-xs text-sage-300 hover:text-sage-200 flex items-center gap-1 transition-colors"
              >
                Full week <ChevronRight size={14} />
              </button>
            </div>

            {events.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Clock size={28} className="mx-auto text-cream-dim/40 mb-3" />
                <p className="text-sm text-cream-dim">No events scheduled for today</p>
                <p className="text-xs text-cream-dim/60 mt-1">
                  Add lessons and events in the Schedule tab
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => {
                  const isCurrent = currentEvent?.id === event.id;
                  return (
                    <div
                      key={event.id}
                      className={`fluorescent-card px-4 py-3 flex items-center justify-between ${
                        isCurrent ? 'current' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-mono text-cream-dim w-20">
                          {formatTime(event.start_time)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isCurrent ? 'text-sage-200' : 'text-cream'}`}>
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {event.room && (
                              <span className="text-xs text-cream-dim">{event.room}</span>
                            )}
                            {event.teacher && (
                              <span className="text-xs text-cream-dim">{event.teacher}</span>
                            )}
                            {event.week_type && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sage-500/10 text-sage-300 border border-sage-500/15">
                                Week {event.week_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-cream-dim font-mono">
                        {formatTime(event.end_time)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Supporting area */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Current routine */}
            <section>
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">
                Routines
              </h2>
              {applicableRoutines.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <Moon size={24} className="mx-auto text-cream-dim/40 mb-2" />
                  <p className="text-sm text-cream-dim">No routines for today</p>
                  <p className="text-xs text-cream-dim/60 mt-1">
                    Set up routines in Settings
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {applicableRoutines.slice(0, 3).map((routine) => (
                    <div key={routine.id} className="glass-card px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-cream">{routine.name}</p>
                        {routine.start_time && (
                          <span className="text-xs text-cream-dim font-mono">
                            {formatTime(routine.start_time)}
                          </span>
                        )}
                      </div>
                      {routine.description && (
                        <p className="text-xs text-cream-dim mt-1">{routine.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* AI recommendation */}
            <section>
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">
                AI Insight
              </h2>
              <div className="fluorescent-card p-5">
                <div className="flex items-start gap-3">
                  <Sparkles size={18} className="text-sage-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-cream leading-relaxed">
                      {events.length === 0
                        ? 'Your day is open. This is a good opportunity to tackle important tasks or take a well-deserved break.'
                        : homework.length > 3
                          ? 'You have several homework items due soon. Consider prioritising the most urgent ones during your free periods.'
                          : tasks.length > 0
                            ? 'You have pending tasks. When you have a moment, the highest priority ones are ready for you.'
                            : 'You seem well-organised today. Enjoy the calm — rest is productive too.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Below: homework, tasks, tests */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Homework */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider">
                  Homework
                </h2>
                <button
                  onClick={() => onNavigate('tasks')}
                  className="text-xs text-sage-300 hover:text-sage-200"
                >
                  View all
                </button>
              </div>
              {homework.length === 0 ? (
                <div className="glass-card p-5 text-center">
                  <BookOpen size={22} className="mx-auto text-cream-dim/40 mb-2" />
                  <p className="text-sm text-cream-dim">No homework pending</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {homework.slice(0, 3).map((hw) => (
                    <div key={hw.id} className="glass-card px-4 py-3">
                      <p className="text-sm font-medium text-cream">{hw.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-cream-dim">
                          Due {new Date(hw.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {hw.priority >= 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-warm/10 text-accent-warm border border-accent-warm/15">
                            High
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Tasks */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider">
                  Tasks
                </h2>
                <button
                  onClick={() => onNavigate('tasks')}
                  className="text-xs text-sage-300 hover:text-sage-200"
                >
                  View all
                </button>
              </div>
              {tasks.length === 0 ? (
                <div className="glass-card p-5 text-center">
                  <CheckSquare size={22} className="mx-auto text-cream-dim/40 mb-2" />
                  <p className="text-sm text-cream-dim">No pending tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="glass-card px-4 py-3">
                      <p className="text-sm font-medium text-cream">{task.title}</p>
                      {task.due_date && (
                        <span className="text-xs text-cream-dim mt-1 block">
                          Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming tests */}
            <section>
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">
                Upcoming Tests
              </h2>
              {tests.length === 0 ? (
                <div className="glass-card p-5 text-center">
                  <AlertCircle size={22} className="mx-auto text-cream-dim/40 mb-2" />
                  <p className="text-sm text-cream-dim">No upcoming tests</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tests.map((test) => {
                    const daysUntil = Math.ceil(
                      (new Date(test.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div key={test.id} className="glass-card px-4 py-3">
                        <p className="text-sm font-medium text-cream">{test.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-cream-dim">
                            {new Date(test.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className={`text-xs font-mono ${daysUntil <= 3 ? 'text-accent-warm' : 'text-cream-dim'}`}>
                            {daysUntil}d
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* What's due this week */}
          {dueThisWeek.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-cream-dim uppercase tracking-wider mb-3">
                What's Due This Week
              </h2>
              <div className="glass-card divide-y divide-white/[0.04]">
                {dueThisWeek.map((hw) => (
                  <div key={hw.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-cream">{hw.title}</p>
                      <p className="text-xs text-cream-dim mt-0.5">
                        Due {new Date(hw.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      new Date(hw.due_date).getTime() - now.getTime() < 2 * 86400000
                        ? 'bg-accent-warm/10 text-accent-warm border border-accent-warm/15'
                        : 'bg-sage-500/10 text-sage-300 border border-sage-500/15'
                    }`}>
                      {Math.ceil((new Date(hw.due_date).getTime() - now.getTime()) / 86400000)}d left
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}


