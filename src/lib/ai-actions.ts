import { supabase } from '@/lib/supabase';
import { todayKey, addDays, timeToMinutes, fmtTime, fmtRelativeDate } from './ai-context';
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
    default:
      return { success: false, message: 'Unknown action' };
  }
}

async function completeTask(id: string): Promise<ActionResult> {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
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
  return { success: true, message: 'Workout marked complete', action: 'complete_workout', entityId: id };
}

async function skipWorkout(id: string, reason?: string): Promise<ActionResult> {
  const { error } = await supabase
    .from('workouts')
    .update({ status: 'skipped', skip_reason: reason || 'Skipped via AI assistant' })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
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
  const { error } = await supabase
    .from('tasks')
    .update({ due_date: newDueDate })
    .eq('id', id);
  if (error) return { success: false, message: error.message };
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
  return ['delete_task', 'delete_homework'].includes(actionType);
}
