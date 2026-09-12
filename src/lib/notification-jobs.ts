import { supabase } from '@/lib/supabase';
import { localDateKey, addDaysLocal } from '@/lib/date-utils';

export interface ScheduleNotificationParams {
  userId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  relatedEntityType: string;
  relatedEntityId: string;
  scheduledFor: Date;
  dedupKey: string;
  deepLink?: string;
}

export async function scheduleNotification(params: ScheduleNotificationParams): Promise<void> {
  const { data: existing } = await supabase
    .from('notification_jobs')
    .select('id, status')
    .eq('user_id', params.userId)
    .eq('dedup_key', params.dedupKey)
    .maybeSingle();

  if (existing && existing.status === 'pending') {
    await supabase
      .from('notification_jobs')
      .update({
        title: params.title,
        body: params.body,
        scheduled_for: params.scheduledFor.toISOString(),
        deep_link: params.deepLink || '/',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return;
  }

  if (existing && existing.status !== 'pending') {
    await supabase
      .from('notification_jobs')
      .update({
        status: 'pending',
        title: params.title,
        body: params.body,
        scheduled_for: params.scheduledFor.toISOString(),
        sent_at: null,
        deep_link: params.deepLink || '/',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return;
  }

  await supabase.from('notification_jobs').insert({
    user_id: params.userId,
    notification_type: params.type,
    category: params.category,
    title: params.title,
    body: params.body,
    related_entity_type: params.relatedEntityType,
    related_entity_id: params.relatedEntityId,
    scheduled_for: params.scheduledFor.toISOString(),
    dedup_key: params.dedupKey,
    deep_link: params.deepLink || '/',
  });
}

export async function cancelNotificationsForEntity(
  userId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await supabase
    .from('notification_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('related_entity_type', entityType)
    .eq('related_entity_id', entityId)
    .eq('status', 'pending');
}

function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function convertLocalTimeToUTC(dateStr: string, timeStr: string): Date {
  const tz = getUserTimezone();
  const localStr = `${dateStr}T${timeStr}:00`;
  const date = new Date(localStr);
  return date;
}

export function getNextDateForDayOfWeek(dayOfWeek: number, fromDate: Date = new Date()): string {
  const result = new Date(fromDate);
  result.setHours(0, 0, 0, 0);
  const currentDay = result.getDay();
  const diff = (dayOfWeek - currentDay + 7) % 7;
  result.setDate(result.getDate() + diff);
  return localDateKey(result);
}

export function getTomorrowDate(): string {
  return addDaysLocal(localDateKey(), 1);
}

export function getTodayDate(): string {
  return localDateKey();
}

export { getUserTimezone };
