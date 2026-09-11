import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { scheduleNotification, cancelNotificationsForEntity, getTodayDate, getTomorrowDate, getUserTimezone } from '@/lib/notification-jobs';
import type { TimetableEvent, Homework, TestExam, Routine, Workout, ScheduleOverride, Holiday } from '@/lib/types';

const LEAD_TIME_MIN = 5;

function formatDateForQuery(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getTimezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export function useNotificationScheduler() {
  const { user } = useAuth();
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;

    async function generateJobs() {
      const now = Date.now();
      if (now - lastRunRef.current < 60_000) return;
      lastRunRef.current = now;

      const userId = user!.id;
      const today = new Date();
      const todayStr = getTodayDate();
      const tomorrowStr = getTomorrowDate();
      const dayOfWeek = today.getDay();

      const [eventsRes, homeworkRes, testsRes, routinesRes, workoutsRes, overridesRes, holidaysRes, prefsRes] = await Promise.all([
        supabase.from('timetable_events').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
        supabase.from('homework').select('*').in('status', ['todo', 'in_progress']),
        supabase.from('tests_exams').select('*').eq('status', 'upcoming'),
        supabase.from('routines').select('*').eq('is_active', true),
        supabase.from('workouts').select('*').eq('scheduled_date', todayStr).eq('status', 'planned'),
        supabase.from('schedule_overrides').select('*').gte('override_date', todayStr),
        supabase.from('holidays').select('*').gte('date', todayStr),
        supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      const events = (eventsRes.data as TimetableEvent[]) || [];
      const homework = (homeworkRes.data as Homework[]) || [];
      const tests = (testsRes.data as TestExam[]) || [];
      const routines = (routinesRes.data as Routine[]) || [];
      const workouts = (workoutsRes.data as Workout[]) || [];
      const overrides = (overridesRes.data as ScheduleOverride[]) || [];
      const holidays = (holidaysRes.data as Holiday[]) || [];
      const prefs = (prefsRes.data as Record<string, unknown>) || {};

      const todayHoliday = holidays.find((h) => h.date === todayStr);

      // Apply schedule overrides to today's events
      const todayOverrides = overrides.filter((o) => o.override_date === todayStr);
      const effectiveEvents = events.filter((e) => {
        if (todayHoliday && e.is_school_lesson) return false;
        const override = todayOverrides.find((o) => o.event_title === e.title && o.action_type === 'cancelled');
        return !override;
      }).map((e) => {
        const override = todayOverrides.find((o) => o.event_title === e.title && o.action_type === 'modified');
        if (override) {
          return {
            ...e,
            room: override.new_room || e.room,
            start_time: override.new_start_time || e.start_time,
            end_time: override.new_end_time || e.end_time,
            title: override.new_title || e.title,
          };
        }
        return e;
      });

      // Schedule event reminders
      if (prefs.events_enabled !== false) {
        for (const event of effectiveEvents) {
          const [eh, em] = event.start_time.split(':').map(Number);
          const eventDate = new Date(todayStr);
          eventDate.setDate(eventDate.getDate());
          eventDate.setHours(eh, em, 0, 0);
          const reminderTime = new Date(eventDate.getTime() - LEAD_TIME_MIN * 60 * 1000);

          if (reminderTime.getTime() > now) {
            await scheduleNotification({
              userId,
              type: 'upcoming',
              category: 'event',
              title: event.title,
              body: `${event.title} starts in ${LEAD_TIME_MIN} min.${event.room ? ` Room ${event.room}` : ''}`,
              relatedEntityType: 'timetable_event',
              relatedEntityId: event.id,
              scheduledFor: reminderTime,
              dedupKey: `event-${event.id}-${todayStr}`,
              deepLink: '/?view=schedule',
            });
          }
        }
      }

      // Schedule homework reminders
      if (prefs.homework_enabled !== false) {
        for (const hw of homework) {
          if (hw.scheduled_date && hw.scheduled_time) {
            const [hh, hm] = hw.scheduled_time.split(':').map(Number);
            const hwDate = new Date(hw.scheduled_date + 'T00:00:00');
            hwDate.setHours(hh, hm, 0, 0);
            const reminderTime = new Date(hwDate.getTime() - LEAD_TIME_MIN * 60 * 1000);

            if (reminderTime.getTime() > now) {
              await scheduleNotification({
                userId,
                type: 'upcoming',
                category: 'homework',
                title: hw.title,
                body: `${hw.title} starts in ${LEAD_TIME_MIN} min.`,
                relatedEntityType: 'homework',
                relatedEntityId: hw.id,
                scheduledFor: reminderTime,
                dedupKey: `hw-${hw.id}-${hw.scheduled_date}`,
                deepLink: '/?view=tasks',
              });
            }
          }

          // Due tomorrow reminder
          if (hw.due_date === tomorrowStr) {
            const eveningTime = new Date(todayStr + 'T20:00:00');
            if (eveningTime.getTime() > now) {
              await scheduleNotification({
                userId,
                type: 'important',
                category: 'homework',
                title: 'Homework due tomorrow',
                body: `${hw.title} is due tomorrow.`,
                relatedEntityType: 'homework',
                relatedEntityId: hw.id,
                scheduledFor: eveningTime,
                dedupKey: `hw-due-tomorrow-${hw.id}-${tomorrowStr}`,
                deepLink: '/?view=tasks',
              });
            }
          }
        }
      }

      // Schedule test/exam reminders
      if (prefs.tests_enabled !== false) {
        for (const test of tests) {
          if (test.exam_date === tomorrowStr) {
            const eveningTime = new Date(todayStr + 'T20:00:00');
            if (eveningTime.getTime() > now) {
              await scheduleNotification({
                userId,
                type: 'important',
                category: 'test',
                title: 'Test tomorrow',
                body: `${test.title} is tomorrow — ${test.revision_progress}% revised.`,
                relatedEntityType: 'test_exam',
                relatedEntityId: test.id,
                scheduledFor: eveningTime,
                dedupKey: `test-tomorrow-${test.id}-${tomorrowStr}`,
                deepLink: '/?view=tests',
              });
            }
          }
        }
      }

      // Schedule routine reminders
      if (prefs.routines_enabled !== false) {
        for (const routine of routines) {
          if (routine.applicable_days?.includes(dayOfWeek) && routine.start_time) {
            const [rh, rm] = routine.start_time.split(':').map(Number);
            const routineDate = new Date(todayStr);
            routineDate.setHours(rh, rm, 0, 0);
            const reminderTime = new Date(routineDate.getTime() - LEAD_TIME_MIN * 60 * 1000);

            if (reminderTime.getTime() > now) {
              await scheduleNotification({
                userId,
                type: 'upcoming',
                category: 'routine',
                title: routine.name,
                body: `${routine.name} starts in ${LEAD_TIME_MIN} min.`,
                relatedEntityType: 'routine',
                relatedEntityId: routine.id,
                scheduledFor: reminderTime,
                dedupKey: `routine-${routine.id}-${todayStr}`,
                deepLink: '/',
              });
            }
          }
        }
      }

      // Schedule workout reminders
      if (prefs.workout_enabled !== false) {
        for (const workout of workouts) {
          if (workout.scheduled_time) {
            const [wh, wm] = workout.scheduled_time.split(':').map(Number);
            const workoutDate = new Date(todayStr);
            workoutDate.setHours(wh, wm, 0, 0);
            const reminderTime = new Date(workoutDate.getTime() - LEAD_TIME_MIN * 60 * 1000);

            if (reminderTime.getTime() > now) {
              await scheduleNotification({
                userId,
                type: 'upcoming',
                category: 'workout',
                title: workout.title,
                body: `Workout: ${workout.title} starts in ${LEAD_TIME_MIN} min.`,
                relatedEntityType: 'workout',
                relatedEntityId: workout.id,
                scheduledFor: reminderTime,
                dedupKey: `workout-${workout.id}-${todayStr}`,
                deepLink: '/?view=workouts',
              });
            }
          }
        }
      }

      // Daily briefing
      if (prefs.daily_briefing_enabled !== false) {
        const briefingTime = (prefs.daily_briefing_time as string) || '07:00';
        const [bh, bm] = briefingTime.split(':').map(Number);
        const briefingDate = new Date(todayStr);
        briefingDate.setHours(bh, bm, 0, 0);

        if (briefingDate.getTime() > now) {
          const tomorrowEvents = events.length;
          const dueHw = homework.filter((h) => h.due_date === todayStr || h.due_date === tomorrowStr).length;
          const upcomingTests = tests.filter((t) => t.exam_date === tomorrowStr).length;

          const parts: string[] = [];
          if (tomorrowEvents > 0) parts.push(`${tomorrowEvents} events today`);
          if (dueHw > 0) parts.push(`${dueHw} homework due`);
          if (upcomingTests > 0) parts.push(`${upcomingTests} test tomorrow`);

          await scheduleNotification({
            userId,
            type: 'summary',
            category: 'briefing',
            title: 'Today at a glance',
            body: parts.length > 0 ? parts.join(' · ') : 'Your day looks clear. Enjoy it.',
            relatedEntityType: 'daily_briefing',
            relatedEntityId: '00000000-0000-0000-0000-000000000000',
            scheduledFor: briefingDate,
            dedupKey: `briefing-${todayStr}`,
            deepLink: '/',
          });
        }
      }

      // Bedtime preview
      if (prefs.bedtime_preview_enabled !== false) {
        const bedtime = (prefs.bedtime_preview_time as string) || '21:00';
        const [bth, btm] = bedtime.split(':').map(Number);
        const bedtimeDate = new Date(todayStr);
        bedtimeDate.setHours(bth, btm, 0, 0);

        if (bedtimeDate.getTime() > now) {
          await scheduleNotification({
            userId,
            type: 'summary',
            category: 'bedtime',
            title: 'Tomorrow preview',
            body: 'Tap to see what tomorrow looks like.',
            relatedEntityType: 'bedtime_preview',
            relatedEntityId: '00000000-0000-0000-0000-000000000001',
            scheduledFor: bedtimeDate,
            dedupKey: `bedtime-${todayStr}`,
            deepLink: '/',
          });
        }
      }

      // Store timezone in user settings for server-side reference
      const tz = getUserTimezone();
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (existingSettings) {
        await supabase.from('user_settings').update({ timezone: tz }).eq('user_id', userId);
      }
    }

    generateJobs();
    const interval = setInterval(generateJobs, 120_000);
    return () => clearInterval(interval);
  }, [user]);

  return {};
}

export { cancelNotificationsForEntity };
