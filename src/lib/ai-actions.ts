import { supabase } from '@/lib/supabase';
import { todayKey, addDays, timeToMinutes, fmtTime, fmtRelativeDate } from './ai-context';
import { observeTaskCompletion, observeWorkoutDecision, observeTaskReschedule } from './ai-observe';
import type { Homework, Task, Workout } from '@/lib/types';

export interface ActionResult {
  success: boolean;
  message: string;
  action?: string;
  entityId?: string;
}

export interface AIAction {
  type: string;
  label: string;
  entityId?: string;
  entityType?: string;
  data?: Record<string, unknown>;
}

export async function executeAction(action: AIAction): Promise<ActionResult> {
  switch (action.type) {
    case 'complete_task':
      return completeTask(action.entityId!);
    case 'complete_homework':
      return completeHomework(action.entityId!);
    case 'complete_workout':
      return completeWorkout(action.entityId!);
    case 'skip_workout':
      return skipWorkout(action.entityId!, action.data?.reason as string);
    case 'move_homework':
      return moveHomework(action.entityId!, action.data?.dueDate as string);
    case 'move_task':
      return moveTask(action.entityId!, action.data?.dueDate as string);
    case 'create_task':
      return createTask(
        action.data?.title as string,
        action.data?.dueDate as string | undefined,
        action.data?.priority as number | undefined,
      );
    case 'create_homework':
      return createHomework(
        action.data?.title as string,
        action.data?.dueDate as string,
        action.data?.subjectId as string | undefined,
      );
    case 'create_workout':
      return createWorkout(
        action.data?.title as string,
        action.data?.date as string,
        action.data?.time as string | undefined,
        action.data?.duration as number | undefined,
      );
    case 'delete_task':
      return deleteTask(action.entityId!);
    case 'delete_homework':
      return deleteHomework(action.entityId!);
    case 'schedule_revision':
      return createTask(
        `Revision: ${action.data?.title as string}`,
        action.data?.dueDate as string,
        4,
      );
    case 'create_override':
      return createOverride(
        action.data?.overrideDate as string,
        action.data?.eventTitle as string,
        action.data?.actionType as string,
        action.data?.newRoom as string | undefined,
        action.data?.newStartTime as string | undefined,
        action.data?.newEndTime as string | undefined,
        action.data?.newTitle as string | undefined,
        action.data?.reason as string | undefined,
      );
    case 'delete_override':
      return deleteOverride(action.entityId!);
    case 'save_memory':
      return saveMemory(
        action.data?.memoryType as string,
        action.data?.patternKey as string,
        action.data?.patternValue as string,
        action.data?.confidenceScore as number | undefined,
        action.data?.isTemporary as boolean | undefined,
        action.data?.expiresAt as string | undefined,
      );
    case 'delete_memory':
      return deleteMemory(action.entityId!);
    default:
      return { success: false, message: 'Unknown action' };
  }
}

async function completeTask(id: string): Promise<ActionResult> {
  const { data: taskData } = await supabase
    .from('tasks')
    .select('due_date')
    .eq('id', id)
    .maybeSingle();
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  const taskRow = taskData as { due_date: string | null } | null;
  const wasOnTime = !taskRow?.due_date || new Date(taskRow.due_date) >= new Date();
  observeTaskCompletion(id, wasOnTime);
  return { success: true, message: 'Task marked complete', action: 'complete_task', entityId: id };
}

async function completeHomework(id: string): Promise<ActionResult> {
  const { error } = await supabase
    .from('homework')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Homework marked complete', action: 'complete_homework', entityId: id };
}

async function completeWorkout(id: string): Promise<ActionResult> {
  const { error } = await supabase
    .from('workouts')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  observeWorkoutDecision(id, 'completed');
  return { success: true, message: 'Workout marked complete', action: 'complete_workout', entityId: id };
}

async function skipWorkout(id: string, reason?: string): Promise<ActionResult> {
  const { error } = await supabase
    .from('workouts')
    .update({ status: 'skipped', skip_reason: reason || 'Skipped via AI assistant' })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  observeWorkoutDecision(id, 'skipped');
  return { success: true, message: 'Workout skipped', action: 'skip_workout', entityId: id };
}

async function moveHomework(id: string, newDueDate: string): Promise<ActionResult> {
  if (!newDueDate) return { success: false, message: 'No date provided' };
  const { error } = await supabase
    .from('homework')
    .update({ due_date: newDueDate })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Homework moved to ${fmtRelativeDate(newDueDate)}`, action: 'move_homework', entityId: id };
}

async function moveTask(id: string, newDueDate: string): Promise<ActionResult> {
  if (!newDueDate) return { success: false, message: 'No date provided' };
  const { data: oldData } = await supabase
    .from('tasks')
    .select('due_date')
    .eq('id', id)
    .maybeSingle();
  const { error } = await supabase
    .from('tasks')
    .update({ due_date: newDueDate })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
  const oldDue = (oldData as { due_date: string | null })?.due_date;
  if (oldDue) observeTaskReschedule(id, oldDue, newDueDate);
  return { success: true, message: `Task moved to ${fmtRelativeDate(newDueDate)}`, action: 'move_task', entityId: id };
}

async function createTask(title: string, dueDate?: string, priority?: number): Promise<ActionResult> {
  if (!title?.trim()) return { success: false, message: 'No title provided' };
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: title.trim(),
      due_date: dueDate || null,
      priority: priority || 3,
      status: 'todo',
    })
    .select('*')
    .single();
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Task "${title.trim()}" created${dueDate ? ` for ${fmtRelativeDate(dueDate)}` : ''}`, action: 'create_task', entityId: (data as Task)?.id };
}

