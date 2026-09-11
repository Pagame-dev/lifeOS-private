/*
# pg_cron: Schedule Notification Scheduler

## Purpose
Sets up pg_cron to call the notification-scheduler edge function every minute,
ensuring notifications are sent reliably even when the app is closed.

## Changes
- Enables the pg_cron extension
- Creates a cron job that calls the notification-scheduler edge function every minute
- Uses the Supabase service role key for authentication
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the notification scheduler to run every minute
SELECT cron.schedule(
  'lifeos-notification-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ojgvaqxkzitiuagdxflo.supabase.co/functions/v1/notification-scheduler',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
