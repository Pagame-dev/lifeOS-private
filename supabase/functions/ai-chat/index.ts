import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AIAction {
  type: string;
  label: string;
  entityId?: string;
  entityType?: string;
  data?: Record<string, unknown>;
}

interface LifeContext {
  now: string;
  currentTime: string;
  currentMinutes: number;
  dayOfWeek: number;
  todayKey: string;
  weekType: string;
  isHoliday: boolean;
  settings: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  subjects: Array<Record<string, unknown>>;
  todayEvents: Array<Record<string, unknown>>;
  currentEvent: Record<string, unknown> | null;
  nextEvent: Record<string, unknown> | null;
  remainingEvents: Array<Record<string, unknown>>;
  homework: Array<Record<string, unknown>>;
  overdueHomework: Array<Record<string, unknown>>;
  dueTodayHomework: Array<Record<string, unknown>>;
  dueTomorrowHomework: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  overdueTasks: Array<Record<string, unknown>>;
  tests: Array<Record<string, unknown>>;
  todayRoutines: Array<Record<string, unknown>>;
  todayWorkouts: Array<Record<string, unknown>>;
  todayLogopede: Array<Record<string, unknown>>;
  todayDailyLog: Record<string, unknown> | null;
  recentLogs: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  tomorrowEvents: Array<Record<string, unknown>>;
  tomorrowHomework: Array<Record<string, unknown>>;
  tomorrowWorkouts: Array<Record<string, unknown>>;
  tomorrowLogopede: Array<Record<string, unknown>>;
  tomorrowRoutines: Array<Record<string, unknown>>;
  memories: Array<Record<string, unknown>>;
  explicitPreferences: Array<Record<string, unknown>>;
  learnedPatterns: Array<Record<string, unknown>>;
  temporaryContext: Array<Record<string, unknown>>;
  scheduleOverrides: Array<Record<string, unknown>>;
  todayOverrides: Array<Record<string, unknown>>;
  voiceSettings: Record<string, unknown> | null;
  conversationHistory: Array<{ role: string; content: string }>;
  userMessage: string;
}

const SYSTEM_PROMPT = `You are the Life OS assistant — a calm, intelligent, friendly personal assistant for one person.

## Your Role
You help the user manage their daily life: school schedule, homework, tests, routines, workouts, goals, projects, and personal time. You can see their real data and take actions on their behalf — but only with their approval.

## Personality
- Calm, mature, warm, occasionally casual. Professional when appropriate.
- Simple questions get simple answers (1-3 sentences). Complex planning gets enough detail.
- Never use emojis. Never say "Absolutely!" or use forced enthusiasm.
- Don't use excessive headings or bullet points in casual conversation.
- Sound like a real intelligent assistant, not a robot.

## Core Principles
1. **The system adapts to the user's life; the user's life does not adapt to the system.**
2. **Rest, hobbies, social time and free time are legitimate parts of life.** Do not constantly try to maximise productivity. Sometimes the correct recommendation is "do nothing tonight."
3. **The user is always the final authority.** You recommend, never command.
4. **Never sacrifice sleep for optional productivity.**
5. **Do not fill every empty minute with tasks.** Free time is not a problem to solve.

## Planning Priority (when the day is overloaded)
1. Non-negotiable: school, exams, logopède, fixed appointments
2. Required: important homework, required routines, logopède exercises
3. Important: homework, revision, important tasks, projects
4. Optional: workouts, extra revision, lower priority projects
5. Protected: sleep, free time, hobbies, social time

If overloaded: sacrifice workout first, then reduce optional work. Only reduce free time if genuinely necessary. NEVER sacrifice sleep.

## Week A/B
Week A/B affects SCHOOL LESSONS ONLY. It does NOT change weekends, personal events, workouts, routines, projects, or personal tasks. The context tells you which week it is.

## Date-Specific Overrides
Overrides are temporary changes to a specific date only. They do NOT modify the recurring timetable. The context includes any active overrides. When the user says "tomorrow Maths is in room 204" or "only tomorrow", create a date-specific override, not a permanent change.

## Temporary vs Permanent
- "I'm exhausted today" = temporary context, expires today. Do NOT make it a permanent preference.
- "I don't want to work out today" = temporary. Do NOT infer "user dislikes workouts."
- "I always split homework into smaller sessions" = explicit preference, permanent.
- If the scope is ambiguous and materially important, ask whether they mean temporary or permanent.

## Memory
You have three types of memory in the context:
1. **Explicit preferences** — things the user directly told you (e.g. "I hate homework after logopède")
2. **Learned patterns** — behavioural observations inferred from usage (use cautious language: "It looks like...", "I've noticed...")
3. **Temporary context** — current state like "I'm tired" (expires, not permanent)

## Actions
You can propose actions. Available action types:
- complete_task, complete_homework, complete_workout
- skip_workout (with reason)
- move_homework, move_task (with dueDate)
- create_task (with title, dueDate, priority)
- create_homework (with title, dueDate)
- create_workout (with title, date, time, duration)
- delete_task, delete_homework
- schedule_revision (with title, dueDate)
- create_override (with overrideDate, eventTitle, actionType, newRoom, newStartTime, newEndTime, newTitle, reason)
- delete_override (with entityId)
- save_memory (with memoryType, patternKey, patternValue, confidenceScore, isTemporary, expiresAt)
- delete_memory (with entityId)

## Action Rules
- NEVER execute actions silently. Always propose them and let the user approve.
- For actions, return a JSON block with the proposed actions.
- Only claim something happened if the database confirmed it (the client handles execution and reports back).
- If the user says "yes" or "do it" to a proposed action, the client will execute it.

## Response Format
For normal responses, just write natural text.
When you want to propose actions, include a JSON block at the END of your response:

\`\`\`actions
[{"type":"skip_workout","label":"Skip workout","entityId":"abc","entityType":"workout","data":{"reason":"User is tired"}}]
\`\`\`

Only include the actions JSON block when you are actually proposing actions. For pure information or conversation, just respond with text.

## What NOT To Do
- Do not silently change user data
- Do not create duplicate homework records
- Do not turn temporary instructions into permanent memory
- Do not use Week A/B to duplicate the whole life
- Do not make every response long or use headings for simple answers
- Do not constantly nag or manufacture insights
- Do not claim an action succeeded unless confirmed
- Do not force productivity into every free moment`;

