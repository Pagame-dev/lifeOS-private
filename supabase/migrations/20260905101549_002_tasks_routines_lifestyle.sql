/*
# Life OS — Tasks, Homework, Routines & Lifestyle Schema

## Overview
Creates tables for tasks, homework, routines, routine steps, routine instances,
workouts, logopède sessions, daily logs, and life areas.

## New Tables

1. **life_areas** — top-level categories (School, Fitness, Personal, Business, etc.)
2. **tasks** — general tasks with priority, due dates, dependencies, scheduling
3. **task_dependencies** — dependency graph between tasks
4. **homework** — specialised school tasks linked to subjects
5. **routines** — routine templates (morning, evening, etc.)
6. **routine_steps** — steps within a routine template
7. **routine_instances** — daily generated routine instances (historical preserved)
8. **routine_instance_steps** — steps within a routine instance
9. **workouts** — scheduled workouts (completion tracked, details in JEFIT)
10. **logopede_sessions** — logopède exercise session tracking (2x/day, 6 days/week)
11. **daily_logs** — one per date, lifestyle tracking (sleep, water, mood, etc.)

## Security
- RLS enabled on all tables
- Owner-scoped CRUD policies (4 per table)
- Child tables (routine_steps, routine_instance_steps, task_dependencies) scope through parent ownership
*/

-- ============================================================
-- LIFE AREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS life_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#8b9a6b',
  sort_order int DEFAULT 0,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE life_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_life_areas" ON life_areas;
CREATE POLICY "select_own_life_areas" ON life_areas FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_life_areas" ON life_areas;
CREATE POLICY "insert_own_life_areas" ON life_areas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_life_areas" ON life_areas;
CREATE POLICY "update_own_life_areas" ON life_areas FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_life_areas" ON life_areas;
CREATE POLICY "delete_own_life_areas" ON life_areas FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'skipped')),
  priority int DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  due_date date,
  estimated_duration_min int,
  category text DEFAULT '',
  project_id uuid,
  goal_id uuid,
  notes text DEFAULT '',
  scheduled_date date,
  scheduled_time time,
  is_fixed boolean DEFAULT false,
  ai_priority int,
  life_area_id uuid REFERENCES life_areas(id) ON DELETE SET NULL,
  completed_at timestamptz,
  skipped_reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TASK DEPENDENCIES
-- ============================================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (task_id, depends_on_task_id)
);

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_task_deps" ON task_dependencies;
CREATE POLICY "select_own_task_deps" ON task_dependencies FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_task_deps" ON task_dependencies;
CREATE POLICY "insert_own_task_deps" ON task_dependencies FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_task_deps" ON task_dependencies;
CREATE POLICY "update_own_task_deps" ON task_dependencies FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_task_deps" ON task_dependencies;
CREATE POLICY "delete_own_task_deps" ON task_dependencies FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- HOMEWORK
-- ============================================================
CREATE TABLE IF NOT EXISTS homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  teacher text DEFAULT '',
  due_date date NOT NULL,
  estimated_duration_min int,
  priority int DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'skipped')),
  notes text DEFAULT '',
  topic text DEFAULT '',
  related_lesson_id uuid REFERENCES timetable_events(id) ON DELETE SET NULL,
  related_test_id uuid,
  scheduled_date date,
  scheduled_time time,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE homework ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_homework" ON homework;
CREATE POLICY "select_own_homework" ON homework FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_homework" ON homework;
CREATE POLICY "insert_own_homework" ON homework FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_homework" ON homework;
CREATE POLICY "update_own_homework" ON homework FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_homework" ON homework;
CREATE POLICY "delete_own_homework" ON homework FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- ROUTINES (templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  applicable_days int[] DEFAULT '{0,1,2,3,4,5,6}',
  start_time time,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_routines" ON routines;
CREATE POLICY "select_own_routines" ON routines FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_routines" ON routines;
CREATE POLICY "insert_own_routines" ON routines FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_routines" ON routines;
CREATE POLICY "update_own_routines" ON routines FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_routines" ON routines;
CREATE POLICY "delete_own_routines" ON routines FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- ROUTINE STEPS (template)
-- ============================================================
CREATE TABLE IF NOT EXISTS routine_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  duration_min int DEFAULT 5,
  sort_order int DEFAULT 0,
  is_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE routine_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_routine_steps" ON routine_steps;
CREATE POLICY "select_own_routine_steps" ON routine_steps FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_routine_steps" ON routine_steps;
CREATE POLICY "insert_own_routine_steps" ON routine_steps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_routine_steps" ON routine_steps;
CREATE POLICY "update_own_routine_steps" ON routine_steps FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_routine_steps" ON routine_steps;
CREATE POLICY "delete_own_routine_steps" ON routine_steps FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM routines WHERE routines.id = routine_steps.routine_id AND routines.user_id = auth.uid())
  );

-- ============================================================
-- ROUTINE INSTANCES (daily, historical preserved)
-- ============================================================
CREATE TABLE IF NOT EXISTS routine_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  instance_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'missed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, routine_id, instance_date)
);

