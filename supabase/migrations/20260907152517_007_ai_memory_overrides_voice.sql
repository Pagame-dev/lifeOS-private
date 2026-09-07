/*
# AI memory, schedule overrides, and voice settings

1. New Tables
- `ai_memories` — persistent AI memory store for explicit preferences, learned behavioural patterns, and temporary context
  - id, user_id, memory_type (explicit_preference | learned_pattern | temporary_context), pattern_key, pattern_value, confidence_score (0-1), observation_count, last_observed, is_temporary, expires_at (nullable, for temporary context), created_at, updated_at
- `schedule_overrides` — date-specific overrides for recurring timetable events (e.g. "tomorrow Biology is in Room 204")
  - id, user_id, override_date, event_title, action_type (modified | cancelled | replaced), new_room, new_start_time, new_end_time, new_title, reason, created_at
- `voice_settings` — per-user voice input/output preferences
  - id, user_id, voice_input_enabled, voice_output_enabled, auto_play_voice, selected_voice, speaking_speed, text_when_type, voice_when_type, text_when_speak, voice_when_speak, created_at, updated_at

2. Security
- Enable RLS on all new tables
- Owner-scoped CRUD policies (TO authenticated, auth.uid() = user_id)
- All user_id columns default to auth.uid()

3. Important Notes
- ai_memories.confidence_score: 0 = single observation, 1 = explicit user preference. Learned patterns start at 0.2 and increase with each observation.
- ai_memories.expires_at: only set for temporary_context; NULL for permanent memories.
- schedule_overrides: date-specific only — never modifies the underlying timetable_events template.
- voice_settings: text_when_type/voice_when_type/voice_when_speak control whether the AI responds with text and/or voice based on input modality.
*/

-- AI memories
CREATE TABLE IF NOT EXISTS ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('explicit_preference', 'learned_pattern', 'temporary_context')),
  pattern_key text NOT NULL,
  pattern_value text NOT NULL,
  confidence_score numeric DEFAULT 0.2,
  observation_count int DEFAULT 1,
  last_observed timestamptz DEFAULT now(),
  is_temporary boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_memories" ON ai_memories;
CREATE POLICY "select_own_ai_memories" ON ai_memories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ai_memories" ON ai_memories;
CREATE POLICY "insert_own_ai_memories" ON ai_memories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ai_memories" ON ai_memories;
CREATE POLICY "update_own_ai_memories" ON ai_memories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ai_memories" ON ai_memories;
CREATE POLICY "delete_own_ai_memories" ON ai_memories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Schedule overrides (date-specific, does NOT modify recurring templates)
CREATE TABLE IF NOT EXISTS schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  event_title text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('modified', 'cancelled', 'replaced')),
  new_room text,
  new_start_time time,
  new_end_time time,
  new_title text,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_schedule_overrides" ON schedule_overrides;
CREATE POLICY "select_own_schedule_overrides" ON schedule_overrides FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_schedule_overrides" ON schedule_overrides;
CREATE POLICY "insert_own_schedule_overrides" ON schedule_overrides FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_schedule_overrides" ON schedule_overrides;
CREATE POLICY "update_own_schedule_overrides" ON schedule_overrides FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_schedule_overrides" ON schedule_overrides;
CREATE POLICY "delete_own_schedule_overrides" ON schedule_overrides FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Voice settings
CREATE TABLE IF NOT EXISTS voice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_input_enabled boolean DEFAULT true,
  voice_output_enabled boolean DEFAULT false,
  auto_play_voice boolean DEFAULT false,
  selected_voice text DEFAULT '',
  speaking_speed numeric DEFAULT 1.0,
  text_when_type boolean DEFAULT true,
  voice_when_type boolean DEFAULT false,
  text_when_speak boolean DEFAULT true,
  voice_when_speak boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_voice_settings" ON voice_settings;
CREATE POLICY "select_own_voice_settings" ON voice_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_voice_settings" ON voice_settings;
CREATE POLICY "insert_own_voice_settings" ON voice_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_voice_settings" ON voice_settings;
CREATE POLICY "update_own_voice_settings" ON voice_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_voice_settings" ON voice_settings;
CREATE POLICY "delete_own_voice_settings" ON voice_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_type ON ai_memories(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_user_date ON schedule_overrides(user_id, override_date);
CREATE INDEX IF NOT EXISTS idx_voice_settings_user_id ON voice_settings(user_id);

-- Triggers
DROP TRIGGER IF EXISTS trg_ai_memories_updated_at ON ai_memories;
CREATE TRIGGER trg_ai_memories_updated_at BEFORE UPDATE ON ai_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_voice_settings_updated_at ON voice_settings;
CREATE TRIGGER trg_voice_settings_updated_at BEFORE UPDATE ON voice_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