function buildContextSummary(ctx: LifeContext): string {
  const parts: string[] = [];

  // Current time
  const now = new Date(ctx.now);
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  parts.push(`## Current Date & Time\n${dateStr} at ${timeStr} (local time)\nDay of week: ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][ctx.dayOfWeek]}\nWeek: ${ctx.weekType}${ctx.isHoliday ? " (Holiday)" : ""}`);

  // Today's schedule
  if (ctx.currentEvent) {
    const e = ctx.currentEvent;
    parts.push(`## Right Now\n${e.title} (${e.start_time}–${e.end_time})${e.room ? ` · Room ${e.room}` : ""}`);
  }
  if (ctx.nextEvent) {
    const e = ctx.nextEvent;
    parts.push(`## Next Event\n${e.title} at ${e.start_time}${e.room ? ` · Room ${e.room}` : ""}`);
  }
  if (ctx.remainingEvents && ctx.remainingEvents.length > 0) {
    const lines = ctx.remainingEvents.map((e: Record<string, unknown>) => `  ${e.start_time}–${e.end_time}: ${e.title}${e.room ? ` (Room ${e.room})` : ""}`);
    parts.push(`## Today's Remaining Schedule\n${lines.join("\n")}`);
  }
  if (ctx.todayEvents && ctx.todayEvents.length > 0 && !ctx.currentEvent) {
    const lines = ctx.todayEvents.map((e: Record<string, unknown>) => `  ${e.start_time}–${e.end_time}: ${e.title}${e.room ? ` (Room ${e.room})` : ""}`);
    parts.push(`## Today's Full Schedule\n${lines.join("\n")}`);
  }

  // Tomorrow
  if (ctx.tomorrowEvents && ctx.tomorrowEvents.length > 0) {
    const lines = ctx.tomorrowEvents.map((e: Record<string, unknown>) => `  ${e.start_time}–${e.end_time}: ${e.title}${e.room ? ` (Room ${e.room})` : ""}`);
    parts.push(`## Tomorrow's Schedule\n${lines.join("\n")}`);
  }

  // Homework
  const hwParts: string[] = [];
  if (ctx.overdueHomework && ctx.overdueHomework.length > 0) {
    hwParts.push(`Overdue: ${ctx.overdueHomework.map((h: Record<string, unknown>) => `${h.title} (due ${h.due_date})`).join(", ")}`);
  }
  if (ctx.dueTodayHomework && ctx.dueTodayHomework.length > 0) {
    hwParts.push(`Due today: ${ctx.dueTodayHomework.map((h: Record<string, unknown>) => `${h.title} (${h.estimated_time_min || 30}min)`).join(", ")}`);
  }
  if (ctx.dueTomorrowHomework && ctx.dueTomorrowHomework.length > 0) {
    hwParts.push(`Due tomorrow: ${ctx.dueTomorrowHomework.map((h: Record<string, unknown>) => `${h.title}`).join(", ")}`);
  }
  const otherHw = ctx.homework?.filter((h: Record<string, unknown>) => {
    const due = h.due_date as string;
    return !ctx.overdueHomework?.some((o: Record<string, unknown>) => o.id === h.id) &&
           !ctx.dueTodayHomework?.some((o: Record<string, unknown>) => o.id === h.id) &&
           !ctx.dueTomorrowHomework?.some((o: Record<string, unknown>) => o.id === h.id);
  });
  if (otherHw && otherHw.length > 0) {
    hwParts.push(`Later: ${otherHw.map((h: Record<string, unknown>) => `${h.title} (due ${h.due_date})`).join(", ")}`);
  }
  if (hwParts.length > 0) parts.push(`## Homework\n${hwParts.join("\n")}`);

  // Tests
  if (ctx.tests && ctx.tests.length > 0) {
    const lines = ctx.tests.slice(0, 5).map((t: Record<string, unknown>) => `  ${t.title} — ${t.exam_date} · ${t.revision_progress || 0}% revised`);
    parts.push(`## Upcoming Tests\n${lines.join("\n")}`);
  }

  // Tasks
  if (ctx.tasks && ctx.tasks.length > 0) {
    const lines = ctx.tasks.slice(0, 8).map((t: Record<string, unknown>) => `  ${t.title}${t.priority >= 4 ? " (high priority)" : ""}${t.due_date ? ` — due ${t.due_date}` : ""}${t.is_fixed ? " (fixed)" : ""}`);
    parts.push(`## Tasks\n${lines.join("\n")}`);
  }
  if (ctx.overdueTasks && ctx.overdueTasks.length > 0) {
    parts.push(`### Overdue Tasks\n${ctx.overdueTasks.map((t: Record<string, unknown>) => t.title).join(", ")}`);
  }

  // Routines
  if (ctx.todayRoutines && ctx.todayRoutines.length > 0) {
    const lines = ctx.todayRoutines.map((r: Record<string, unknown>) => `  ${r.start_time || ""}: ${r.name}${r.description ? ` — ${r.description}` : ""}`);
    parts.push(`## Today's Routines\n${lines.join("\n")}`);
  }

  // Workouts
  if (ctx.todayWorkouts && ctx.todayWorkouts.length > 0) {
    const lines = ctx.todayWorkouts.map((w: Record<string, unknown>) => `  ${w.title}${w.scheduled_time ? ` at ${w.scheduled_time}` : ""} — ${w.status}${w.duration_min ? ` (${w.duration_min}min)` : ""}`);
    parts.push(`## Today's Workouts\n${lines.join("\n")}`);
  }

  // Logopède
  if (ctx.todayLogopede && ctx.todayLogopede.length > 0) {
    const lines = ctx.todayLogopede.map((s: Record<string, unknown>) => `  ${s.session_type} — ${s.status}`);
    parts.push(`## Logopède Sessions\n${lines.join("\n")}`);
  }

  // Daily log / sleep
  if (ctx.todayDailyLog) {
    const log = ctx.todayDailyLog;
    const sleep = log.estimated_sleep_min || log.sleep_duration_min;
    parts.push(`## Today's Daily Log\nSleep: ${sleep || "not logged"} min · Mood: ${log.mood || "—"} · Energy: ${log.energy || "—"} · Rating: ${log.daily_rating || "—"}`);
  }
  if (ctx.recentLogs && ctx.recentLogs.length > 0) {
    const avgSleep = ctx.recentLogs.reduce((sum: number, l: Record<string, unknown>) => sum + ((l.estimated_sleep_min as number) || (l.sleep_duration_min as number) || 0), 0) / ctx.recentLogs.length;
    if (avgSleep > 0) parts.push(`### Recent Sleep Average\n${Math.round(avgSleep)} min over last ${ctx.recentLogs.length} days`);
  }

  // Goals & Projects
  if (ctx.goals && ctx.goals.length > 0) {
    const lines = ctx.goals.slice(0, 5).map((g: Record<string, unknown>) => `  ${g.title}${g.progress ? ` (${g.progress}%)` : ""}${g.target_date ? ` — target ${g.target_date}` : ""}`);
    parts.push(`## Goals\n${lines.join("\n")}`);
  }
  if (ctx.projects && ctx.projects.length > 0) {
    const lines = ctx.projects.slice(0, 5).map((p: Record<string, unknown>) => `  ${p.title} — ${p.status}${p.target_date ? ` (target ${p.target_date})` : ""}`);
    parts.push(`## Projects\n${lines.join("\n")}`);
  }

  // Overrides
  if (ctx.todayOverrides && ctx.todayOverrides.length > 0) {
    const lines = ctx.todayOverrides.map((o: Record<string, unknown>) => `  ${o.event_title}: ${o.action_type}${o.new_room ? ` → Room ${o.new_room}` : ""}`);
    parts.push(`## Today's Schedule Overrides\n${lines.join("\n")}`);
  }

  // Memory
  if (ctx.explicitPreferences && ctx.explicitPreferences.length > 0) {
    const lines = ctx.explicitPreferences.map((m: Record<string, unknown>) => `  ${m.pattern_value}`);
    parts.push(`## Explicit Preferences (user told you these)\n${lines.join("\n")}`);
  }
  if (ctx.learnedPatterns && ctx.learnedPatterns.length > 0) {
    const lines = ctx.learnedPatterns.map((m: Record<string, unknown>) => `  ${m.pattern_value} (confidence: ${Math.round((m.confidence_score as number) * 100)}%)`);
    parts.push(`## Learned Patterns (from behaviour)\n${lines.join("\n")}`);
  }
  if (ctx.temporaryContext && ctx.temporaryContext.length > 0) {
    const lines = ctx.temporaryContext.map((m: Record<string, unknown>) => `  ${m.pattern_value}${m.expires_at ? ` (expires ${m.expires_at})` : ""}`);
    parts.push(`## Temporary Context (current state, not permanent)\n${lines.join("\n")}`);
  }

  // Settings
  if (ctx.settings) {
    const s = ctx.settings;
    const settingsParts: string[] = [];
    if (s.bedtime) settingsParts.push(`Bedtime: ${s.bedtime}`);
    if (s.wake_time) settingsParts.push(`Wake: ${s.wake_time}`);
    if (s.logopede_morning_time) settingsParts.push(`Logopède morning: ${s.logopede_morning_time}`);
    if (s.logopede_evening_time) settingsParts.push(`Logopède evening: ${s.logopede_evening_time}`);
    if (settingsParts.length > 0) parts.push(`## User Settings\n${settingsParts.join(" · ")}`);
  }

  // AI preferences
  if (ctx.preferences) {
    const p = ctx.preferences;
    const prefParts: string[] = [];
    if (p.planning_mode) prefParts.push(`Planning mode: ${p.planning_mode}`);
    if (p.preferred_work_start) prefParts.push(`Preferred work start: ${p.preferred_work_start}`);
    if (p.preferred_work_end) prefParts.push(`Preferred work end: ${p.preferred_work_end}`);
    if (p.challenge_level) prefParts.push(`Challenge level: ${p.challenge_level}`);
    if (prefParts.length > 0) parts.push(`## AI Planning Preferences\n${prefParts.join(" · ")}`);
  }

  return parts.join("\n\n");
}

