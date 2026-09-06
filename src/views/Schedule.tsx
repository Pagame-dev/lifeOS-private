import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Holiday, Subject, TimetableEvent, Workout, LogopedeSession } from '@/lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 16 }, (_, index) => index + 7);
const HOUR_HEIGHT = 56;

function formatTime(time: string): string {
  const [hourText, minute] = time.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${suffix}`;
}

type EventSlot = { kind: 'event'; data: TimetableEvent; start_time: string; end_time: string };
type WorkoutSlot = { kind: 'workout'; data: Workout; start_time: string; end_time: string };
type LogopedeSlot = { kind: 'logopede'; data: LogopedeSession; start_time: string; end_time: string };

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
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
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

export function Schedule() {
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [logopedeSessions, setLogopedeSessions] = useState<LogopedeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editingEvent, setEditingEvent] = useState<TimetableEvent | null>(null);
  const [creatingForDay, setCreatingForDay] = useState<number | null>(null);
  const [creatingAt, setCreatingAt] = useState('09:00');

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const displayedHolidayKeys = useMemo(() => new Set(holidays.map((holiday) => holiday.date)), [holidays]);

  const weekType = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date());
    const diff = Math.round((weekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const baseWeek = 'A';
    return diff % 2 === 0 ? baseWeek : (baseWeek === 'A' ? 'B' : 'A');
  }, [weekStart]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadEvents() {
    const weekStartKey = dateKey(weekDates[0]);
    const weekEndKey = dateKey(weekDates[6]);
    const [eventsRes, subjectsRes, holidaysRes, workoutsRes, logopedeRes] = await Promise.all([
      supabase.from('timetable_events').select('*'),
      supabase.from('subjects').select('*'),
      supabase.from('holidays').select('*').gte('date', weekStartKey).lte('date', weekEndKey),
      supabase.from('workouts').select('*').gte('scheduled_date', weekStartKey).lte('scheduled_date', weekEndKey),
      supabase.from('logopede_sessions').select('*').gte('session_date', weekStartKey).lte('session_date', weekEndKey),
    ]);

    setEvents((eventsRes.data as TimetableEvent[]) || []);
    setSubjects((subjectsRes.data as Subject[]) || []);
    setHolidays((holidaysRes.data as Holiday[]) || []);
    setWorkouts((workoutsRes.data as Workout[]) || []);
    setLogopedeSessions((logopedeRes.data as LogopedeSession[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
  }, [weekStart]);

  function getEventsForDay(day: number, date: Date): Array<EventSlot | WorkoutSlot | LogopedeSlot> {
    const isHoliday = displayedHolidayKeys.has(dateKey(date));
    const dateKeyStr = dateKey(date);
    const dayEvents: Array<EventSlot | WorkoutSlot | LogopedeSlot> = events
      .filter((event) => {
        if (event.day_of_week !== day) return false;
        if (event.is_school_lesson && isHoliday) return false;
        if (!event.is_school_lesson || !event.week_type) return true;
        return event.week_type === weekType;
      })
      .map((e) => ({ kind: 'event' as const, data: e, start_time: e.start_time, end_time: e.end_time }));

    const dayWorkouts = workouts
      .filter((w) => w.scheduled_date === dateKeyStr)
      .map((w) => ({
        kind: 'workout' as const,
        data: w,
        start_time: w.scheduled_time || '17:00',
        end_time: w.scheduled_time
          ? `${String(Math.min(23, parseInt(w.scheduled_time.slice(0, 2)) + Math.ceil((w.duration_min || 60) / 60))).padStart(2, '0')}:${w.scheduled_time.slice(3, 5)}`
          : '18:00',
      }));

    const dayLogopede = logopedeSessions
      .filter((s) => s.session_date === dateKeyStr)
      .map((s) => ({
        kind: 'logopede' as const,
        data: s,
        start_time: s.session_type === 'morning' ? '07:30' : '19:00',
        end_time: s.session_type === 'morning' ? '07:45' : '19:15',
      }));

    return [...dayEvents, ...dayWorkouts, ...dayLogopede].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
  }

  function getSubjectColor(subjectId: string | null): string {
    if (!subjectId) return '#8b9a6b';
    return subjects.find((subject) => subject.id === subjectId)?.color || '#8b9a6b';
  }

  function openCreate(day: number, hour: number, minute = 0) {
    setCreatingForDay(day);
    setCreatingAt(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
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
        <div className="h-[720px] glass-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl text-cream">Schedule</h1>
            {isCurrentWeek && (
              <span className="rounded-full border border-sage-500/20 bg-sage-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-sage-300">
                This week
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-cream-dim">{formatWeekRange(weekDates)}</p>
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

      <div className="flex items-center gap-2 text-xs text-cream-dim">
        <span className="h-2 w-2 rounded-full bg-sage-400" />
        <span>Week {weekType} · School lessons follow the alternating A/B schedule automatically.</span>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-white/[0.05]">
              <div className="p-3" />
              {weekDates.map((date, index) => {
                const isToday = dateKey(date) === dateKey(now);
                const holiday = displayedHolidayKeys.has(dateKey(date));
                return (
                  <div
                    key={dateKey(date)}
                    className={`border-l border-white/[0.04] px-2 py-3 text-center ${isToday ? 'bg-sage-500/5' : ''}`}
                  >
                    <p className={`text-sm font-medium ${isToday ? 'text-sage-200' : 'text-cream'}`}>
                      {DAYS[index]}
                    </p>
                    <p className="mt-0.5 text-xs text-cream-dim">{date.getDate()}</p>
                    {holiday && (
                      <span className="mt-1 inline-block rounded bg-accent-warm/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-accent-warm">
                        Holiday
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-white/[0.03]"
                style={{ minHeight: `${HOUR_HEIGHT}px` }}
              >
                <div className="p-2 text-right text-xs font-mono text-cream-dim">
                  {formatTime(`${hour}:00`)}
                </div>
                {weekDates.map((date, index) => {
                  const dayIndex = DAY_INDICES[index];
                  const dayEvents = getEventsForDay(dayIndex, date).filter(
                    (event) => Math.floor(minutesFromTime(event.start_time) / 60) === hour,
                  );
                  const isToday = dateKey(date) === dateKey(now);
                  const holiday = displayedHolidayKeys.has(dateKey(date));
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();
                  const showNowLine = isToday && currentMinutes >= hour * 60 && currentMinutes < (hour + 1) * 60;
                  const nowOffset = ((currentMinutes - hour * 60) / 60) * HOUR_HEIGHT;

                  return (
                    <div
                      key={`${dateKey(date)}-${hour}`}
                      className={`relative border-l border-white/[0.04] p-1 ${isToday ? 'bg-sage-500/[0.018]' : ''}`}
                      onDoubleClick={() => openCreate(dayIndex, hour)}
                    >
                      {holiday && (
                        <div className="pointer-events-none absolute inset-0 bg-accent-warm/[0.025]" />
                      )}
                      {showNowLine && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                          style={{ top: `${nowOffset}px` }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-sage-300 shadow-[0_0_8px_rgba(192,208,160,0.8)]" />
                          <span className="h-px flex-1 bg-sage-300/70" />
                        </div>
                      )}
                      {dayEvents.map((slot) => {
                        if (slot.kind === 'event') {
                          const event = slot.data;
                          const duration = Math.max(30, minutesFromTime(slot.end_time) - minutesFromTime(slot.start_time));
                          const color = getSubjectColor(event.subject_id);
                          return (
                            <button
                              key={event.id}
                              onClick={() => setEditingEvent(event)}
                              className="fluorescent-card relative z-10 mb-1 w-full px-2 py-1.5 text-left"
                              style={{
                                borderLeftColor: `${color}80`,
                                minHeight: `${Math.max(42, (duration / 60) * HOUR_HEIGHT - 6)}px`,
                              }}
                            >
                              <p className="truncate text-xs font-medium text-cream">{event.title}</p>
                              <p className="text-[10px] font-mono text-cream-dim">
                                {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                              </p>
                              {event.room && <p className="truncate text-[10px] text-cream-dim">{event.room}</p>}
                            </button>
                          );
                        }
                        if (slot.kind === 'workout') {
                          const workout = slot.data;
                          const duration = Math.max(30, minutesFromTime(slot.end_time) - minutesFromTime(slot.start_time));
                          return (
                            <div
                              key={`workout-${workout.id}`}
                              className="relative z-10 mb-1 w-full rounded-md border-l-2 border-accent-warm/60 bg-accent-warm/10 px-2 py-1.5"
                              style={{ minHeight: `${Math.max(42, (duration / 60) * HOUR_HEIGHT - 6)}px` }}
                            >
                              <p className="truncate text-xs font-medium text-accent-warm">{workout.title}</p>
                              <p className="text-[10px] font-mono text-cream-dim/70">
                                {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                              </p>
                              {workout.workout_type && <p className="truncate text-[10px] text-cream-dim/60">{workout.workout_type}</p>}
                            </div>
                          );
                        }
                        const session = slot.data;
                        const isCompleted = session.status === 'completed';
                        return (
                          <div
                            key={`logopede-${session.id}`}
                            className={`relative z-10 mb-1 w-full rounded-md border-l-2 px-2 py-1.5 ${isCompleted ? 'border-sage-500/40 bg-sage-500/5 opacity-60' : 'border-accent-cool/50 bg-accent-cool/10'}`}
                          >
                            <p className="truncate text-xs font-medium text-accent-cool capitalize">Logopède {session.session_type}</p>
                            <p className="text-[10px] font-mono text-cream-dim/70">
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </p>
                          </div>
                        );
                      })}
                      {dayEvents.length === 0 && hour === 9 && (
                        <button
                          onClick={() => openCreate(dayIndex, hour)}
                          className="group relative z-10 flex h-8 w-full items-center justify-center rounded-md text-cream-dim/30 transition-colors hover:bg-white/[0.03] hover:text-sage-300"
                          aria-label={`Add event on ${DAY_NAMES[dayIndex]}`}
                        >
                          <Plus size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-cream-dim/60">
        Double-click an empty time slot to create an event. Click any event to edit it.
      </p>

      {(editingEvent || creatingForDay !== null) && (
        <EventEditModal
          event={editingEvent}
          day={creatingForDay}
          initialTime={creatingAt}
          subjects={subjects}
          onClose={() => {
            setEditingEvent(null);
            setCreatingForDay(null);
          }}
          onSaved={() => {
            loadEvents();
            setEditingEvent(null);
            setCreatingForDay(null);
          }}
        />
      )}
    </div>
  );
}

interface EventEditModalProps {
  event: TimetableEvent | null;
  day: number | null;
  initialTime: string;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
}

function EventEditModal({ event, day, initialTime, subjects, onClose, onSaved }: EventEditModalProps) {
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
    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setError(null);

    const data = {
      title: title.trim(),
      start_time: startTime,
      end_time: endTime,
      day_of_week: dayOfWeek,
      week_type: weekType || null,
      is_school_lesson: isSchoolLesson,
      room: room.trim(),
      teacher: teacher.trim(),
      subject_id: subjectId || null,
    };

    try {
      const result = event
        ? await supabase.from('timetable_events').update(data).eq('id', event.id)
        : await supabase.from('timetable_events').insert(data);
      if (result.error) throw result.error;
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save this event.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from('timetable_events').delete().eq('id', event.id);
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/70 px-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card max-h-[90vh] w-full max-w-md overflow-y-auto p-5 animate-slide-up" onClick={(eventClick) => eventClick.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl text-cream">{event ? 'Edit Event' : 'New Event'}</h2>
            {!event && <p className="mt-1 text-xs text-cream-dim">Add a personal event or school lesson.</p>}
          </div>
          <button onClick={onClose} className="text-cream-dim transition-colors hover:text-cream" aria-label="Close event form">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-cream-dim">Title</label>
            <input value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} className="input-field" placeholder="Event title" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">Start</label>
              <input type="time" value={startTime} onChange={(inputEvent) => setStartTime(inputEvent.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">End</label>
              <input type="time" value={endTime} onChange={(inputEvent) => setEndTime(inputEvent.target.value)} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">Day</label>
              <select value={dayOfWeek} onChange={(inputEvent) => setDayOfWeek(Number(inputEvent.target.value))} className="input-field">
                {DAY_NAMES.map((dayName, index) => <option key={dayName} value={index} className="bg-charcoal-800">{dayName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">Week Type</label>
              <select value={weekType} onChange={(inputEvent) => setWeekType(inputEvent.target.value)} className="input-field">
                <option value="" className="bg-charcoal-800">Both weeks</option>
                <option value="A" className="bg-charcoal-800">Week A</option>
                <option value="B" className="bg-charcoal-800">Week B</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-cream-dim">Subject</label>
            <select value={subjectId} onChange={(inputEvent) => setSubjectId(inputEvent.target.value)} className="input-field">
              <option value="" className="bg-charcoal-800">None</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id} className="bg-charcoal-800">{subject.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">Room</label>
              <input value={room} onChange={(inputEvent) => setRoom(inputEvent.target.value)} className="input-field" placeholder="Room" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-cream-dim">Teacher</label>
              <input value={teacher} onChange={(inputEvent) => setTeacher(inputEvent.target.value)} className="input-field" placeholder="Teacher" />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isSchoolLesson} onChange={(inputEvent) => setIsSchoolLesson(inputEvent.target.checked)} className="accent-sage-500" />
            <span className="text-sm text-cream-dim">School lesson (affected by Week A/B and holidays)</span>
          </label>

          {error && <div className="rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-2 text-sm text-red-400/80">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={!title.trim() || saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            {event && <button onClick={handleDelete} disabled={saving} className="rounded-lg border border-red-500/15 px-4 py-2.5 text-sm text-red-400/80 transition-colors hover:bg-red-500/5 disabled:opacity-50">Delete</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
