/*
# Life OS — Goals, Projects, Tests, AI & Notifications Schema

## Overview
Creates tables for goals, projects, milestones, tests/exams, AI preferences/memory/plans,
notifications, and notification preferences.

## New Tables

1. **goals** — long-term outcomes (Launch POSÉ, Improve Maths, etc.)
2. **projects** — active bodies of work under goals (with capacity, max weekly time)
3. **milestones** — milestones within projects (with target dates, progress)
4. **tests_exams** — school tests and exams with revision progress
5. **ai_preferences** — user's AI planning preferences and constraints
6. **ai_memory** — learned patterns (homework speed, overload patterns, etc.)
7. **ai_plans** — proposed schedule layers (reference existing tasks, not duplicate)
8. **ai_plan_items** — individual items within an AI plan
9. **notifications** — notification feed (timetable-style, short messages)
10. **notification_preferences** — per-type notification settings

## Security
- RLS enabled on all tables
- Owner-scoped CRUD policies (4 per table)
- ai_plan_items scoped through ai_plans ownership
*/

-- ============================================================
-- GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  life_area_id uuid REFERENCES life_areas(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  target_date date,
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON goals;
CREATE POLICY "select_own_goals" ON goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_goals" ON goals;
CREATE POLICY "insert_own_goals" ON goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_goals" ON goals;
CREATE POLICY "update_own_goals" ON goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_goals" ON goals;
CREATE POLICY "delete_own_goals" ON goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  target_date date,
  progress int DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  capacity_hours_weekly int DEFAULT 5,
  max_weekly_time_min int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- MILESTONES
-- ============================================================
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  target_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_milestones" ON milestones;
CREATE POLICY "select_own_milestones" ON milestones FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_milestones" ON milestones;
CREATE POLICY "insert_own_milestones" ON milestones FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_milestones" ON milestones;
CREATE POLICY "update_own_milestones" ON milestones FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_milestones" ON milestones;
CREATE POLICY "delete_own_milestones" ON milestones FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TESTS / EXAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS tests_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  exam_date timestamptz NOT NULL,
  importance int DEFAULT 3 CHECK (importance >= 1 AND importance <= 5),
  topics text DEFAULT '',
  notes text DEFAULT '',
  revision_progress int DEFAULT 0 CHECK (revision_progress >= 0 AND revision_progress <= 100),
  status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'done')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tests_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tests" ON tests_exams;
CREATE POLICY "select_own_tests" ON tests_exams FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tests" ON tests_exams;
CREATE POLICY "insert_own_tests" ON tests_exams FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tests" ON tests_exams;
CREATE POLICY "update_own_tests" ON tests_exams FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tests" ON tests_exams;
CREATE POLICY "delete_own_tests" ON tests_exams FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AI PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  planning_mode text DEFAULT 'balanced' CHECK (planning_mode IN ('balanced', 'productive', 'relaxed', 'custom')),
  preferred_work_start time DEFAULT '16:00',
  preferred_work_end time DEFAULT '21:00',
  protected_free_time_start time DEFAULT '20:00',
  protected_free_time_end time DEFAULT '22:00',
  max_study_hours_daily int DEFAULT 3,
  allow_late_night_work boolean DEFAULT false,
  temporary_instruction text DEFAULT '',
  temporary_instruction_expires timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE ai_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_prefs" ON ai_preferences;
CREATE POLICY "select_own_ai_prefs" ON ai_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ai_prefs" ON ai_preferences;
CREATE POLICY "insert_own_ai_prefs" ON ai_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ai_prefs" ON ai_preferences;
CREATE POLICY "update_own_ai_prefs" ON ai_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ai_prefs" ON ai_preferences;
CREATE POLICY "delete_own_ai_prefs" ON ai_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AI MEMORY
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_key text NOT NULL,
  pattern_value text NOT NULL,
  confidence_score numeric(3,2) DEFAULT 0.50,
  observation_count int DEFAULT 1,
  last_observed timestamptz DEFAULT now(),
  is_temporary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_memory" ON ai_memory;
CREATE POLICY "select_own_ai_memory" ON ai_memory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ai_memory" ON ai_memory;
CREATE POLICY "insert_own_ai_memory" ON ai_memory
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ai_memory" ON ai_memory;
CREATE POLICY "update_own_ai_memory" ON ai_memory
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ai_memory" ON ai_memory;
CREATE POLICY "delete_own_ai_memory" ON ai_memory
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AI PLANS (proposed schedule layer)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  status text DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected', 'outdated')),
  reasoning text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, plan_date)
);