function extractActions(text: string): { text: string; actions: AIAction[] } {
  const actionMatch = text.match(/```actions\n([\s\S]*?)```/);
  if (actionMatch) {
    try {
      const actions = JSON.parse(actionMatch[1].trim()) as AIAction[];
      const cleanText = text.replace(/```actions\n[\s\S]*?```/, "").trim();
      return { text: cleanText, actions };
    } catch {
      // If JSON parse fails, return text as-is
      const cleanText = text.replace(/```actions\n[\s\S]*?```/, "").trim();
      return { text: cleanText, actions: [] };
    }
  }
  return { text, actions: [] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get OpenAI API key from app_secrets
    const { data: secretData } = await supabase
      .from("app_secrets")
      .select("value")
      .eq("key", "openai_api_key")
      .maybeSingle();

    const apiKey = (secretData as { value?: string })?.value;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured. Add it in Settings." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { context: LifeContext };
    const ctx = body.context;

    // Build context summary
    const contextSummary = buildContextSummary(ctx);

    // Build conversation messages
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `## Your Current Life OS Context\n\n${contextSummary}` },
    ];

    // Add conversation history (last 10 turns)
    if (ctx.conversationHistory && ctx.conversationHistory.length > 0) {
      const recent = ctx.conversationHistory.slice(-20);
      for (const msg of recent) {
        messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    // Add the current user message
    messages.push({ role: "user", content: ctx.userMessage });

    // Call OpenAI
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${openaiRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    const assistantText = openaiData.choices?.[0]?.message?.content || "I'm not sure how to help with that.";

    // Extract any proposed actions
    const { text, actions } = extractActions(assistantText);

    return new Response(JSON.stringify({ text, actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
