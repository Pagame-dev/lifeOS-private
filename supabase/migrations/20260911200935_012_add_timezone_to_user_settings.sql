/*
# Add timezone column to user_settings

## Purpose
Stores the user's IANA timezone (e.g. "Europe/Paris") so the server-side
notification scheduler can calculate notification times in the user's local time.

## Changes
- Adds `timezone` text column to `user_settings` (defaults to 'UTC')
*/

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
