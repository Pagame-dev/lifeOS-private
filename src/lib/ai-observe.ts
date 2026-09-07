import { supabase } from '@/lib/supabase';
import { todayKey, addDays } from './ai-context';

interface Observation {
  patternKey: string;
  patternValue: string;
  memoryType: 'learned_pattern' | 'temporary_context';
  confidenceDelta?: number;
  isTemporary?: boolean;
  expiresAt?: string | null;
}

async function recordObservation(obs: Observation): Promise<void> {
  const { data: existing } = await supabase
    .from('ai_memories')
    .select('id, observation_count, confidence_score')
    .eq('pattern_key', obs.patternKey)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; observation_count: number; confidence_score: number };
    const newCount = row.observation_count + 1;
    const newConfidence = Math.min(1.0, row.confidence_score + (obs.confidenceDelta ?? 0.15));
    await supabase
      .from('ai_memories')
      .update({
        observation_count: newCount,
        confidence_score: newConfidence,
        last_observed: new Date().toISOString(),
        pattern_value: obs.patternValue,
      })
      .eq('id', row.id);
    return;
  }

  await supabase.from('ai_memories').insert({
    memory_type: obs.memoryType,
    pattern_key: obs.patternKey,
    pattern_value: obs.patternValue,
    confidence_score: 0.2,
    observation_count: 1,
    is_temporary: obs.isTemporary ?? false,
    expires_at: obs.expiresAt ?? null,
  });
}

export async function observeTaskCompletion(taskId: string, wasOnTime: boolean): Promise<void> {
  const { data } = await supabase
    .from('tasks')
    .select('title, due_date, priority, created_at')
    .eq('id', taskId)
    .maybeSingle();
  if (!data) return;
  const task = data as { title: string; due_date: string | null; priority: number };

  if (task.due_date) {
    const due = new Date(task.due_date);
    const today = new Date(todayKey());
    const early = due.getTime() - today.getTime() > 86400000;
    if (early && wasOnTime) {
      await recordObservation({
        patternKey: 'completes_early',
        patternValue: 'Tends to complete tasks before the deadline',
        memoryType: 'learned_pattern',
        confidenceDelta: 0.1,
      });
    }
    if (!wasOnTime) {
      await recordObservation({
        patternKey: 'completes_late',
        patternValue: 'Sometimes completes tasks after the deadline',
        memoryType: 'learned_pattern',
        confidenceDelta: 0.1,
      });
    }
  }
}

export async function observeWorkoutDecision(workoutId: string, action: 'completed' | 'skipped'): Promise<void> {
  const { data } = await supabase
    .from('workouts')
    .select('scheduled_date, title')
    .eq('id', workoutId)
    .maybeSingle();
  if (!data) return;
  const workout = data as { scheduled_date: string; title: string };
  const dow = new Date(workout.scheduled_date + 'T00:00:00').getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dow];

  if (action === 'skipped') {
    await recordObservation({
      patternKey: `skips_workout_${dayName.toLowerCase()}`,
      patternValue: `Tends to skip workouts on ${dayName}s`,
      memoryType: 'learned_pattern',
      confidenceDelta: 0.2,
    });
  } else {
    await recordObservation({
      patternKey: `completes_workout_${dayName.toLowerCase()}`,
      patternValue: `Consistently completes workouts on ${dayName}s`,
      memoryType: 'learned_pattern',
      confidenceDelta: 0.15,
    });
  }
}

export async function observeHomeworkSplit(originalHomeworkId: string): Promise<void> {
  const { data: original } = await supabase
    .from('homework')
    .select('title, estimated_time_min')
    .eq('id', originalHomeworkId)
    .maybeSingle();
  if (!original) return;
  const hw = original as { title: string; estimated_time_min: number | null };
  if ((hw.estimated_time_min ?? 0) > 90) {
    await recordObservation({
      patternKey: 'splits_long_homework',
      patternValue: 'Often splits homework longer than 90 minutes into shorter sessions',
      memoryType: 'learned_pattern',
      confidenceDelta: 0.2,
    });
  }
}

export async function observeTaskReschedule(taskId: string, oldDue: string, newDue: string): Promise<void> {
  const diff = new Date(newDue).getTime() - new Date(oldDue).getTime();
  if (diff > 86400000) {
    await recordObservation({
      patternKey: 'postpones_tasks',
      patternValue: 'Sometimes postpones tasks to later dates',
      memoryType: 'learned_pattern',
      confidenceDelta: 0.1,
    });
  }
}

export async function observeAIRecommendationOutcome(accepted: boolean, context: string): Promise<void> {
  if (accepted) {
    await recordObservation({
      patternKey: `accepts_${context}`,
      patternValue: `Tends to accept AI recommendations for ${context}`,
      memoryType: 'learned_pattern',
      confidenceDelta: 0.1,
    });
  } else {
    await recordObservation({
      patternKey: `rejects_${context}`,
      patternValue: `Sometimes declines AI recommendations for ${context}`,
      memoryType: 'learned_pattern',
      confidenceDelta: 0.1,
    });
  }
}

export async function setTemporaryContext(patternKey: string, patternValue: string, expiresAt: string | null): Promise<void> {
  await recordObservation({
    patternKey,
    patternValue,
    memoryType: 'temporary_context',
    isTemporary: true,
    expiresAt,
  });
}

export async function clearTemporaryContext(patternKey: string): Promise<void> {
  await supabase
    .from('ai_memories')
    .delete()
    .eq('pattern_key', patternKey)
    .eq('memory_type', 'temporary_context');
}
