/*
# Add recurring workouts, AI chat messages, and workout recurrence fields

1. New Tables
- `workout_recurrences` — recurring workout templates (like routines for workouts)
  - id, user_id, title, workout_type, day_of_week, scheduled_time, duration_min, jefit_link, is_active, created_at, updated_at
- `ai_chat_messages` — chat history for the AI assistant
  - id, user_id, role (user/assistant), content, created_at

2. Modified Tables
- `workouts` — add `recurrence_id` column (nullable, FK to workout_recurrences)

3. Security
- Enable RLS on all new tables
- Owner-scoped CRUD policies on all new tables (TO authenticated, auth.uid() = user_id)
*/

-- Workout recurrences (recurring workout templates)
CREATE TABLE IF NOT EXISTS workout_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Workout',
  workout_type text DEFAULT '',
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  scheduled_time time,
  duration_min int,
  jefit_link text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workout_recurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workout_recurrences" ON workout_recurrences;
CREATE POLICY "select_own_workout_recurrences" ON workout_recurrences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workout_recurrences" ON workout_recurrences;
CREATE POLICY "insert_own_workout_recurrences" ON workout_recurrences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workout_recurrences" ON workout_recurrences;
CREATE POLICY "update_own_workout_recurrences" ON workout_recurrences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workout_recurrences" ON workout_recurrences;
CREATE POLICY "delete_own_workout_recurrences" ON workout_recurrences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- AI chat messages
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_chat" ON ai_chat_messages;
CREATE POLICY "select_own_ai_chat" ON ai_chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ai_chat" ON ai_chat_messages;
CREATE POLICY "insert_own_ai_chat" ON ai_chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ai_chat" ON ai_chat_messages;
CREATE POLICY "delete_own_ai_chat" ON ai_chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add recurrence_id to workouts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workouts' AND column_name = 'recurrence_id') THEN
    ALTER TABLE workouts ADD COLUMN recurrence_id uuid REFERENCES workout_recurrences(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_recurrences_user_id ON workout_recurrences(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_recurrences_user_day ON workout_recurrences(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user_id ON ai_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_user_created ON ai_chat_messages(user_id, created_at);

-- Triggers
DROP TRIGGER IF EXISTS trg_workout_recurrences_updated_at ON workout_recurrences;
CREATE TRIGGER trg_workout_recurrences_updated_at BEFORE UPDATE ON workout_recurrences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
