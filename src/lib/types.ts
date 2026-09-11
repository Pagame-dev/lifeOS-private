export type WeekType = 'A' | 'B';

export type PlanningMode = 'balanced' | 'productive' | 'relaxed' | 'custom';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'skipped';

export type HomeworkStatus = 'todo' | 'in_progress' | 'done' | 'skipped';

export type RoutineStatus = 'pending' | 'in_progress' | 'completed' | 'missed' | 'skipped';

export type WorkoutStatus = 'planned' | 'completed' | 'skipped';

export type LogopedeSessionType = 'morning' | 'evening';
export type LogopedeStatus = 'pending' | 'completed' | 'missed';

export type NotificationType = 'important' | 'upcoming' | 'ai_intervention' | 'summary';
export type NotificationAction = 'ok' | 'replan_keep' | 'none';

export type AIPlanStatus = 'proposed' | 'accepted' | 'rejected' | 'outdated';

export type EnergyLevel = 'high' | 'medium' | 'low';

export type AvailabilityType = 'busy' | 'available' | 'preferred' | 'protected';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string;
  current_week_type: WeekType;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: string;
  planning_mode: PlanningMode;
  quiet_hours_start: string;
  quiet_hours_end: string;
  bedtime: string;
  wake_time: string;
  logopede_enabled: boolean;
  logopede_rest_day: string;
  logopede_morning_time: string;
  logopede_evening_time: string;
  logopede_duration_min: number;
  notification_interval_min: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  teacher: string;
  created_at: string;
}

export interface Holiday {
  id: string;
  user_id: string;
  date: string;
  label: string;
  created_at: string;
}

export interface TimetableEvent {
  id: string;
  user_id: string;
  title: string;
  subject_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_type: WeekType | null;
  is_school_lesson: boolean;
  room: string;
  teacher: string;
  notes: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  content: string;
  category: 'inbox' | 'someday';
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LifeArea {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  due_date: string | null;
  estimated_duration_min: number | null;
  category: string;
  project_id: string | null;
  goal_id: string | null;
  notes: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  is_fixed: boolean;
  ai_priority: number | null;
  life_area_id: string | null;
  completed_at: string | null;
  skipped_reason: string;
  created_at: string;
  updated_at: string;
}

export interface Homework {
  id: string;
  user_id: string;
  title: string;
  subject_id: string | null;
  teacher: string;
  due_date: string;
  estimated_duration_min: number | null;
  priority: number;
  status: HomeworkStatus;
  notes: string;
  topic: string;
  related_lesson_id: string | null;
  related_test_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  description: string;
  applicable_days: number[];
  start_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoutineStep {
  id: string;
  routine_id: string;
  title: string;
  description: string;
  duration_min: number;
  sort_order: number;
  is_required: boolean;
  created_at: string;
}

export interface RoutineInstance {
  id: string;
  user_id: string;
  routine_id: string;
  instance_date: string;
  status: RoutineStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RoutineInstanceStep {
  id: string;
  routine_instance_id: string;
  routine_step_id: string | null;
  title: string;
  duration_min: number;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  title: string;
  workout_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_min: number | null;
  status: WorkoutStatus;
  skip_reason: string;
  jefit_link: string;
  recurrence_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutRecurrence {
  id: string;
  user_id: string;
  title: string;
  workout_type: string;
  day_of_week: number;
  scheduled_time: string | null;
  duration_min: number | null;
  jefit_link: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface LogopedeSession {
  id: string;
  user_id: string;
  session_date: string;
  session_type: LogopedeSessionType;
  status: LogopedeStatus;
  completed_at: string | null;
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  sleep_duration_min: number | null;
  time_in_bed_min: number | null;
  bedtime: string | null;
  stopped_screen_time: string | null;
  wake_time: string | null;
  estimated_sleep_min: number | null;
  sleep_confidence: string | null;
  water_glasses: number;
  exercise_min: number;
  study_time_min: number;
  screen_time_min: number;
  hygiene: boolean;
  skincare: boolean;
  food: string;
  reading_min: number;
  mood: number | null;
  energy: number | null;
  money_spent: number;
  journal: string;
  daily_rating: number | null;
  daily_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  life_area_id: string | null;
  status: string;
  target_date: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  description: string;
  status: string;
  target_date: string | null;
  progress: number;
  capacity_hours_weekly: number;
  max_weekly_time_min: number | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description: string;
  target_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestExam {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  exam_date: string;
  importance: number;
  topics: string;
  notes: string;
  revision_progress: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AIPreference {
  id: string;
  user_id: string;
  planning_mode: PlanningMode;
  preferred_work_start: string;
  preferred_work_end: string;
  protected_free_time_start: string;
  protected_free_time_end: string;
  max_study_hours_daily: number;
  allow_late_night_work: boolean;
  temporary_instruction: string;
  temporary_instruction_expires: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIPlan {
  id: string;
  user_id: string;
  plan_date: string;
  status: AIPlanStatus;
  reasoning: string;
  created_at: string;
  updated_at: string;
}

export interface AIPlanItem {
  id: string;
  ai_plan_id: string;
  task_id: string | null;
  homework_id: string | null;
  title: string;
  item_type: string;
  scheduled_start: string;
  scheduled_end: string;
  energy_level: EnergyLevel | null;
  reasoning: string;
  sort_order: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_type: NotificationAction | null;
  related_entity_type: string;
  related_entity_id: string | null;
  is_read: boolean;
  is_acted_upon: boolean;
  scheduled_for: string;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  important_enabled: boolean;
  upcoming_enabled: boolean;
  upcoming_lead_time_min: number;
  ai_intervention_enabled: boolean;
  summary_enabled: boolean;
  bedtime_preview_enabled: boolean;
  bedtime_preview_time: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  notifications_master_enabled: boolean;
  events_enabled: boolean;
  homework_enabled: boolean;
  tests_enabled: boolean;
  routines_enabled: boolean;
  workout_enabled: boolean;
  daily_briefing_enabled: boolean;
  daily_briefing_time: string;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  id: string;
  user_id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

export type AIMemoryType = 'explicit_preference' | 'learned_pattern' | 'temporary_context';

export interface AIMemory {
  id: string;
  user_id: string;
  memory_type: AIMemoryType;
  pattern_key: string;
  pattern_value: string;
  confidence_score: number;
  observation_count: number;
  last_observed: string;
  is_temporary: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScheduleOverrideAction = 'modified' | 'cancelled' | 'replaced';

export interface ScheduleOverride {
  id: string;
  user_id: string;
  override_date: string;
  event_title: string;
  action_type: ScheduleOverrideAction;
  new_room: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  new_title: string | null;
  reason: string | null;
  created_at: string;
}

export interface VoiceSettings {
  id: string;
  user_id: string;
  voice_input_enabled: boolean;
  voice_output_enabled: boolean;
  auto_play_voice: boolean;
  selected_voice: string;
  speaking_speed: number;
  text_when_type: boolean;
  voice_when_type: boolean;
  text_when_speak: boolean;
  voice_when_speak: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  device_label: string;
  user_agent: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationJobStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

export interface NotificationJob {
  id: string;
  user_id: string;
  notification_type: string;
  category: string;
  title: string;
  body: string;
  related_entity_type: string;
  related_entity_id: string | null;
  scheduled_for: string;
  sent_at: string | null;
  status: NotificationJobStatus;
  dedup_key: string;
  deep_link: string;
  created_at: string;
  updated_at: string;
}
