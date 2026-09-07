import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Dumbbell, BookOpen, Calendar, Clock, Repeat } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Holiday, Subject, TimetableEvent, Workout, LogopedeSession, Homework, Task, ScheduleOverride, WorkoutRecurrence } from '@/lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
const HOUR_HEIGHT = 64;
const TIMETABLE_START = 7 * 60;

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function fmtTimeShort(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${displayHour}${suffix}` : `${displayHour}:${String(m).padStart(2, '0')}${suffix}`;
}

type EventSlot = { kind: 'event'; data: TimetableEvent; start_time: string; end_time: string; overrideLabel?: string };
type WorkoutSlot = { kind: 'workout'; data: Workout; start_time: string; end_time: string; isRecurring?: boolean };
type RecurringWorkoutSlot = { kind: 'recurring_workout'; data: WorkoutRecurrence; start_time: string; end_time: string };
type LogopedeSlot = { kind: 'logopede'; data: LogopedeSession; start_time: string; end_time: string };
type Slot = EventSlot | WorkoutSlot | RecurringWorkoutSlot | LogopedeSlot;

function dateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - distanceFromMonday);
  return result;
}

function getWeekDates(weekStart: Date): Date[] {
  return DAY_INDICES.map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
}

function minutesFromTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatWeekRange(weekDates: Date[]): string {
  const first = weekDates[0];
  const last = weekDates[6];
  const firstMonth = first.toLocaleDateString('en-US', { month: 'short' });
  const lastMonth = last.toLocaleDateString('en-US', { month: 'short' });
  if (firstMonth === lastMonth) {
    return `${firstMonth} ${first.getDate()}–${last.getDate()}, ${last.getFullYear()}`;
  }
  return `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}, ${last.getFullYear()}`;
}

type AddType = 'event' | 'workout' | 'recurring_workout' | 'homework' | 'task';

export function Schedule() {
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [logopedeSessions, setLogopedeSessions] = useState<LogopedeSession[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [recurrences, setRecurrences] = useState<WorkoutRecurrence[]>([]);
  const [editingRecurrence, setEditingRecurrence] = useState<WorkoutRecurrence | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editingEvent, setEditingEvent] = useState<TimetableEvent | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [creatingForDay, setCreatingForDay] = useState<number | null>(null);
  const [creatingAt, setCreatingAt] = useState('09:00');
  const [creatingDate, setCreatingDate] = useState<string>('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addType, setAddType] = useState<AddType | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const displayedHolidayKeys = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

  const weekType = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date());
    const diff = Math.round((weekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return diff % 2 === 0 ? 'A' : 'B';
  }, [weekStart]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadData() {
    const weekStartKey = dateKey(weekDates[0]);
    const weekEndKey = dateKey(weekDates[6]);
    const [eventsRes, subjectsRes, holidaysRes, workoutsRes, logopedeRes, overridesRes, recurrencesRes] = await Promise.all([
      supabase.from('timetable_events').select('*'),
      supabase.from('subjects').select('*'),
      supabase.from('holidays').select('*').gte('date', weekStartKey).lte('date', weekEndKey),
      supabase.from('workouts').select('*').gte('scheduled_date', weekStartKey).lte('scheduled_date', weekEndKey),
      supabase.from('logopede_sessions').select('*').gte('session_date', weekStartKey).lte('session_date', weekEndKey),
      supabase.from('schedule_overrides').select('*').gte('override_date', weekStartKey).lte('override_date', weekEndKey),
      supabase.from('workout_recurrences').select('*').eq('is_active', true),
    ]);

    setEvents((eventsRes.data as TimetableEvent[]) || []);
    setSubjects((subjectsRes.data as Subject[]) || []);
    setHolidays((holidaysRes.data as Holiday[]) || []);
    setWorkouts((workoutsRes.data as Workout[]) || []);
    setLogopedeSessions((logopedeRes.data as LogopedeSession[]) || []);
    setOverrides((overridesRes.data as ScheduleOverride[]) || []);
    setRecurrences((recurrencesRes.data as WorkoutRecurrence[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [weekStart]);

  function getSlotsForDay(day: number, date: Date): Slot[] {
    const isHoliday = displayedHolidayKeys.has(dateKey(date));
    const dateKeyStr = dateKey(date);
    const dayOverrides = overrides.filter((o) => o.override_date === dateKeyStr);

    let dayEvents: EventSlot[] = events
      .filter((event) => {
        if (event.day_of_week !== day) return false;
        if (event.is_school_lesson && isHoliday) return false;
        if (!event.is_school_lesson || !event.week_type) return true;
        return event.week_type === weekType;
      })
      .map((e) => ({ kind: 'event' as const, data: e, start_time: e.start_time, end_time: e.end_time }));

    dayEvents = dayEvents.filter((slot) => {
      const matchingOverride = dayOverrides.find(
        (o) => o.event_title.toLowerCase() === slot.data.title.toLowerCase() && o.action_type === 'cancelled',
      );
      return !matchingOverride;
    });

    dayEvents = dayEvents.map((slot) => {
      const mod = dayOverrides.find(
        (o) => o.event_title.toLowerCase() === slot.data.title.toLowerCase() && o.action_type === 'modified',
      );
      if (mod) {
        return {
          kind: 'event' as const,
          data: { ...slot.data, room: mod.new_room ?? slot.data.room, title: mod.new_title ?? slot.data.title },
          start_time: mod.new_start_time ?? slot.start_time,
          end_time: mod.new_end_time ?? slot.end_time,
          overrideLabel: 'Today only',
        };
      }
      return slot;
    });

    const dayWorkouts: (WorkoutSlot | RecurringWorkoutSlot)[] = workouts
      .filter((w) => w.scheduled_date === dateKeyStr)
      .map((w) => ({
        kind: 'workout' as const,
        data: w,
        start_time: w.scheduled_time || '17:00',
        end_time: w.scheduled_time
          ? `${String(Math.min(23, parseInt(w.scheduled_time.slice(0, 2)) + Math.ceil((w.duration_min || 60) / 60))).padStart(2, '0')}:${w.scheduled_time.slice(3, 5)}`
          : '18:00',
      }));

    const existingWorkoutDates = new Set(workouts.filter((w) => w.scheduled_date === dateKeyStr && w.recurrence_id).map((w) => w.recurrence_id));
    const dayRecurringWorkouts: RecurringWorkoutSlot[] = recurrences
      .filter((r) => r.day_of_week === day && !existingWorkoutDates.has(r.id) && !isHoliday)
      .map((r) => {
        const startTime = r.scheduled_time || '17:00';
        const duration = r.duration_min || 60;
        const endHour = Math.min(23, parseInt(startTime.slice(0, 2)) + Math.ceil(duration / 60));
        return {
          kind: 'recurring_workout' as const,
          data: r,
          start_time: startTime,
          end_time: `${String(endHour).padStart(2, '0')}:${startTime.slice(3, 5)}`,
        };
      });

    const dayLogopede: LogopedeSlot[] = logopedeSessions
      .filter((s) => s.session_date === dateKeyStr)
      .map((s) => ({
        kind: 'logopede' as const,
        data: s,
        start_time: s.session_type === 'morning' ? '07:30' : '19:00',
        end_time: s.session_type === 'morning' ? '07:45' : '19:15',
      }));

    return [...dayEvents, ...dayWorkouts, ...dayRecurringWorkouts, ...dayLogopede].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
  }

  function getSubjectColor(subjectId: string | null): string {
    if (!subjectId) return '#8b9a6b';
    return subjects.find((s) => s.id === subjectId)?.color || '#8b9a6b';
  }

  function openCreate(day: number, date: Date, hour: number, minute = 0) {
    setCreatingForDay(day);
    setCreatingDate(dateKey(date));
    setCreatingAt(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    setAddMenuOpen(true);
  }

  function changeWeek(amount: number) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + amount * 7);
    setWeekStart(next);
  }

  const isCurrentWeek = dateKey(weekDates[0]) === dateKey(startOfWeek(now));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 glass-card animate-pulse" />
        <div className="h-[800px] glass-card animate-pulse" />
      </div>
    );
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-cream">Schedule</h1>
            {isCurrentWeek && (
              <span className="rounded-full border border-sage-500/20 bg-sage-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sage-300">
                This week
              </span>
            )}
            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-cream-dim">
              Week {weekType}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-cream-dim">{formatWeekRange(weekDates)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="btn-ghost border border-white/[0.06] px-3 py-1.5 text-sm"
          >
            Today
          </button>
          <button
            onClick={() => changeWeek(-1)}
            aria-label="Previous week"
            className="rounded-lg border border-white/[0.06] p-2 text-cream-dim transition-colors hover:bg-white/[0.03] hover:text-cream"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => changeWeek(1)}
            aria-label="Next week"
            className="rounded-lg border border-white/[0.06] p-2 text-cream-dim transition-colors hover:bg-white/[0.03] hover:text-cream"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            {/* Day headers */}
            <div className="grid grid-cols-[64px_repeat(7,minmax(128px,1fr))] border-b border-white/[0.05]">
              <div className="p-3" />
              {weekDates.map((date, index) => {
                const isToday = dateKey(date) === dateKey(now);
                const holiday = displayedHolidayKeys.has(dateKey(date));
                return (
                  <div
                    key={dateKey(date)}
                    className={`border-l border-white/[0.04] px-2 py-3 text-center ${isToday ? 'bg-sage-500/[0.06]' : ''}`}
                  >
                    <p className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-sage-300' : 'text-cream-dim'}`}>
                      {DAYS[index]}
                    </p>
                    <p className={`mt-1 text-lg font-display ${isToday ? 'text-sage-200' : 'text-cream'}`}>
                      {date.getDate()}
                    </p>
                    {holiday && (
                      <span className="mt-0.5 inline-block rounded-full bg-accent-warm/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-accent-warm">
                        Holiday
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time grid with absolute-positioned events */}
            <div className="relative">
              {/* Hour rows */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(128px,1fr))]">
                <div className="border-r border-white/[0.04]">
                  {HOURS.map((hour) => (
                    <div key={hour} className="relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                      <span className="absolute top-0 right-2 -translate-y-1/2 text-[10px] font-mono text-cream-dim/50">
                        {formatTime(`${hour}:00`)}
                      </span>
                    </div>
                  ))}
                </div>
                {weekDates.map((date, index) => {
                  const dayIndex = DAY_INDICES[index];
                  const isToday = dateKey(date) === dateKey(now);
                  const holiday = displayedHolidayKeys.has(dateKey(date));
                  return (
                    <div
                      key={dateKey(date)}
                      className={`relative border-l border-white/[0.04] ${isToday ? 'bg-sage-500/[0.015]' : ''}`}
                      onDoubleClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const hourIndex = Math.floor(y / HOUR_HEIGHT);
                        openCreate(dayIndex, date, HOURS[Math.min(hourIndex, HOURS.length - 1)]);
                      }}
                    >
                      {/* Hour lines */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="border-b border-white/[0.03]"
                          style={{ height: `${HOUR_HEIGHT}px` }}
                        />
                      ))}
                      {holiday && (
                        <div className="pointer-events-none absolute inset-0 bg-accent-warm/[0.02]" />
                      )}
                      {/* Now line */}
                      {isToday && currentMinutes >= TIMETABLE_START && currentMinutes < TIMETABLE_START + HOURS.length * 60 && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                          style={{ top: `${((currentMinutes - TIMETABLE_START) / 60) * HOUR_HEIGHT}px` }}
                        >
                          <span className="h-2 w-2 rounded-full bg-sage-300 shadow-[0_0_8px_rgba(192,208,160,0.7)] ml-1" />
                          <span className="h-px flex-1 bg-sage-300/60" />
                        </div>
                      )}
                      {/* Events */}
                      {getSlotsForDay(dayIndex, date).map((slot) => (
                        <SlotCard
                          key={`${slot.kind}-${slot.data.id}`}
                          slot={slot}
                          onEditEvent={(e) => setEditingEvent(e)}
                          onEditWorkout={(w) => setEditingWorkout(w)}
                          onEditRecurrence={(r) => setEditingRecurrence(r)}
                          getSubjectColor={getSubjectColor}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-cream-dim/50">
        Double-click a time slot to add something. Click any item to edit or delete it.
      </p>

      {/* Add type menu */}
      {addMenuOpen && creatingForDay !== null && !addType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={() => setAddMenuOpen(false)}>
          <div className="glass-card w-full max-w-sm p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-cream">Add to Schedule</h2>
              <button onClick={() => setAddMenuOpen(false)} className="text-cream-dim hover:text-cream transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              <AddOption icon={Calendar} label="Event / Lesson" desc="Timetable event or class" onClick={() => setAddType('event')} />
              <AddOption icon={Dumbbell} label="Workout" desc="Schedule a one-time workout" onClick={() => setAddType('workout')} />
              <AddOption icon={Repeat} label="Recurring Workout" desc="Weekly repeating workout" onClick={() => setAddType('recurring_workout')} />
              <AddOption icon={BookOpen} label="Homework" desc="Add a homework assignment" onClick={() => setAddType('homework')} />
              <AddOption icon={Clock} label="Task" desc="Add a task with a deadline" onClick={() => setAddType('task')} />
            </div>
          </div>
        </div>
      )}

      {/* Event editor */}
      {(editingEvent || (addType === 'event' && creatingForDay !== null)) && (
        <EventEditModal
          event={editingEvent}
          day={creatingForDay}
          initialTime={creatingAt}
          subjects={subjects}
          onClose={() => { setEditingEvent(null); setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
          onSaved={() => { loadData(); setEditingEvent(null); setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
        />
      )}

      {/* Workout editor */}
      {(editingWorkout || (addType === 'workout' && creatingForDay !== null)) && (
        <WorkoutScheduleModal
          workout={editingWorkout}
          initialDate={creatingDate}
          initialTime={creatingAt}
          onClose={() => { setEditingWorkout(null); setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
          onSaved={() => { loadData(); setEditingWorkout(null); setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
        />
      )}

      {/* Recurring workout editor */}
      {(editingRecurrence || (addType === 'recurring_workout' && creatingForDay !== null)) && (
        <RecurringWorkoutModal
          recurrence={editingRecurrence}
          initialDay={creatingForDay ?? 1}
          initialTime={creatingAt}
          onClose={() => { setEditingRecurrence(null); setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
          onSaved={() => { loadData(); setEditingRecurrence(null); setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
        />
      )}

      {/* Homework quick-add */}
      {addType === 'homework' && creatingForDay !== null && (
        <HomeworkQuickAdd
          initialDate={creatingDate}
          onClose={() => { setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
          onSaved={() => { setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
        />
      )}

      {/* Task quick-add */}
      {addType === 'task' && creatingForDay !== null && (
        <TaskQuickAdd
          initialDate={creatingDate}
          onClose={() => { setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
          onSaved={() => { setAddMenuOpen(false); setAddType(null); setCreatingForDay(null); }}
        />
      )}
    </div>
  );
}

function SlotCard({ slot, onEditEvent, onEditWorkout, onEditRecurrence, getSubjectColor }: {
  slot: Slot;
  onEditEvent: (e: TimetableEvent) => void;
  onEditWorkout: (w: Workout) => void;
  onEditRecurrence: (r: WorkoutRecurrence) => void;
  getSubjectColor: (id: string | null) => string;
}) {
  const startMin = minutesFromTime(slot.start_time);
  const endMin = minutesFromTime(slot.end_time);
  const topOffset = Math.max(0, (startMin - TIMETABLE_START) / 60 * HOUR_HEIGHT);
  const height = Math.max(28, ((endMin - startMin) / 60) * HOUR_HEIGHT - 4);
  const isOutOfBounds = startMin < TIMETABLE_START;
  if (isOutOfBounds) return null;

  if (slot.kind === 'event') {
    const event = slot.data;
    const color = getSubjectColor(event.subject_id);
    return (
      <button
        onClick={() => onEditEvent(event)}
        className="absolute left-1 right-1 z-10 rounded-lg border-l-[3px] px-2 py-1.5 text-left overflow-hidden transition-all hover:z-20 hover:scale-[1.02]"
        style={{
          top: `${topOffset}px`,
          height: `${height}px`,
          borderLeftColor: color,
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          borderColor: `${color}30`,
        }}
      >
        <p className="truncate text-xs font-medium text-cream leading-tight">{event.title}</p>
        <p className="text-[10px] font-mono text-cream-dim/70 mt-0.5">
          {fmtTimeShort(slot.start_time)} – {fmtTimeShort(slot.end_time)}
        </p>
        {height > 48 && event.room && <p className="truncate text-[10px] text-cream-dim/50 mt-0.5">{event.room}</p>}
        {slot.kind === 'event' && slot.overrideLabel && (
          <p className="text-[9px] text-accent-warm/80 mt-0.5 font-medium">{slot.overrideLabel}</p>
        )}
      </button>
    );
  }

  if (slot.kind === 'workout') {
    const workout = slot.data;
    return (
      <button
        onClick={() => onEditWorkout(workout)}
        className="absolute left-1 right-1 z-10 rounded-lg border-l-[3px] border-accent-warm/60 px-2 py-1.5 text-left overflow-hidden transition-all hover:z-20 hover:scale-[1.02]"
        style={{
          top: `${topOffset}px`,
          height: `${height}px`,
          background: 'linear-gradient(135deg, rgba(196,169,125,0.15), rgba(196,169,125,0.05))',
        }}
      >
        <div className="flex items-center gap-1">
          <Dumbbell size={11} className="text-accent-warm shrink-0" />
          <p className="truncate text-xs font-medium text-accent-warm leading-tight">{workout.title}</p>
        </div>
        <p className="text-[10px] font-mono text-cream-dim/60 mt-0.5">
          {fmtTimeShort(slot.start_time)} – {fmtTimeShort(slot.end_time)}
        </p>
      </button>
    );
  }

  if (slot.kind === 'recurring_workout') {
    const rec = slot.data;
    return (
      <button
        onClick={() => onEditRecurrence(rec)}
        className="absolute left-1 right-1 z-10 rounded-lg border-l-[3px] border-accent-warm/40 px-2 py-1.5 text-left overflow-hidden transition-all hover:z-20 hover:scale-[1.02] border-dashed"
        style={{
          top: `${topOffset}px`,
          height: `${height}px`,
          background: 'linear-gradient(135deg, rgba(196,169,125,0.08), rgba(196,169,125,0.02))',
        }}
      >
        <div className="flex items-center gap-1">
          <Repeat size={10} className="text-accent-warm/60 shrink-0" />
          <p className="truncate text-xs font-medium text-accent-warm/80 leading-tight">{rec.title}</p>
        </div>
        <p className="text-[10px] font-mono text-cream-dim/40 mt-0.5">
          {fmtTimeShort(slot.start_time)} – {fmtTimeShort(slot.end_time)}
        </p>
      </button>
    );
  }

  const session = slot.data;
  const isCompleted = session.status === 'completed';
  return (
    <div
      className={`absolute left-1 right-1 z-10 rounded-lg border-l-[3px] px-2 py-1.5 overflow-hidden ${isCompleted ? 'border-sage-500/40 bg-sage-500/[0.06] opacity-50' : 'border-accent-cool/50'}`}
      style={{
        top: `${topOffset}px`,
        height: `${height}px`,
        background: isCompleted ? undefined : 'linear-gradient(135deg, rgba(122,143,163,0.12), rgba(122,143,163,0.04))',
      }}
    >
      <p className="truncate text-xs font-medium text-accent-cool capitalize leading-tight">Logopède {session.session_type}</p>
      <p className="text-[10px] font-mono text-cream-dim/60 mt-0.5">
        {fmtTimeShort(slot.start_time)} – {fmtTimeShort(slot.end_time)}
      </p>
    </div>
  );
}

function AddOption({ icon: Icon, label, desc, onClick }: { icon: typeof Calendar; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-all hover:bg-white/[0.04] hover:border-white/[0.1]"
    >
      <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
        <Icon size={16} className="text-sage-300" />
      </div>
      <div>
        <p className="text-sm font-medium text-cream">{label}</p>
        <p className="text-xs text-cream-dim/60">{desc}</p>
      </div>
    </button>
  );
}

function EventEditModal({ event, day, initialTime, subjects, onClose, onSaved }: {
  event: TimetableEvent | null;
  day: number | null;
  initialTime: string;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(event?.title || '');
  const [startTime, setStartTime] = useState(event?.start_time || initialTime);
  const [endTime, setEndTime] = useState(event?.end_time || `${String(Number(initialTime.slice(0, 2)) + 1).padStart(2, '0')}:00`);
  const [dayOfWeek, setDayOfWeek] = useState(event?.day_of_week ?? day ?? 1);
  const [weekType, setWeekType] = useState(event?.week_type || '');
  const [isSchoolLesson, setIsSchoolLesson] = useState(event?.is_school_lesson || false);
  const [room, setRoom] = useState(event?.room || '');
  const [teacher, setTeacher] = useState(event?.teacher || '');
  const [subjectId, setSubjectId] = useState(event?.subject_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return;
    if (endTime <= startTime) { setError('End time must be after start time.'); return; }
    setSaving(true); setError(null);
    const data = {
      title: title.trim(), start_time: startTime, end_time: endTime,
      day_of_week: dayOfWeek, week_type: weekType || null,
      is_school_lesson: isSchoolLesson, room: room.trim(), teacher: teacher.trim(),
      subject_id: subjectId || null,
    };
    try {
      const result = event
        ? await supabase.from('timetable_events').update(data).eq('id', event.id)
        : await supabase.from('timetable_events').insert(data);
      if (result.error) throw result.error;
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!event) return;
    setSaving(true);
    const { error: delErr } = await supabase.from('timetable_events').delete().eq('id', event.id);
    if (delErr) { setError(delErr.message); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 px-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card max-h-[90vh] w-full max-w-md overflow-y-auto p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-cream">{event ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Event title" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs text-cream-dim">Start</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field" /></div>
            <div><label className="mb-1.5 block text-xs text-cream-dim">End</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs text-cream-dim">Day</label><select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="input-field">{DAY_NAMES.map((d, i) => <option key={d} value={i} className="bg-charcoal-800">{d}</option>)}</select></div>
            <div><label className="mb-1.5 block text-xs text-cream-dim">Week Type</label><select value={weekType} onChange={(e) => setWeekType(e.target.value)} className="input-field"><option value="" className="bg-charcoal-800">Both weeks</option><option value="A" className="bg-charcoal-800">Week A</option><option value="B" className="bg-charcoal-800">Week B</option></select></div>
          </div>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field"><option value="" className="bg-charcoal-800">No subject</option>{subjects.map((s) => <option key={s.id} value={s.id} className="bg-charcoal-800">{s.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-3">
            <input value={room} onChange={(e) => setRoom(e.target.value)} className="input-field" placeholder="Room" />
            <input value={teacher} onChange={(e) => setTeacher(e.target.value)} className="input-field" placeholder="Teacher" />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isSchoolLesson} onChange={(e) => setIsSchoolLesson(e.target.checked)} className="accent-sage-500" />
            <span className="text-sm text-cream-dim">School lesson (follows Week A/B & holidays)</span>
          </label>
          {error && <div className="rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-2 text-sm text-red-400/80">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            {event && <button onClick={handleDelete} disabled={saving} className="rounded-lg border border-red-500/15 px-4 py-2.5 text-sm text-red-400/80 hover:bg-red-500/5 disabled:opacity-50"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkoutScheduleModal({ workout, initialDate, initialTime, onClose, onSaved }: {
  workout: Workout | null;
  initialDate: string;
  initialTime: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(workout?.title || '');
  const [workoutType, setWorkoutType] = useState(workout?.workout_type || '');
  const [date, setDate] = useState(workout?.scheduled_date || initialDate);
  const [scheduledTime, setScheduledTime] = useState(workout?.scheduled_time || initialTime);
  const [duration, setDuration] = useState(workout?.duration_min?.toString() || '60');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true); setError(null);
    const data = {
      title: title.trim(), workout_type: workoutType.trim(),
      scheduled_date: date, scheduled_time: scheduledTime || null,
      duration_min: duration ? parseInt(duration) : null, jefit_link: workout?.jefit_link || '',
    };
    try {
      const result = workout
        ? await supabase.from('workouts').update(data).eq('id', workout.id)
        : await supabase.from('workouts').insert({ ...data, status: 'planned', skip_reason: '' });
      if (result.error) throw result.error;
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!workout) return;
    setSaving(true);
    await supabase.from('workouts').delete().eq('id', workout.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 px-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell size={18} className="text-accent-warm" />
            <h2 className="font-display text-xl text-cream">{workout ? 'Edit Workout' : 'New Workout'}</h2>
          </div>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Workout title" autoFocus />
          <input value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} className="input-field" placeholder="Type (Push, Pull, Legs...)" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="input-field" />
          </div>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field" placeholder="Duration (min)" min={5} />
          {error && <div className="rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-2 text-sm text-red-400/80">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            {workout && <button onClick={handleDelete} disabled={saving} className="rounded-lg border border-red-500/15 px-4 py-2.5 text-sm text-red-400/80 hover:bg-red-500/5 disabled:opacity-50"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeworkQuickAdd({ initialDate, onClose, onSaved }: { initialDate: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(initialDate);
  const [subjectId, setSubjectId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('subjects').select('*').then(({ data }) => setSubjects((data as Subject[]) || []));
  }, []);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from('homework').insert({
      title: title.trim(), due_date: dueDate, subject_id: subjectId || null,
      status: 'todo', estimated_time_min: 30,
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 px-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-sage-300" />
            <h2 className="font-display text-xl text-cream">New Homework</h2>
          </div>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Homework title" autoFocus />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
            <option value="" className="bg-charcoal-800">No subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id} className="bg-charcoal-800">{s.name}</option>)}
          </select>
          <button onClick={handleSave} disabled={!title.trim() || saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Add Homework'}</button>
        </div>
      </div>
    </div>
  );
}

function TaskQuickAdd({ initialDate, onClose, onSaved }: { initialDate: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(initialDate);
  const [priority, setPriority] = useState('3');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from('tasks').insert({
      title: title.trim(), due_date: dueDate, priority: parseInt(priority),
      status: 'todo',
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 px-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-sage-300" />
            <h2 className="font-display text-xl text-cream">New Task</h2>
          </div>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Task title" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-field">
              {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p} className="bg-charcoal-800">Priority {p}</option>)}
            </select>
          </div>
          <button onClick={handleSave} disabled={!title.trim() || saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  );
}

function RecurringWorkoutModal({ recurrence, initialDay, initialTime, onClose, onSaved }: {
  recurrence: WorkoutRecurrence | null;
  initialDay: number;
  initialTime: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(recurrence?.title || '');
  const [workoutType, setWorkoutType] = useState(recurrence?.workout_type || '');
  const [dayOfWeek, setDayOfWeek] = useState(recurrence?.day_of_week ?? initialDay);
  const [scheduledTime, setScheduledTime] = useState(recurrence?.scheduled_time || initialTime);
  const [duration, setDuration] = useState(recurrence?.duration_min?.toString() || '60');
  const [isActive, setIsActive] = useState(recurrence?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true); setError(null);
    const data = {
      title: title.trim(),
      workout_type: workoutType.trim(),
      day_of_week: dayOfWeek,
      scheduled_time: scheduledTime || null,
      duration_min: duration ? parseInt(duration) : null,
      jefit_link: recurrence?.jefit_link || '',
      is_active: isActive,
    };
    try {
      const result = recurrence
        ? await supabase.from('workout_recurrences').update(data).eq('id', recurrence.id)
        : await supabase.from('workout_recurrences').insert(data);
      if (result.error) throw result.error;
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!recurrence) return;
    setSaving(true);
    await supabase.from('workout_recurrences').delete().eq('id', recurrence.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 px-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat size={18} className="text-accent-warm" />
            <h2 className="font-display text-xl text-cream">{recurrence ? 'Edit Recurring Workout' : 'New Recurring Workout'}</h2>
          </div>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Workout title (e.g. Push Day)" autoFocus />
          <input value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} className="input-field" placeholder="Type (Push, Pull, Legs...)" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">Day of week</label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="input-field">
                {DAY_NAMES.map((d, i) => <option key={d} value={i} className="bg-charcoal-800">{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">Time</label>
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="input-field" />
            </div>
          </div>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field" placeholder="Duration (min)" min={5} />
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-sage-500" />
            <span className="text-sm text-cream-dim">Active (appears on schedule)</span>
          </label>
          {error && <div className="rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-2 text-sm text-red-400/80">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            {recurrence && <button onClick={handleDelete} disabled={saving} className="rounded-lg border border-red-500/15 px-4 py-2.5 text-sm text-red-400/80 hover:bg-red-500/5 disabled:opacity-50"><Trash2 size={14} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}
