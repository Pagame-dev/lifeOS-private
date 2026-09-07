import { supabase } from '@/lib/supabase';
import type {
  TimetableEvent, Homework, Task, TestExam, Routine,
  Workout, LogopedeSession, DailyLog, Goal, Project,
  UserSettings, AIPreference, Subject,
  AIMemory, ScheduleOverride, VoiceSettings,
} from '@/lib/types';

export function fmtTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function fmtTimeShort(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${displayHour}${suffix}` : `${displayHour}:${String(m).padStart(2, '0')}${suffix}`;
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtDateLong(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function fmtRelativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff === 2) return 'in 2 days';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff <= 6) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return fmtDate(dateStr);
}

export function fmtDuration(min: number): string {
  if (!min || min <= 0) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export interface LifeContext {
  now: Date;
  currentTime: string;
  currentMinutes: number;
  dayOfWeek: number;
  todayKey: string;
  weekType: 'A' | 'B';
  isHoliday: boolean;
  settings: UserSettings | null;
  preferences: AIPreference | null;
  subjects: Subject[];
  todayEvents: TimetableEvent[];
  currentEvent: TimetableEvent | null;
  nextEvent: TimetableEvent | null;
  remainingEvents: TimetableEvent[];
  homework: Homework[];
  overdueHomework: Homework[];
  dueTodayHomework: Homework[];
  dueTomorrowHomework: Homework[];
  tasks: Task[];
  overdueTasks: Task[];
  tests: TestExam[];
  todayRoutines: Routine[];
  todayWorkouts: Workout[];
  todayLogopede: LogopedeSession[];
  todayDailyLog: DailyLog | null;
  recentLogs: DailyLog[];
  goals: Goal[];
  projects: Project[];
  tomorrowEvents: TimetableEvent[];
  tomorrowHomework: Homework[];
  tomorrowWorkouts: Workout[];
  tomorrowLogopede: LogopedeSession[];
  tomorrowRoutines: Routine[];
  memories: AIMemory[];
  explicitPreferences: AIMemory[];
  learnedPatterns: AIMemory[];
  temporaryContext: AIMemory[];
  scheduleOverrides: ScheduleOverride[];
  todayOverrides: ScheduleOverride[];
  voiceSettings: VoiceSettings | null;
}

export async function buildContext(): Promise<LifeContext> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5);
  const currentMinutes = timeToMinutes(currentTime);
  const tKey = now.toISOString().split('T')[0];
  const tomorrowKey = addDays(tKey, 1);
  const tomorrowDow = new Date(tomorrowKey + 'T00:00:00').getDay();

  const weekType: 'A' | 'B' = (() => {
    const epoch = new Date('2026-01-05T00:00:00');
    const ws = new Date(tKey + 'T00:00:00');
    ws.setDate(ws.getDate() - (ws.getDay() === 0 ? 6 : ws.getDay() - 1));
    const es = new Date(epoch);
    es.setDate(es.getDate() - (es.getDay() === 0 ? 6 : es.getDay() - 1));
    const diff = Math.round((ws.getTime() - es.getTime()) / (7 * 86400000));
    return diff % 2 === 0 ? 'A' : 'B';
  })();

  const sevenDaysAgo = addDays(tKey, -7);
  const twoWeeksAhead = addDays(tKey, 14);

  const [
    settingsRes, prefsRes, subjectsRes, holidaysRes,
    eventsRes, hwRes, tasksRes, testsRes, routinesRes,
    workoutsRes, logopedeRes, todayLogRes, recentLogsRes,
    goalsRes, projectsRes,
    tmrwEventsRes, tmrwWorkoutsRes, tmrwLogopedeRes,
    memoriesRes, overridesRes, voiceSettingsRes,
  ] = await Promise.all([
    supabase.from('user_settings').select('*').maybeSingle(),
    supabase.from('ai_preferences').select('*').maybeSingle(),
    supabase.from('subjects').select('*'),
    supabase.from('holidays').select('*').gte('date', tKey).lte('date', twoWeeksAhead),
    supabase.from('timetable_events').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
    supabase.from('homework').select('*').in('status', ['todo', 'in_progress']).order('due_date'),
    supabase.from('tasks').select('*').in('status', ['todo', 'in_progress']).order('priority', { ascending: false }),
    supabase.from('tests_exams').select('*').eq('status', 'upcoming').order('exam_date'),
    supabase.from('routines').select('*').eq('is_active', true),
    supabase.from('workouts').select('*').eq('scheduled_date', tKey),
    supabase.from('logopede_sessions').select('*').eq('session_date', tKey),
    supabase.from('daily_logs').select('*').eq('log_date', tKey).maybeSingle(),
    supabase.from('daily_logs').select('*').gte('log_date', sevenDaysAgo).order('log_date', { ascending: false }).limit(7),
    supabase.from('goals').select('*').eq('status', 'active').order('updated_at', { ascending: false }).limit(10),
    supabase.from('projects').select('*').eq('status', 'active').limit(10),
    supabase.from('timetable_events').select('*').eq('day_of_week', tomorrowDow).order('start_time'),
    supabase.from('workouts').select('*').eq('scheduled_date', tomorrowKey),
    supabase.from('logopede_sessions').select('*').eq('session_date', tomorrowKey),
    supabase.from('ai_memories').select('*').order('updated_at', { ascending: false }),
    supabase.from('schedule_overrides').select('*').gte('override_date', tKey).lte('override_date', twoWeeksAhead),
    supabase.from('voice_settings').select('*').maybeSingle(),
  ]);

  const subjects = (subjectsRes.data as Subject[]) || [];
  const holidays = (holidaysRes.data as { date: string }[]) || [];
  const isHoliday = holidays.some((h) => h.date === tKey);

  let events = (eventsRes.data as TimetableEvent[]) || [];
  events = events.filter((e) => {
    if (e.is_school_lesson && isHoliday) return false;
    if (!e.is_school_lesson || !e.week_type) return true;
    return e.week_type === weekType;
  });

  const currentEvent = events.find((e) => currentTime >= e.start_time && currentTime < e.end_time) || null;
  const nextEvent = events.find((e) => e.start_time > currentTime) || null;
  const remainingEvents = events.filter((e) => e.end_time > currentTime);

  const homework = (hwRes.data as Homework[]) || [];
  const tasks = (tasksRes.data as Task[]) || [];
  const tests = (testsRes.data as TestExam[]) || [];
  const routines = (routinesRes.data as Routine[]) || [];
  const todayWorkouts = (workoutsRes.data as Workout[]) || [];
  const todayLogopede = (logopedeRes.data as LogopedeSession[]) || [];
  const todayDailyLog = (todayLogRes.data as DailyLog) || null;
  const recentLogs = (recentLogsRes.data as DailyLog[]) || [];
  const goals = (goalsRes.data as Goal[]) || [];
  const projects = (projectsRes.data as Project[]) || [];

  const tomorrowEvents = ((tmrwEventsRes.data as TimetableEvent[]) || []).filter((e) => {
    if (e.is_school_lesson && holidays.some((h) => h.date === tomorrowKey)) return false;
    if (!e.is_school_lesson || !e.week_type) return true;
    const tmrwWeekType = weekType === 'A' ? 'B' : 'A';
    return e.week_type === tmrwWeekType;
  });
  const tomorrowWorkouts = (tmrwWorkoutsRes.data as Workout[]) || [];
  const tomorrowLogopede = (tmrwLogopedeRes.data as LogopedeSession[]) || [];
  const tomorrowRoutines = routines.filter((r) => r.applicable_days?.includes(tomorrowDow));

  const allMemories = (memoriesRes.data as AIMemory[]) || [];
  const activeMemories = allMemories.filter((m) => {
    if (m.expires_at && new Date(m.expires_at) < now) return false;
    return true;
  });
  const explicitPreferences = activeMemories.filter((m) => m.memory_type === 'explicit_preference');
  const learnedPatterns = activeMemories.filter((m) => m.memory_type === 'learned_pattern');
  const temporaryContext = activeMemories.filter((m) => m.memory_type === 'temporary_context');

  const allOverrides = (overridesRes.data as ScheduleOverride[]) || [];
  const todayOverrides = allOverrides.filter((o) => o.override_date === tKey);

  const voiceSettings = (voiceSettingsRes.data as VoiceSettings) || null;

  return {
    now, currentTime, currentMinutes, dayOfWeek, todayKey: tKey, weekType, isHoliday,
    settings: (settingsRes.data as UserSettings) || null,
    preferences: (prefsRes.data as AIPreference) || null,
    subjects,
    todayEvents: events, currentEvent, nextEvent, remainingEvents,
    homework,
    overdueHomework: homework.filter((h) => daysUntil(h.due_date) < 0),
    dueTodayHomework: homework.filter((h) => daysUntil(h.due_date) === 0),
    dueTomorrowHomework: homework.filter((h) => daysUntil(h.due_date) === 1),
    tasks,
    overdueTasks: tasks.filter((t) => t.due_date && daysUntil(t.due_date) < 0),
    tests,
    todayRoutines: routines.filter((r) => r.applicable_days?.includes(dayOfWeek)),
    todayWorkouts, todayLogopede, todayDailyLog, recentLogs, goals, projects,
    tomorrowEvents,
    tomorrowHomework: homework.filter((h) => daysUntil(h.due_date) === 1),
    tomorrowWorkouts, tomorrowLogopede, tomorrowRoutines,
    memories: activeMemories,
    explicitPreferences,
    learnedPatterns,
    temporaryContext,
    scheduleOverrides: allOverrides,
    todayOverrides,
    voiceSettings,
  };
}