ALTER TABLE routine_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_routine_instances" ON routine_instances;
CREATE POLICY "select_own_routine_instances" ON routine_instances FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_routine_instances" ON routine_instances;
CREATE POLICY "insert_own_routine_instances" ON routine_instances FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_routine_instances" ON routine_instances;
CREATE POLICY "update_own_routine_instances" ON routine_instances FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_routine_instances" ON routine_instances;
CREATE POLICY "delete_own_routine_instances" ON routine_instances FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- ROUTINE INSTANCE STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS routine_instance_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_instance_id uuid NOT NULL REFERENCES routine_instances(id) ON DELETE CASCADE,
  routine_step_id uuid REFERENCES routine_steps(id) ON DELETE SET NULL,
  title text NOT NULL,
  duration_min int DEFAULT 5,
  sort_order int DEFAULT 0,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE routine_instance_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ris" ON routine_instance_steps;
CREATE POLICY "select_own_ris" ON routine_instance_steps FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM routine_instances WHERE routine_instances.id = routine_instance_steps.routine_instance_id AND routine_instances.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_ris" ON routine_instance_steps;
CREATE POLICY "insert_own_ris" ON routine_instance_steps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM routine_instances WHERE routine_instances.id = routine_instance_steps.routine_instance_id AND routine_instances.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_ris" ON routine_instance_steps;
CREATE POLICY "update_own_ris" ON routine_instance_steps FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM routine_instances WHERE routine_instances.id = routine_instance_steps.routine_instance_id AND routine_instances.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM routine_instances WHERE routine_instances.id = routine_instance_steps.routine_instance_id AND routine_instances.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_ris" ON routine_instance_steps;
CREATE POLICY "delete_own_ris" ON routine_instance_steps FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM routine_instances WHERE routine_instances.id = routine_instance_steps.routine_instance_id AND routine_instances.user_id = auth.uid())
  );

-- ============================================================
-- WORKOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT 'Workout',
  workout_type text DEFAULT '',
  scheduled_date date NOT NULL,
  scheduled_time time,
  duration_min int,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'skipped')),
  skip_reason text DEFAULT '',
  jefit_link text DEFAULT '',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workouts" ON workouts;
CREATE POLICY "select_own_workouts" ON workouts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workouts" ON workouts;
CREATE POLICY "insert_own_workouts" ON workouts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workouts" ON workouts;
CREATE POLICY "update_own_workouts" ON workouts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workouts" ON workouts;
CREATE POLICY "delete_own_workouts" ON workouts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- LOGOPÈDE SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS logopede_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('morning', 'evening')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, session_date, session_type)
);

ALTER TABLE logopede_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_logopede" ON logopede_sessions;
CREATE POLICY "select_own_logopede" ON logopede_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_logopede" ON logopede_sessions;
CREATE POLICY "insert_own_logopede" ON logopede_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_logopede" ON logopede_sessions;
CREATE POLICY "update_own_logopede" ON logopede_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_logopede" ON logopede_sessions;
CREATE POLICY "delete_own_logopede" ON logopede_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- DAILY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  sleep_duration_min int,
  time_in_bed_min int,
  bedtime time,
  stopped_screen_time time,
  wake_time time,
  estimated_sleep_min int,
  sleep_confidence text CHECK (sleep_confidence IN ('high', 'medium', 'low', 'unsure')),
  water_glasses int DEFAULT 0,
  exercise_min int DEFAULT 0,
  study_time_min int DEFAULT 0,
  screen_time_min int DEFAULT 0,
  hygiene boolean DEFAULT false,
  skincare boolean DEFAULT false,
  food text DEFAULT '',
  reading_min int DEFAULT 0,
  mood int CHECK (mood >= 1 AND mood <= 5),
  energy int CHECK (energy >= 1 AND energy <= 5),
  money_spent numeric(10,2) DEFAULT 0,
  journal text DEFAULT '',
  daily_rating int CHECK (daily_rating >= 1 AND daily_rating <= 5),
  daily_score int CHECK (daily_score >= 0 AND daily_score <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_daily_logs" ON daily_logs;
CREATE POLICY "select_own_daily_logs" ON daily_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_daily_logs" ON daily_logs;
CREATE POLICY "insert_own_daily_logs" ON daily_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_daily_logs" ON daily_logs;
CREATE POLICY "update_own_daily_logs" ON daily_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_daily_logs" ON daily_logs;
CREATE POLICY "delete_own_daily_logs" ON daily_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_life_areas_user_id ON life_areas(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_homework_user_id ON homework(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_user_status ON homework(user_id, status);
CREATE INDEX IF NOT EXISTS idx_homework_user_due ON homework(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_steps_routine_id ON routine_steps(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_instances_user_date ON routine_instances(user_id, instance_date);
CREATE INDEX IF NOT EXISTS idx_ris_instance_id ON routine_instance_steps(routine_instance_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_logopede_user_date ON logopede_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_homework_updated_at ON homework;
CREATE TRIGGER trg_homework_updated_at BEFORE UPDATE ON homework
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_routines_updated_at ON routines;
CREATE TRIGGER trg_routines_updated_at BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_workouts_updated_at ON workouts;
CREATE TRIGGER trg_workouts_updated_at BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_daily_logs_updated_at ON daily_logs;
CREATE TRIGGER trg_daily_logs_updated_at BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