ALTER TABLE ai_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_plans" ON ai_plans;
CREATE POLICY "select_own_ai_plans" ON ai_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ai_plans" ON ai_plans;
CREATE POLICY "insert_own_ai_plans" ON ai_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ai_plans" ON ai_plans;
CREATE POLICY "update_own_ai_plans" ON ai_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ai_plans" ON ai_plans;
CREATE POLICY "delete_own_ai_plans" ON ai_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AI PLAN ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_plan_id uuid NOT NULL REFERENCES ai_plans(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  homework_id uuid REFERENCES homework(id) ON DELETE SET NULL,
  title text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('task', 'homework', 'study', 'workout', 'routine', 'logopede', 'break', 'free_time')),
  scheduled_start time NOT NULL,
  scheduled_end time NOT NULL,
  energy_level text CHECK (energy_level IN ('high', 'medium', 'low')),
  reasoning text DEFAULT '',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_plan_items" ON ai_plan_items;
CREATE POLICY "select_own_ai_plan_items" ON ai_plan_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM ai_plans WHERE ai_plans.id = ai_plan_items.ai_plan_id AND ai_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_ai_plan_items" ON ai_plan_items;
CREATE POLICY "insert_own_ai_plan_items" ON ai_plan_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM ai_plans WHERE ai_plans.id = ai_plan_items.ai_plan_id AND ai_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_ai_plan_items" ON ai_plan_items;
CREATE POLICY "update_own_ai_plan_items" ON ai_plan_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM ai_plans WHERE ai_plans.id = ai_plan_items.ai_plan_id AND ai_plans.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM ai_plans WHERE ai_plans.id = ai_plan_items.ai_plan_id AND ai_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_ai_plan_items" ON ai_plan_items;
CREATE POLICY "delete_own_ai_plan_items" ON ai_plan_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM ai_plans WHERE ai_plans.id = ai_plan_items.ai_plan_id AND ai_plans.user_id = auth.uid())
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('important', 'upcoming', 'ai_intervention', 'summary')),
  title text NOT NULL,
  message text DEFAULT '',
  action_type text CHECK (action_type IN ('ok', 'replan_keep', 'none')),
  related_entity_type text DEFAULT '',
  related_entity_id uuid,
  is_read boolean DEFAULT false,
  is_acted_upon boolean DEFAULT false,
  scheduled_for timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  important_enabled boolean DEFAULT true,
  upcoming_enabled boolean DEFAULT true,
  upcoming_lead_time_min int DEFAULT 5,
  ai_intervention_enabled boolean DEFAULT true,
  summary_enabled boolean DEFAULT true,
  bedtime_preview_enabled boolean DEFAULT true,
  bedtime_preview_time time DEFAULT '21:30',
  quiet_hours_enabled boolean DEFAULT true,
  quiet_hours_start time DEFAULT '22:00',
  quiet_hours_end time DEFAULT '07:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notif_prefs" ON notification_preferences;
CREATE POLICY "select_own_notif_prefs" ON notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notif_prefs" ON notification_preferences;
CREATE POLICY "insert_own_notif_prefs" ON notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notif_prefs" ON notification_preferences;
CREATE POLICY "update_own_notif_prefs" ON notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notif_prefs" ON notification_preferences;
CREATE POLICY "delete_own_notif_prefs" ON notification_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON projects(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_tests_user_id ON tests_exams(user_id);
CREATE INDEX IF NOT EXISTS idx_tests_user_date ON tests_exams(user_id, exam_date);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_id ON ai_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_plans_user_date ON ai_plans(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_ai_plan_items_plan_id ON ai_plan_items(ai_plan_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_id ON notification_preferences(user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON milestones;
CREATE TRIGGER trg_milestones_updated_at BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_tests_updated_at ON tests_exams;
CREATE TRIGGER trg_tests_updated_at BEFORE UPDATE ON tests_exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_ai_prefs_updated_at ON ai_preferences;
CREATE TRIGGER trg_ai_prefs_updated_at BEFORE UPDATE ON ai_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_ai_memory_updated_at ON ai_memory;
CREATE TRIGGER trg_ai_memory_updated_at BEFORE UPDATE ON ai_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_ai_plans_updated_at ON ai_plans;
CREATE TRIGGER trg_ai_plans_updated_at BEFORE UPDATE ON ai_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_notif_prefs_updated_at ON notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
