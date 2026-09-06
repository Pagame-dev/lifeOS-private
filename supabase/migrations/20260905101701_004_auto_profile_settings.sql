/*
# Life OS — Auto-create Profile & Settings on Signup

## Overview
Creates a database trigger that automatically creates a profile, user_settings,
ai_preferences, and notification_preferences row whenever a new auth user signs up.

## Changes
1. New function `handle_new_user()` that inserts profile + settings rows
2. Trigger on auth.users INSERT to call the function

## Security
- The function runs as SECURITY DEFINER so it can insert into the tables
  (the new user has no session yet during the trigger)
- Only inserts, no external access
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO ai_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
