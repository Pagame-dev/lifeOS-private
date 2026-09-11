/*
# Push Notifications & Notification Jobs

## Purpose
Adds server-side push notification infrastructure: per-device push subscriptions,
a notification job queue for scheduled delivery, and expanded notification
preference categories. This enables real Web Push notifications that work even
when the app is closed.

## New Tables

1. **push_subscriptions** — stores Web Push subscriptions per device/browser.
   - `id` (uuid PK)
   - `user_id` (uuid, FK auth.users, owner)
   - `endpoint` (text, unique — the browser push endpoint URL)
   - `p256dh` (text — ECDH public key from subscription)
   - `auth` (text — auth secret from subscription)
   - `device_label` (text — optional friendly name like "iPhone" or "Windows PC")
   - `user_agent` (text — browser/device info)
   - `is_active` (boolean, default true — set false when subscription fails)
   - `created_at`, `updated_at` (timestamps)

2. **notification_jobs** — scheduled notification queue.
   - `id` (uuid PK)
   - `user_id` (uuid, FK auth.users, owner)
   - `notification_type` (text — important/upcoming/ai_intervention/summary/test)
   - `category` (text — event/homework/test/routine/workout/briefing/bedtime/ai)
   - `title` (text — notification title)
   - `body` (text — notification body)
   - `related_entity_type` (text — e.g. 'timetable_event', 'homework', 'test')
   - `related_entity_id` (uuid — the related entity's ID)
   - `scheduled_for` (timestamptz — when to send, in user's timezone)
   - `sent_at` (timestamptz — when actually sent)
   - `status` (text — pending/sent/cancelled/failed)
   - `dedup_key` (text — unique per logical notification, prevents duplicates)
   - `deep_link` (text — URL path for notification click)
   - `created_at`, `updated_at` (timestamps)

## Modified Tables

3. **notification_preferences** — added new category toggle columns:
   - `events_enabled` (boolean, default true) — important events
   - `homework_enabled` (boolean, default true)
   - `tests_enabled` (boolean, default true)
   - `routines_enabled` (boolean, default true)
   - `workout_enabled` (boolean, default true)
   - `daily_briefing_enabled` (boolean, default true)
   - `daily_briefing_time` (text, default '07:00')
   - `notifications_master_enabled` (boolean, default true) — master ON/OFF

## Security
- RLS enabled on both new tables.
- Owner-scoped CRUD policies (4 per table) on push_subscriptions.
- Owner-scoped SELECT/INSERT on notification_jobs (users can see and create their own jobs; UPDATE/DELETE restricted to owner).
- The edge function (service role) bypasses RLS for server-side scheduling.
*/

-- ============================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  device_label text DEFAULT '',
  user_agent text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_push_subs" ON push_subscriptions;
CREATE POLICY "select_own_push_subs" ON push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_push_subs" ON push_subscriptions;
CREATE POLICY "insert_own_push_subs" ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_push_subs" ON push_subscriptions;
CREATE POLICY "update_own_push_subs" ON push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_push_subs" ON push_subscriptions;
CREATE POLICY "delete_own_push_subs" ON push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATION JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'upcoming',
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text DEFAULT '',
  related_entity_type text DEFAULT '',
  related_entity_id uuid,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  dedup_key text NOT NULL DEFAULT '',
  deep_link text DEFAULT '/',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notif_jobs" ON notification_jobs;
CREATE POLICY "select_own_notif_jobs" ON notification_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notif_jobs" ON notification_jobs;
CREATE POLICY "insert_own_notif_jobs" ON notification_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notif_jobs" ON notification_jobs;
CREATE POLICY "update_own_notif_jobs" ON notification_jobs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notif_jobs" ON notification_jobs;
CREATE POLICY "delete_own_notif_jobs" ON notification_jobs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- EXPAND NOTIFICATION PREFERENCES
-- ============================================================
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notifications_master_enabled boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS events_enabled boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS homework_enabled boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS tests_enabled boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS routines_enabled boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS workout_enabled boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS daily_briefing_enabled boolean DEFAULT true;

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS daily_briefing_time text DEFAULT '07:00';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notif_jobs_pending ON notification_jobs(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notif_jobs_dedup ON notification_jobs(user_id, dedup_key);
CREATE INDEX IF NOT EXISTS idx_notif_jobs_user_status ON notification_jobs(user_id, status);

-- ============================================================
-- HELPER: cancel pending jobs for a specific entity
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_notification_jobs_for_entity(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE notification_jobs
  SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_user_id
    AND related_entity_type = p_entity_type
    AND related_entity_id = p_entity_id
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
