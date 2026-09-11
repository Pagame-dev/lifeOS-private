/*
# VAPID Keys Storage

## Purpose
Stores VAPID key pair for Web Push notifications in a database table that edge functions
can read using the service role key. This avoids needing the Management API to set secrets.

## New Tables
1. **app_secrets** — stores server-side secrets like VAPID keys.
   - `key` (text PK — the secret name)
   - `value` (text — the secret value)
   - `created_at` (timestamp)

## Security
- RLS enabled but no policies — only the service role (which bypasses RLS) can read/write.
- The anon and authenticated roles have NO access to this table.
*/

CREATE TABLE IF NOT EXISTS app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- No policies — only service role can access (bypasses RLS)
-- Revoke default privileges
REVOKE ALL ON app_secrets FROM anon, authenticated;

-- Insert VAPID keys
INSERT INTO app_secrets (key, value) VALUES
  ('vapid_public_key', 'BDr30v0-NlDiDzPB2wBMp9rS07ReXJwlrfYL9UaD2WRyo577EAdJDQdDnrVj-UhTuyTWBA6PbueLCDvaVpvyCWA'),
  ('vapid_private_key', 'uey80fVaF027zwHUsyaLOc929adZ0JTm4PuBDZURAY8')
ON CONFLICT (key) DO NOTHING;