async function createHomework(title: string, dueDate: string, subjectId?: string): Promise<ActionResult> {
  if (!title?.trim() || !dueDate) return { success: false, message: 'Missing title or date' };
  const { data, error } = await supabase
    .from('homework')
    .insert({
      title: title.trim(),
      due_date: dueDate,
      subject_id: subjectId || null,
      status: 'todo',
      estimated_time_min: 30,
      priority: 3,
    })
    .select('*')
    .single();
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Homework "${title.trim()}" added for ${fmtRelativeDate(dueDate)}`, action: 'create_homework', entityId: (data as Homework)?.id };
}

async function createWorkout(title: string, date: string, time?: string, duration?: number): Promise<ActionResult> {
  if (!title?.trim() || !date) return { success: false, message: 'Missing title or date' };
  const { data, error } = await supabase
    .from('workouts')
    .insert({
      title: title.trim(),
      scheduled_date: date,
      scheduled_time: time || null,
      duration_min: duration || 60,
      status: 'planned',
      skip_reason: '',
      jefit_link: '',
    })
    .select('*')
    .single();
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Workout "${title.trim()}" scheduled for ${fmtRelativeDate(date)}${time ? ` at ${fmtTime(time)}` : ''}`, action: 'create_workout', entityId: (data as Workout)?.id };
}

async function deleteTask(id: string): Promise<ActionResult> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Task deleted', action: 'delete_task', entityId: id };
}

async function deleteHomework(id: string): Promise<ActionResult> {
  const { error } = await supabase.from('homework').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Homework deleted', action: 'delete_homework', entityId: id };
}

export function needsConfirmation(actionType: string): boolean {
  return ['delete_task', 'delete_homework', 'delete_override', 'delete_memory'].includes(actionType);
}

async function createOverride(
  overrideDate: string,
  eventTitle: string,
  actionType: string,
  newRoom?: string,
  newStartTime?: string,
  newEndTime?: string,
  newTitle?: string,
  reason?: string,
): Promise<ActionResult> {
  if (!overrideDate || !eventTitle || !actionType) {
    return { success: false, message: 'Missing override details' };
  }
  const { data, error } = await supabase
    .from('schedule_overrides')
    .insert({
      override_date: overrideDate,
      event_title: eventTitle,
      action_type: actionType,
      new_room: newRoom || null,
      new_start_time: newStartTime || null,
      new_end_time: newEndTime || null,
      new_title: newTitle || null,
      reason: reason || null,
    })
    .select('*')
    .single();
  if (error) return { success: false, message: error.message };
  const id = (data as { id: string })?.id;
  const label = actionType === 'cancelled'
    ? `${eventTitle} cancelled on ${fmtRelativeDate(overrideDate)}`
    : actionType === 'replaced'
    ? `${eventTitle} replaced on ${fmtRelativeDate(overrideDate)}`
    : `${eventTitle} modified on ${fmtRelativeDate(overrideDate)}`;
  return { success: true, message: label, action: 'create_override', entityId: id };
}

async function deleteOverride(id: string): Promise<ActionResult> {
  const { error } = await supabase.from('schedule_overrides').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Override removed — recurring schedule restored', action: 'delete_override', entityId: id };
}

async function saveMemory(
  memoryType: string,
  patternKey: string,
  patternValue: string,
  confidenceScore?: number,
  isTemporary?: boolean,
  expiresAt?: string,
): Promise<ActionResult> {
  if (!memoryType || !patternKey || !patternValue) {
    return { success: false, message: 'Missing memory details' };
  }
  const existing = await supabase
    .from('ai_memories')
    .select('id, observation_count, confidence_score')
    .eq('pattern_key', patternKey)
    .maybeSingle();

  if (existing.data) {
    const row = existing.data as { id: string; observation_count: number; confidence_score: number };
    const newCount = row.observation_count + 1;
    const newConfidence = Math.min(1.0, row.confidence_score + 0.15);
    const { error } = await supabase
      .from('ai_memories')
      .update({
        observation_count: newCount,
        confidence_score: confidenceScore ?? newConfidence,
        last_observed: new Date().toISOString(),
        pattern_value: patternValue,
      })
      .eq('id', row.id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Memory updated', action: 'save_memory', entityId: row.id };
  }

  const { data, error } = await supabase
    .from('ai_memories')
    .insert({
      memory_type: memoryType,
      pattern_key: patternKey,
      pattern_value: patternValue,
      confidence_score: confidenceScore ?? 0.2,
      observation_count: 1,
      is_temporary: isTemporary ?? false,
      expires_at: expiresAt || null,
    })
    .select('*')
    .single();
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Memory saved', action: 'save_memory', entityId: (data as { id: string })?.id };
}

async function deleteMemory(id: string): Promise<ActionResult> {
  const { error } = await supabase.from('ai_memories').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Memory forgotten', action: 'delete_memory', entityId: id };
}
