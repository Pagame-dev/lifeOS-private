import {
  fmtTime, fmtTimeShort, fmtRelativeDate, fmtDate, fmtDuration,
  timeToMinutes, todayKey, addDays, daysUntil,
  type LifeContext,
} from './ai-context';
import type {
  AIAction, ActionResult,
} from './ai-actions';
import { executeAction, needsConfirmation } from './ai-actions';
import type { Homework, Task, TestExam, Workout, TimetableEvent } from '@/lib/types';

export interface ConversationTurn {
  userMessage: string;
  assistantResponse: string;
  actions?: AIAction[];
  actionResults?: ActionResult[];
  timestamp: Date;
}

interface ConversationState {
  turns: ConversationTurn[];
  pendingActions?: AIAction[];
  topicContext?: string;
  planningMode: 'balanced' | 'productive' | 'relaxed';
  temporaryState: {
    tired?: boolean;
    notHomeUntil?: string | null;
    skipWorkout?: boolean;
    customInstruction?: string | null;
  };
}

const state: ConversationState = {
  turns: [],
  planningMode: 'balanced',
  temporaryState: {},
};

export function resetConversation() {
  state.turns = [];
  state.pendingActions = undefined;
  state.topicContext = undefined;
  state.temporaryState = {};
  state.planningMode = 'balanced';
}

export function getConversationHistory(): ConversationTurn[] {
  return state.turns;
}

export interface AIResponse {
  text: string;
  actions?: AIAction[];
  actionResults?: ActionResult[];
}

export async function processMessage(userMessage: string, ctx: LifeContext): Promise<AIResponse> {
  const q = userMessage.toLowerCase().trim();
  updateTemporaryState(q, ctx);
  const intent = detectIntent(q, state, ctx);

  let response: AIResponse;

  switch (intent.type) {
    case 'greeting':
      response = handleGreeting(ctx);
      break;
    case 'help':
      response = handleHelp();
      break;
    case 'correct_ai':
      response = handleCorrection(intent, ctx);
      break;
    case 'confirm_action':
      response = await handleConfirmAction(ctx);
      break;
    case 'cancel_action':
      response = handleCancelAction();
      break;
    case 'briefing':
      response = handleBriefing(ctx);
      break;
    case 'plan_evening':
      response = handlePlanEvening(ctx);
      break;
    case 'replan':
      response = handleReplan(ctx);
      break;
    case 'what_today':
      response = handleWhatToday(ctx);
      break;
    case 'what_tomorrow':
      response = handleWhatTomorrow(ctx);
      break;
    case 'what_this_week':
      response = handleWhatThisWeek(ctx);
      break;
    case 'prioritise':
      response = handlePrioritise(ctx);
      break;
    case 'running_late':
      response = handleRunningLate(ctx);
      break;
    case 'homework':
      response = handleHomeworkQuery(ctx);
      break;
    case 'tests':
      response = handleTestsQuery(ctx);
      break;
    case 'tasks':
      response = handleTasksQuery(ctx);
      break;
    case 'schedule':
      response = handleScheduleQuery(ctx);
      break;
    case 'workout_advice':
      response = handleWorkoutAdvice(ctx);
      break;
    case 'sleep':
      response = handleSleep(ctx);
      break;
    case 'stress':
      response = handleStress(ctx);
      break;
    case 'routines':
      response = handleRoutines(ctx);
      break;
    case 'goals':
      response = handleGoals(ctx);
      break;
    case 'add_task':
      response = await handleAddTask(intent, ctx);
      break;
    case 'add_homework':
      response = await handleAddHomework(intent, ctx);
      break;
    case 'add_revision':
      response = await handleAddRevision(intent, ctx);
      break;
    case 'move_item':
      response = await handleMoveItem(intent, ctx);
      break;
    case 'complete_item':
      response = await handleCompleteItem(intent, ctx);
      break;
    case 'skip_workout':
      response = await handleSkipWorkout(intent, ctx);
      break;
    case 'set_mode':
      response = handleSetMode(intent);
      break;
    case 'forget':
      response = handleForget(intent);
      break;
    case 'free_time':
      response = handleFreeTime(ctx);
      break;
    default:
      response = handleFallback(ctx);
  }

  state.turns.push({
    userMessage,
    assistantResponse: response.text,
    actions: response.actions,
    timestamp: new Date(),
  });

  if (state.turns.length > 20) state.turns.shift();

  return response;
}

function updateTemporaryState(q: string, _ctx: LifeContext) {
  if (/i'?m tired|i'?m exhausted|i need rest|no energy|drained|burnt out/.test(q)) {
    state.temporaryState.tired = true;
  }
  if (/i'?m not home|i won'?t be home|i'?m out until|not back until/.test(q)) {
    const timeMatch = q.match(/(\d{1,2}[:.]?\d*)\s*(am|pm)?/);
    if (timeMatch) {
      state.temporaryState.notHomeUntil = timeMatch[0];
    }
  }
  if (/don'?t want to work out|skip.*workout|no workout|skip.*gym/.test(q)) {
    state.temporaryState.skipWorkout = true;
  }
  if (/make today relaxed|relaxed mode|take it easy|light day/.test(q)) {
    state.planningMode = 'relaxed';
    state.temporaryState.customInstruction = 'relaxed';
  }
  if (/make today productive|productive mode|push today|crush it/.test(q)) {
    state.planningMode = 'productive';
    state.temporaryState.customInstruction = 'productive';
  }
  if (/forget that|never mind|cancel that|actually don'?t/.test(q)) {
    state.pendingActions = undefined;
  }
}

interface DetectedIntent {
  type: string;
  data?: Record<string, unknown>;
}

function detectIntent(q: string, conv: ConversationState, _ctx: LifeContext): DetectedIntent {
  if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)\b/.test(q)) return { type: 'greeting' };
  if (/what can you do|help me|how do you work/.test(q)) return { type: 'help' };
  if (/you'?re wrong|that'?s wrong|that'?s not right|i don'?t have|no i don'?t|incorrect/.test(q)) return { type: 'correct_ai' };

  if (conv.pendingActions && conv.pendingActions.length > 0) {
    if (/^yes|yeah|yep|sure|do it|go ahead|confirm|ok|okay/.test(q)) return { type: 'confirm_action' };
    if (/^no|nope|cancel|don'?t|stop/.test(q)) return { type: 'cancel_action' };
  }

  if (/briefing|what'?s my day|give me.*overview|morning briefing|daily briefing/.test(q)) return { type: 'briefing' };
  if (/replan.*evening|replan.*night|replan.*day|adjust.*plan|redo.*plan/.test(q)) return { type: 'replan' };
  if (/plan.*evening|plan.*night|what tonight|what should i do tonight|tonight'?s plan/.test(q)) return { type: 'plan_evening' };

  if (/what.*tomorrow|tomorrow.*schedule|what.*on.*tomorrow/.test(q)) return { type: 'what_tomorrow' };
  if (/this week|rest of.*week|upcoming.*days|what'?s coming/.test(q)) return { type: 'what_this_week' };
  if (/what.*today|today'?s schedule|what.*on.*today|what'?s on today/.test(q)) return { type: 'what_today' };

  if (/priorit|what should i do|what to do|what.*focus|focus on|most important/.test(q)) return { type: 'prioritise' };
  if (/running late|behind schedule|missed|i'?m late|am i late/.test(q)) return { type: 'running_late' };
  if (/homework|hw|assignment/.test(q)) return { type: 'homework' };
  if (/test|exam|revision/.test(q)) return { type: 'tests' };
  if (/task|todo|to-do/.test(q)) return { type: 'tasks' };
  if (/schedule|timetable|what.*classes|what.*lessons/.test(q)) return { type: 'schedule' };
  if (/workout|exercise|gym|training|should i.*work.*out/.test(q)) return { type: 'workout_advice' };
  if (/sleep|tired|bedtime|rest|energy/.test(q)) return { type: 'sleep' };
  if (/stress|overwhelm|anxious|anxiety|pressure|too much/.test(q)) return { type: 'stress' };
  if (/routine|morning routine|evening routine/.test(q)) return { type: 'routines' };
  if (/goal|project/.test(q)) return { type: 'goals' };

  if (/add.*task|create.*task|new task|remind me/.test(q)) {
    const titleMatch = userMessageExtract(q, /(?:add|create|new)\s+(?:a\s+)?task\s+(?:to\s+|called\s+|named\s+|for\s+)?["']?(.+?)["']?(?:\s+(?:for|due|by|on)\s+|$)/i);
    const dateMatch = q.match(/(?:for|due|by|on)\s+(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    return { type: 'add_task', data: { title: titleMatch, dueDate: dateMatch ? resolveDateWord(dateMatch[1]) : undefined } };
  }
  if (/add.*homework|new homework|create.*homework/.test(q)) {
    const titleMatch = userMessageExtract(q, /(?:add|create|new)\s+homework\s+(?:called\s+|named\s+|for\s+)?["']?(.+?)["']?(?:\s+(?:for|due|by|on)\s+|$)/i);
    const dateMatch = q.match(/(?:for|due|by|on)\s+(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    return { type: 'add_homework', data: { title: titleMatch, dueDate: dateMatch ? resolveDateWord(dateMatch[1]) : todayKey() } };
  }
  if (/add.*revision|schedule.*revision|plan.*revision|revise.*for/.test(q)) {
    const subjectMatch = q.match(/(?:revision|revise)\s+(?:for\s+)?(.+?)(?:\s+(?:tomorrow|today|on|by|for)\s+|$)/);
    const dateMatch = q.match(/(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    return { type: 'add_revision', data: { title: subjectMatch?.[1] || 'revision', dueDate: dateMatch ? resolveDateWord(dateMatch[1]) : todayKey() } };
  }
  if (/move.*homework|move.*task|reschedule|push.*to|push.*back|move.*to/.test(q)) {
    return { type: 'move_item', data: {} };
  }
  if (/mark.*complete|mark.*done|complete.*task|finish.*homework|done.*with/.test(q)) {
    return { type: 'complete_item', data: {} };
  }
  if (/skip.*workout|skip.*gym|cancel.*workout/.test(q)) {
    return { type: 'skip_workout', data: {} };
  }
  if (/relaxed|productive mode|balanced mode/.test(q)) return { type: 'set_mode', data: { mode: q.includes('relaxed') ? 'relaxed' : q.includes('productive') ? 'productive' : 'balanced' } };
  if (/forget that|never mind|cancel that|actually don'?t/.test(q)) return { type: 'forget' };
  if (/free time|free period|spare time|gap|break/.test(q)) return { type: 'free_time' };

  return { type: 'fallback' };
}

function userMessageExtract(_q: string, _pattern: RegExp): string | undefined {
  return undefined;
}

function resolveDateWord(word: string): string {
  const lower = word.toLowerCase();
  const tKey = todayKey();
  if (lower === 'today') return tKey;
  if (lower === 'tomorrow') return addDays(tKey, 1);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = days.indexOf(lower);
  if (idx >= 0) {
    const todayDow = new Date().getDay();
    let diff = idx - todayDow;
    if (diff <= 0) diff += 7;
    return addDays(tKey, diff);
  }
  return tKey;
}

function priorityRank(item: { kind: string; priority: number; dueIn: number; isFixed?: boolean }): number {
  if (item.isFixed) return 100;
  if (item.dueIn < 0) return 90 + item.priority;
  if (item.dueIn === 0) return 80 + item.priority;
  if (item.dueIn === 1) return 70 + item.priority;
  return 50 + item.priority - item.dueIn;
}

function buildPriorityList(ctx: LifeContext): Array<{ kind: string; title: string; priority: number; dueIn: number; isFixed: boolean; id: string; detail: string }> {
  const items: Array<{ kind: string; title: string; priority: number; dueIn: number; isFixed: boolean; id: string; detail: string }> = [];

  for (const e of ctx.remainingEvents) {
    items.push({
      kind: 'event', title: e.title, priority: 10, dueIn: 0, isFixed: true, id: e.id,
      detail: `${fmtTimeShort(e.start_time)}–${fmtTimeShort(e.end_time)}${e.room ? ` · Room ${e.room}` : ''}`,
    });
  }
  for (const s of ctx.todayLogopede) {
    if (s.status !== 'completed') items.push({ kind: 'logopede', title: `Logopède ${s.session_type}`, priority: 9, dueIn: 0, isFixed: true, id: s.id, detail: s.session_type === 'morning' ? 'Morning session' : 'Evening session' });
  }
  for (const hw of ctx.homework) {
    const di = daysUntil(hw.due_date);
    items.push({ kind: 'homework', title: hw.title, priority: hw.priority, dueIn: di, isFixed: false, id: hw.id, detail: `Due ${fmtRelativeDate(hw.due_date)}` });
  }
  for (const t of ctx.tests) {
    const di = daysUntil(t.exam_date);
    if (di <= 7) items.push({ kind: 'test', title: t.title, priority: 8 + (5 - t.revision_progress / 20), dueIn: di, isFixed: false, id: t.id, detail: `${fmtRelativeDate(t.exam_date)} · ${t.revision_progress}% revised` });
  }
  for (const task of ctx.tasks) {
    items.push({ kind: 'task', title: task.title, priority: task.priority, dueIn: task.due_date ? daysUntil(task.due_date) : 999, isFixed: task.is_fixed, id: task.id, detail: task.due_date ? `Due ${fmtRelativeDate(task.due_date)}` : 'No deadline' });
  }
  for (const w of ctx.todayWorkouts) {
    if (w.status === 'planned') items.push({ kind: 'workout', title: w.title, priority: 2, dueIn: 0, isFixed: false, id: w.id, detail: w.scheduled_time ? `${fmtTimeShort(w.scheduled_time)}` : 'Scheduled today' });
  }

  return items.sort((a, b) => priorityRank(b) - priorityRank(a));
}

function hasFreeTime(ctx: LifeContext, afterMinutes: number, beforeMinutes: number): number {
  let freeStart = afterMinutes;
  for (const e of ctx.remainingEvents) {
    const eStart = timeToMinutes(e.start_time);
    const eEnd = timeToMinutes(e.end_time);
    if (eStart >= freeStart && eStart < beforeMinutes) {
      if (eStart > freeStart) {
        // gap before this event
      }
      freeStart = Math.max(freeStart, eEnd);
    }
  }
  return Math.max(0, beforeMinutes - freeStart);
}

function getNextFreeSlot(ctx: LifeContext, afterMinutes: number): { start: number; end: number; duration: number } | null {
  const occupied: Array<[number, number]> = ctx.remainingEvents
    .map((e) => [timeToMinutes(e.start_time), timeToMinutes(e.end_time)] as [number, number])
    .filter(([s]) => s >= afterMinutes)
    .sort((a, b) => a[0] - b[0]);

  if (occupied.length === 0) return { start: afterMinutes, end: 22 * 60, duration: 22 * 60 - afterMinutes };

  let cursor = afterMinutes;
  for (const [start, end] of occupied) {
    if (start > cursor) return { start: cursor, end: start, duration: start - cursor };
    cursor = Math.max(cursor, end);
  }
  if (cursor < 22 * 60) return { start: cursor, end: 22 * 60, duration: 22 * 60 - cursor };
  return null;
}

function handleGreeting(ctx: LifeContext): AIResponse {
  const time = ctx.currentMinutes;
  let timeGreeting = 'Hey';
  if (time < 12 * 60) timeGreeting = 'Good morning';
  else if (time < 17 * 60) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';

  if (ctx.currentEvent) {
    return { text: `${timeGreeting}! You're in ${ctx.currentEvent.title} right now — it ends at ${fmtTime(ctx.currentEvent.end_time)}.${ctx.nextEvent ? ` After that, ${ctx.nextEvent.title} at ${fmtTime(ctx.nextEvent.start_time)}.` : ''} What can I help with?` };
  }
  if (ctx.nextEvent) {
    const gap = timeToMinutes(ctx.nextEvent.start_time) - ctx.currentMinutes;
    if (gap > 30) return { text: `${timeGreeting}! You're free until ${fmtTime(ctx.nextEvent.start_time)} when you have ${ctx.nextEvent.title}. Plenty of time — want me to suggest what to focus on?` };
    return { text: `${timeGreeting}! Next up is ${ctx.nextEvent.title} at ${fmtTime(ctx.nextEvent.start_time)}${ctx.nextEvent.room ? ` in room ${ctx.nextEvent.room}` : ''}.` };
  }
  return { text: `${timeGreeting}! Nothing scheduled for the rest of today. ${ctx.homework.length > 0 || ctx.tasks.length > 0 ? 'You have some work to do though — want me to prioritise?' : 'Looks like a clean day. Enjoy it!'}` };
}

function handleHelp(): AIResponse {
  return { text: `I'm your Life OS assistant. I can see your full schedule, tasks, homework, tests, routines, goals, and daily logs — and I can take actions for you.\n\nTry things like:\n• "What should I focus on tonight?"\n• "Do I have any tests coming up?"\n• "Move my homework to tomorrow"\n• "Add revision for Maths tomorrow"\n• "Should I work out tonight?"\n• "Replan my evening"\n• "Mark my Chemistry homework complete"\n\nI'll use your actual data, not make things up.` };
}

function handleCorrection(_intent: DetectedIntent, ctx: LifeContext): AIResponse {
  const lastTurn = state.turns[state.turns.length - 1];
  state.temporaryState.tired = state.temporaryState.tired;
  if (lastTurn) {
    if (lastTurn.assistantResponse.toLowerCase().includes('test')) {
      return { text: `You're right, sorry about that. I don't see any upcoming tests in your Life OS. Let me refocus — ${ctx.dueTodayHomework.length > 0 ? `your priority should be ${ctx.dueTodayHomework[0].title} which is due today.` : ctx.homework.length > 0 ? `your most urgent homework is ${ctx.homework[0].title} due ${fmtRelativeDate(ctx.homework[0].due_date)}.` : 'with no tests or urgent homework, you can take it a bit easier.'}` };
    }
    return { text: `Sorry, I got that wrong. Let me look at what's actually in your Life OS. ${ctx.homework.length > 0 ? `Right now you have ${ctx.homework.length} homework item${ctx.homework.length > 1 ? 's' : ''} pending` : 'You have no pending homework'}${ctx.tasks.length > 0 ? `, and ${ctx.tasks.length} task${ctx.tasks.length > 1 ? 's' : ''}` : ''}. What would you like to focus on?` };
  }
  return { text: `Sorry about that. What's actually going on? I'll work from your real data.` };
}

async function handleConfirmAction(ctx: LifeContext): Promise<AIResponse> {
  if (!state.pendingActions || state.pendingActions.length === 0) {
    return { text: `There's nothing pending to confirm.` };
  }
  const results: ActionResult[] = [];
  for (const action of state.pendingActions) {
    const result = await executeAction(action);
    results.push(result);
  }
  const successCount = results.filter((r) => r.success).length;
  state.pendingActions = undefined;

  if (successCount === results.length) {
    return { text: `Done. ${results.map((r) => r.message).join(', ')}.`, actionResults: results };
  }
  return { text: `I ran ${successCount} of ${results.length} actions. ${results.filter((r) => !r.success).map((r) => r.message).join('; ')}`, actionResults: results };
}

function handleCancelAction(): AIResponse {
  state.pendingActions = undefined;
  return { text: `No problem, I've cancelled that.` };
}

function handleBriefing(ctx: LifeContext): AIResponse {
  const parts: string[] = [];
  const dateStr = ctx.now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  parts.push(`**${dateStr}** · Week ${ctx.weekType}${ctx.isHoliday ? ' · Holiday' : ''}`);

  if (ctx.currentEvent) {
    parts.push(`Right now: ${ctx.currentEvent.title} (until ${fmtTime(ctx.currentEvent.end_time)})`);
  } else if (ctx.remainingEvents.length > 0) {
    parts.push(`Next: ${ctx.remainingEvents[0].title} at ${fmtTime(ctx.remainingEvents[0].start_time)}`);
  } else {
    parts.push(`No more classes today.`);
  }

  const urgent: string[] = [];
  if (ctx.overdueHomework.length > 0) urgent.push(`${ctx.overdueHomework.length} overdue homework`);
  if (ctx.dueTodayHomework.length > 0) urgent.push(`${ctx.dueTodayHomework.length} due today`);
  if (ctx.overdueTasks.length > 0) urgent.push(`${ctx.overdueTasks.length} overdue task${ctx.overdueTasks.length > 1 ? 's' : ''}`);
  const closeTest = ctx.tests.find((t) => daysUntil(t.exam_date) <= 3);
  if (closeTest) urgent.push(`${closeTest.title} in ${daysUntil(closeTest.exam_date)} day${daysUntil(closeTest.exam_date) !== 1 ? 's' : ''}`);

  if (urgent.length > 0) {
    parts.push(`**Needs attention:** ${urgent.join(', ')}`);
  }

  const nextFree = getNextFreeSlot(ctx, ctx.currentMinutes);
  if (nextFree && nextFree.duration > 30) {
    parts.push(`Free time: ${fmtTimeShort(`${Math.floor(nextFree.start / 60)}:${String(nextFree.start % 60).padStart(2, '0')}`)} for about ${fmtDuration(nextFree.duration)}`);
  }

  if (urgent.length === 0 && !closeTest) {
    parts.push(`Nothing urgent. ${ctx.homework.length > 0 || ctx.tasks.length > 0 ? "Work through things at your own pace." : "Consider it a lighter day."}`);
  }

  return { text: parts.join('\n') };
}

function handlePlanEvening(ctx: LifeContext): AIResponse {
  const eveningStart = ctx.currentMinutes > 17 * 60 ? ctx.currentMinutes : 17 * 60;
  const eveningEnd = 22 * 60;
  const freeSlot = getNextFreeSlot(ctx, eveningStart);

  const eveningEvents = ctx.remainingEvents.filter((e) => timeToMinutes(e.start_time) >= 17 * 60);
  const eveningLogopede = ctx.todayLogopede.filter((s) => s.session_type === 'evening' && s.status !== 'completed');

  const planItems: string[] = [];
  const actions: AIAction[] = [];

  if (state.temporaryState.tired) {
    planItems.push(`Since you're tired, I'd keep tonight light.`);
  }

  if (eveningEvents.length > 0) {
    for (const e of eveningEvents) {
      planItems.push(`${fmtTimeShort(e.start_time)}–${fmtTimeShort(e.end_time)}: ${e.title}`);
    }
  }
  if (eveningLogopede.length > 0) {
    planItems.push(`${ctx.settings?.logopede_evening_time || '19:00'}: Logopède evening session`);
  }

  const hwDue = [...ctx.dueTodayHomework, ...ctx.dueTomorrowHomework];
  if (hwDue.length > 0 && freeSlot) {
    const first = hwDue[0];
    const hwMin = first.estimated_duration_min || 45;
    if (freeSlot.duration >= hwMin || state.planningMode === 'productive') {
      planItems.push(`${fmtTimeShort(`${Math.floor(freeSlot.start / 60)}:${String(freeSlot.start % 60).padStart(2, '0')}`)}: ${first.title} (due ${fmtRelativeDate(first.due_date)})`);
    } else {
      planItems.push(`Homework: ${first.title} — but you may not have time tonight. Want to move it?`);
    }
  }

  const closeTest = ctx.tests.find((t) => daysUntil(t.exam_date) <= 2);
  if (closeTest && freeSlot && freeSlot.duration > 45 && !state.temporaryState.tired) {
    planItems.push(`Revision: ${closeTest.title} (${closeTest.revision_progress}% done) — even 25 min helps`);
  }

  const workout = ctx.todayWorkouts.find((w) => w.status === 'planned' && (!w.scheduled_time || timeToMinutes(w.scheduled_time) >= 17 * 60));
  if (workout && !state.temporaryState.skipWorkout && !state.temporaryState.tired) {
    if (freeSlot && freeSlot.duration > 60 && state.planningMode !== 'relaxed') {
      planItems.push(`Workout: ${workout.title}${workout.scheduled_time ? ` at ${fmtTimeShort(workout.scheduled_time)}` : ''}`);
    } else if (state.temporaryState.tired) {
      planItems.push(`Workout: I'd skip it tonight since you're tired. Rest is more important.`);
      actions.push({ type: 'skip_workout', label: 'Skip workout', entityId: workout.id, entityType: 'workout', data: { reason: 'Skipped — user is tired' } });
    } else {
      planItems.push(`Workout: ${workout.title} — only if you have energy after the essentials.`);
    }
  } else if (workout && state.temporaryState.skipWorkout) {
    planItems.push(`Workout: skipping as you asked.`);
    actions.push({ type: 'skip_workout', label: 'Skip workout', entityId: workout.id, entityType: 'workout', data: { reason: 'User requested' } });
  }

  for (const r of ctx.todayRoutines) {
    if (r.start_time && timeToMinutes(r.start_time) >= 17 * 60) {
      planItems.push(`${fmtTimeShort(r.start_time)}: ${r.name}`);
    }
  }

  if (planItems.length === 0) {
    return { text: `Your evening is open. ${state.temporaryState.tired ? 'Since you\'re tired, I\'d just rest and maybe do your evening routine. No need to force productivity.' : 'Nothing urgent — I\'d leave it free rather than creating work. If you want to get ahead on something, I can suggest what\'s most useful.'}` };
  }

  return { text: `Here's what I'd suggest for tonight:\n\n${planItems.map((p) => `• ${p}`).join('\n')}\n\n${state.temporaryState.tired ? 'Rest is a legitimate part of the plan — don\'t push it.' : 'Free time between these is yours. I\'m not scheduling every minute.'}`, actions };
}

function handleReplan(ctx: LifeContext): AIResponse {
  state.temporaryState.tired = state.temporaryState.tired;
  return handlePlanEvening(ctx);
}

function handleWhatToday(ctx: LifeContext): AIResponse {
  if (ctx.todayEvents.length === 0 && ctx.todayLogopede.length === 0) {
    return { text: `Nothing scheduled today${ctx.isHoliday ? ' — it\'s a holiday' : ''}. ${ctx.homework.length > 0 ? `You do have ${ctx.homework.length} homework to work through.` : 'Free day!'}` };
  }
  const lines: string[] = [];
  for (const e of ctx.todayEvents) {
    const isNow = ctx.currentTime >= e.start_time && ctx.currentTime < e.end_time;
    lines.push(`${fmtTimeShort(e.start_time)}–${fmtTimeShort(e.end_time)}  ${e.title}${e.room ? ` · Room ${e.room}` : ''}${isNow ? '  ← now' : ''}`);
  }
  for (const s of ctx.todayLogopede) {
    lines.push(`${s.session_type === 'morning' ? 'Morning' : 'Evening'}  Logopède ${s.status === 'completed' ? '✓' : ''}`);
  }
  return { text: lines.join('\n') };
}

function handleWhatTomorrow(ctx: LifeContext): AIResponse {
  const lines: string[] = [];
  if (ctx.tomorrowEvents.length > 0) {
    for (const e of ctx.tomorrowEvents) {
      lines.push(`${fmtTimeShort(e.start_time)}–${fmtTimeShort(e.end_time)}  ${e.title}${e.room ? ` · Room ${e.room}` : ''}`);
    }
  }
  if (ctx.tomorrowLogopede.length > 0) {
    for (const s of ctx.tomorrowLogopede) lines.push(`${s.session_type === 'morning' ? 'Morning' : 'Evening'}  Logopède`);
  }
  if (ctx.tomorrowWorkouts.length > 0) {
    for (const w of ctx.tomorrowWorkouts) lines.push(`${w.scheduled_time ? fmtTimeShort(w.scheduled_time) : 'TBD'}  ${w.title}`);
  }
  const tmrwHw = ctx.homework.filter((h) => daysUntil(h.due_date) === 1);
  if (tmrwHw.length > 0) lines.push(`Homework due: ${tmrwHw.map((h) => h.title).join(', ')}`);

  if (lines.length === 0) return { text: `Tomorrow looks clear — nothing scheduled.` };
  return { text: `**Tomorrow:**\n${lines.map((l) => `• ${l}`).join('\n')}` };
}

function handleWhatThisWeek(ctx: LifeContext): AIResponse {
  const upcomingTests = ctx.tests.filter((t) => daysUntil(t.exam_date) <= 7);
  const upcomingHw = ctx.homework.filter((h) => daysUntil(h.due_date) <= 7);
  const lines: string[] = [];

  if (upcomingHw.length > 0) {
    lines.push(`Homework due this week: ${upcomingHw.length}`);
    for (const h of upcomingHw.slice(0, 3)) lines.push(`  • ${h.title} — ${fmtRelativeDate(h.due_date)}`);
  }
  if (upcomingTests.length > 0) {
    lines.push(`Tests this week: ${upcomingTests.length}`);
    for (const t of upcomingTests) lines.push(`  • ${t.title} — ${fmtRelativeDate(t.exam_date)} (${t.revision_progress}% revised)`);
  }
  if (ctx.overdueHomework.length > 0) lines.push(`Overdue: ${ctx.overdueHomework.map((h) => h.title).join(', ')}`);

  if (lines.length === 0) return { text: `This week looks manageable — nothing urgent on the horizon.` };
  return { text: lines.join('\n') };
}

function handlePrioritise(ctx: LifeContext): AIResponse {
  const items = buildPriorityList(ctx);
  if (items.length === 0) return { text: `You're all caught up. Nothing needs your attention right now — this is a good time to rest or get ahead.` };

  const top = items.slice(0, 4);
  const lines = top.map((item, i) => {
    const prefix = i === 0 ? '**Focus on this first:**' : `${i + 1}.`;
    return `${prefix} ${item.title} — ${item.detail}`;
  });

  let suffix = '';
  if (state.temporaryState.tired) suffix = `\n\nSince you're tired, I'd only do the top 1-2 and leave the rest. Rest counts.`;
  else if (items.some((i) => i.kind === 'workout') && items.filter((i) => i.kind === 'homework' || i.kind === 'test').length >= 2) {
    suffix = `\n\nIf the day gets tight, I'd drop the workout before the homework or revision.`;
  }

  return { text: `${lines.join('\n')}${suffix}` };
}

function handleRunningLate(ctx: LifeContext): AIResponse {
  if (!ctx.currentEvent && !ctx.nextEvent) {
    return { text: `You're not behind on anything — no events right now. Is there something specific you're worried about?` };
  }
  const parts: string[] = [];
  if (ctx.currentEvent) {
    const endMin = timeToMinutes(ctx.currentEvent.end_time);
    const remaining = endMin - ctx.currentMinutes;
    parts.push(`You should be in ${ctx.currentEvent.title} right now — ${remaining > 0 ? `${remaining} min left` : 'it\'s ending'}.`);
  }
  if (ctx.nextEvent) {
    const gap = timeToMinutes(ctx.nextEvent.start_time) - ctx.currentMinutes;
    if (gap > 0) parts.push(`Next: ${ctx.nextEvent.title} in ${gap} min${ctx.nextEvent.room ? ` · Room ${ctx.nextEvent.room}` : ''}.`);
  }
  const dueNow = ctx.dueTodayHomework;
  if (dueNow.length > 0) parts.push(`Also: ${dueNow.map((h) => h.title).join(', ')} ${dueNow.length > 1 ? 'are' : 'is'} due today.`);
  parts.push(`Focus on getting to your next thing. Everything else can wait.`);
  return { text: parts.join('\n') };
}

function handleHomeworkQuery(ctx: LifeContext): AIResponse {
  if (ctx.homework.length === 0) return { text: `I don't see any pending homework in your Life OS. You're clear.` };
  const lines: string[] = [];
  if (ctx.overdueHomework.length > 0) lines.push(`**Overdue:** ${ctx.overdueHomework.map((h) => h.title).join(', ')}`);
  if (ctx.dueTodayHomework.length > 0) lines.push(`**Due today:** ${ctx.dueTodayHomework.map((h) => h.title).join(', ')}`);
  if (ctx.dueTomorrowHomework.length > 0) lines.push(`**Due tomorrow:** ${ctx.dueTomorrowHomework.map((h) => h.title).join(', ')}`);
  const later = ctx.homework.filter((h) => daysUntil(h.due_date) > 1);
  if (later.length > 0) lines.push(`**Later:** ${later.map((h) => `${h.title} (${fmtRelativeDate(h.due_date)})`).join(', ')}`);

  const actions: AIAction[] = [];
  if (ctx.dueTodayHomework.length > 0) {
    actions.push({ type: 'complete_homework', label: `Mark "${ctx.dueTodayHomework[0].title}" done`, entityId: ctx.dueTodayHomework[0].id, entityType: 'homework' });
  }
  return { text: lines.join('\n'), actions };
}

function handleTestsQuery(ctx: LifeContext): AIResponse {
  if (ctx.tests.length === 0) return { text: `I don't see any upcoming tests in your Life OS. You're in good shape.` };
  const lines = ctx.tests.slice(0, 5).map((t) => {
    const di = daysUntil(t.exam_date);
    const when = di === 0 ? 'today' : di === 1 ? 'tomorrow' : fmtRelativeDate(t.exam_date);
    return `• ${t.title} — ${when} · ${t.revision_progress}% revised${di <= 2 && t.revision_progress < 60 ? ' ⚠' : ''}`;
  });
  const closest = ctx.tests[0];
  const di = daysUntil(closest.exam_date);
  let advice = '';
  if (di <= 2 && closest.revision_progress < 50) advice = `\n\n${closest.title} is ${di === 0 ? 'today' : di === 1 ? 'tomorrow' : `in ${di} days`} and revision is only at ${closest.revision_progress}%. I'd focus on the topics you're least confident on — short focused sessions are better than cramming.`;
  else if (di <= 7) advice = `\n\nI'd break revision for ${closest.title} into 2-3 short sessions rather than one long one.`;
  return { text: `${lines.join('\n')}${advice}` };
}

function handleTasksQuery(ctx: LifeContext): AIResponse {
  if (ctx.tasks.length === 0) return { text: `No pending tasks. You're all caught up.` };
  const lines = ctx.tasks.slice(0, 5).map((t) => `• ${t.title}${t.priority >= 4 ? ' (high priority)' : ''}${t.due_date ? ` — ${fmtRelativeDate(t.due_date)}` : ''}`);
  const overdue = ctx.overdueTasks;
  let suffix = '';
  if (overdue.length > 0) suffix = `\n\n${overdue.length} overdue — I'd clear those first.`;
  return { text: `${lines.join('\n')}${suffix}${ctx.tasks.length > 5 ? `\n\n...and ${ctx.tasks.length - 5} more.` : ''}` };
}

function handleScheduleQuery(ctx: LifeContext): AIResponse {
  return handleWhatToday(ctx);
}

function handleWorkoutAdvice(ctx: LifeContext): AIResponse {
  const workout = ctx.todayWorkouts.find((w) => w.status === 'planned');
  if (!workout) return { text: `No workout scheduled today. If you want to add one, just tell me what and when.` };

  const actions: AIAction[] = [];
  if (state.temporaryState.tired) {
    actions.push({ type: 'skip_workout', label: 'Skip workout', entityId: workout.id, entityType: 'workout', data: { reason: 'User is tired' } });
    return { text: `You have ${workout.title} scheduled${workout.scheduled_time ? ` at ${fmtTime(workout.scheduled_time)}` : ''}, but you said you're tired. I'd skip it — rest is more important than optional exercise. Even athletes take recovery days.`, actions };
  }
  const workload = ctx.dueTodayHomework.length + ctx.dueTomorrowHomework.length + (ctx.tests.some((t) => daysUntil(t.exam_date) <= 2) ? 1 : 0);
  if (workload >= 3) {
    actions.push({ type: 'skip_workout', label: 'Skip workout', entityId: workout.id, entityType: 'workout', data: { reason: 'Heavy workload' } });
    return { text: `You have ${workout.title} scheduled, but you've got ${workload} pressing items. I'd skip the workout tonight and focus on the essentials. You can always train tomorrow.`, actions };
  }
  actions.push({ type: 'complete_workout', label: 'Mark complete', entityId: workout.id, entityType: 'workout' });
  return { text: `You have ${workout.title} scheduled${workout.scheduled_time ? ` at ${fmtTime(workout.scheduled_time)}` : ''}. Your workload is manageable — go for it. Even if you shorten it, something is better than nothing.`, actions };
}

function handleSleep(ctx: LifeContext): AIResponse {
  const hour = Math.floor(ctx.currentMinutes / 60);
  if (state.temporaryState.tired) {
    return { text: `You said you're tired — listen to that. If it's evening, start winding down earlier than usual. Skip optional tasks, do the bare minimum for your routine, and get to bed on time. Tomorrow will be better with proper rest.` };
  }
  if (hour >= 21) return { text: `It's ${fmtTime(ctx.currentTime)} — time to wind down. Dim the lights, put away screens, and give yourself 20 minutes to relax. Sleep is the best thing you can do for tomorrow.` };
  if (hour < 7) return { text: `It's ${fmtTime(ctx.currentTime)} — early. If you can get a bit more rest, do. If not, make sure you're kind to yourself today.` };
  const recentSleep = ctx.recentLogs.map((l) => l.estimated_sleep_min || l.sleep_duration_min || 0).filter((s) => s > 0);
  if (recentSleep.length > 0) {
    const avg = Math.round(recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length);
    if (avg > 0 && avg < 360) return { text: `Your average sleep this week is about ${fmtDuration(avg)} — that's on the low side. I'd prioritise getting to bed on time tonight. Everything else gets easier with better sleep.` };
  }
  return { text: `Sleep is the foundation. Aim for 7-8 hours, keep a consistent bedtime, and avoid screens 30 minutes before bed. You can set your target bedtime in settings.` };
}

function handleStress(ctx: LifeContext): AIResponse {
  const items = buildPriorityList(ctx);
  if (items.length === 0) return { text: `Take a breath. Looking at your Life OS, there's actually nothing urgent right now. The pressure might be coming from elsewhere — a walk or some water might help more than any task would.` };
  const one = items[0];
  return { text: `Okay — let's simplify. You have ${items.length} things competing for attention, but right now only one matters: **${one.title}** (${one.detail}).\n\nForget the rest for 10 minutes. Do that one thing. Everything else can wait. If you want, I can move some things to tomorrow so your list looks less overwhelming.` };
}

function handleRoutines(ctx: LifeContext): AIResponse {
  if (ctx.todayRoutines.length === 0) return { text: `No active routines for today. You can set up morning and evening routines to build consistency.` };
  const lines = ctx.todayRoutines.map((r) => `• ${r.name}${r.start_time ? ` — ${fmtTime(r.start_time)}` : ''}${r.description ? `: ${r.description}` : ''}`);
  return { text: `Today's routines:\n\n${lines.join('\n')}\n\nRoutines work best when you follow them even on busy days — even a shortened version keeps the habit.` };
}

function handleGoals(ctx: LifeContext): AIResponse {
  if (ctx.goals.length === 0) return { text: `No active goals set. Goals help me give better advice — consider adding one in the Goals tab.` };
  const lines = ctx.goals.slice(0, 5).map((g) => `• ${g.title}${g.progress > 0 ? ` (${g.progress}% done)` : ''}${g.target_date ? ` — target ${fmtRelativeDate(g.target_date)}` : ''}`);
  return { text: `Active goals:\n\n${lines.join('\n')}` };
}

async function handleAddTask(intent: DetectedIntent, _ctx: LifeContext): Promise<AIResponse> {
  const title = intent.data?.title as string;
  const dueDate = intent.data?.dueDate as string | undefined;
  if (!title) return { text: `What would you like the task to be called?` };
  const result = await executeAction({ type: 'create_task', label: 'Create task', data: { title, dueDate } });
  return { text: result.success ? `Done — I've added "${title}"${dueDate ? ` for ${fmtRelativeDate(dueDate)}` : ''}.` : `I couldn't create that task: ${result.message}`, actionResults: [result] };
}

async function handleAddHomework(intent: DetectedIntent, _ctx: LifeContext): Promise<AIResponse> {
  const title = intent.data?.title as string;
  const dueDate = intent.data?.dueDate as string;
  if (!title) return { text: `What's the homework called?` };
  if (!dueDate) return { text: `When is it due? (e.g. "tomorrow", "Friday")` };
  const result = await executeAction({ type: 'create_homework', label: 'Create homework', data: { title, dueDate } });
  return { text: result.success ? `Done — "${title}" added for ${fmtRelativeDate(dueDate)}.` : `I couldn't add that: ${result.message}`, actionResults: [result] };
}

async function handleAddRevision(intent: DetectedIntent, _ctx: LifeContext): Promise<AIResponse> {
  const title = intent.data?.title as string;
  const dueDate = intent.data?.dueDate as string;
  if (!title) return { text: `What subject do you want to revise?` };
  const result = await executeAction({ type: 'schedule_revision', label: 'Schedule revision', data: { title, dueDate } });
  return { text: result.success ? `Done — I've added a revision session for ${title}${dueDate ? ` for ${fmtRelativeDate(dueDate)}` : ''}.` : `I couldn't add that: ${result.message}`, actionResults: [result] };
}

async function handleMoveItem(intent: DetectedIntent, ctx: LifeContext): Promise<AIResponse> {
  const q = (intent.data?.query as string) || state.turns[state.turns.length - 1]?.userMessage || '';
  const tomorrowDate = addDays(todayKey(), 1);
  const hw = ctx.homework.find((h) => q.toLowerCase().includes(h.title.toLowerCase().slice(0, 5)));
  if (hw) {
    const action: AIAction = { type: 'move_homework', label: `Move to ${fmtRelativeDate(tomorrowDate)}`, entityId: hw.id, entityType: 'homework', data: { dueDate: tomorrowDate } };
    const result = await executeAction(action);
    return { text: result.success ? `Done — I've moved ${hw.title} to ${fmtRelativeDate(tomorrowDate)}.` : `I couldn't move that: ${result.message}`, actionResults: [result] };
  }
  const task = ctx.tasks.find((t) => q.toLowerCase().includes(t.title.toLowerCase().slice(0, 5)));
  if (task) {
    const action: AIAction = { type: 'move_task', label: `Move to ${fmtRelativeDate(tomorrowDate)}`, entityId: task.id, entityType: 'task', data: { dueDate: tomorrowDate } };
    const result = await executeAction(action);
    return { text: result.success ? `Done — I've moved ${task.title} to ${fmtRelativeDate(tomorrowDate)}.` : `I couldn't move that: ${result.message}`, actionResults: [result] };
  }
  if (ctx.homework.length > 0) {
    return { text: `Which item do you want to move? You have: ${ctx.homework.slice(0, 3).map((h) => h.title).join(', ')}${ctx.tasks.length > 0 ? `, plus ${ctx.tasks.length} task${ctx.tasks.length > 1 ? 's' : ''}` : ''}.` };
  }
  return { text: `I don't see anything to move.` };
}

async function handleCompleteItem(intent: DetectedIntent, ctx: LifeContext): Promise<AIResponse> {
  const q = (intent.data?.query as string) || state.turns[state.turns.length - 1]?.userMessage || '';
  const hw = ctx.homework.find((h) => q.toLowerCase().includes(h.title.toLowerCase().slice(0, 5)));
  if (hw) {
    const result = await executeAction({ type: 'complete_homework', label: 'Complete', entityId: hw.id, entityType: 'homework' });
    return { text: result.success ? `Done — ${hw.title} marked complete.` : `Couldn't do that: ${result.message}`, actionResults: [result] };
  }
  const task = ctx.tasks.find((t) => q.toLowerCase().includes(t.title.toLowerCase().slice(0, 5)));
  if (task) {
    const result = await executeAction({ type: 'complete_task', label: 'Complete', entityId: task.id, entityType: 'task' });
    return { text: result.success ? `Done — ${task.title} marked complete.` : `Couldn't do that: ${result.message}`, actionResults: [result] };
  }
  return { text: `Which item? You have: ${ctx.homework.slice(0, 3).map((h) => h.title).join(', ')}${ctx.tasks.length > 0 ? `, ${ctx.tasks.slice(0, 2).map((t) => t.title).join(', ')}` : ''}.` };
}

async function handleSkipWorkout(_intent: DetectedIntent, ctx: LifeContext): Promise<AIResponse> {
  const workout = ctx.todayWorkouts.find((w) => w.status === 'planned');
  if (!workout) return { text: `No workout scheduled today to skip.` };
  const result = await executeAction({ type: 'skip_workout', label: 'Skip', entityId: workout.id, entityType: 'workout', data: { reason: 'User request' } });
  return { text: result.success ? `Done — I've skipped ${workout.title} for today. No guilt, rest is valid.` : `Couldn't do that: ${result.message}`, actionResults: [result] };
}

function handleSetMode(intent: DetectedIntent): AIResponse {
  const mode = intent.data?.mode as string;
  state.planningMode = mode as ConversationState['planningMode'];
  state.temporaryState.customInstruction = mode;
  return { text: `Switched to ${mode} mode for today. ${mode === 'relaxed' ? 'I\'ll prioritise essentials and rest.' : mode === 'productive' ? 'I\'ll suggest more optional work where there\'s capacity.' : 'Back to balanced.'}` };
}

function handleForget(_intent: DetectedIntent): AIResponse {
  state.pendingActions = undefined;
  state.temporaryState = {};
  return { text: `Okay, forgotten. What would you like to do instead?` };
}

function handleFreeTime(ctx: LifeContext): AIResponse {
  const slot = getNextFreeSlot(ctx, ctx.currentMinutes);
  if (!slot || slot.duration < 15) return { text: `You don't have a meaningful free slot before your next commitment.` };
  const startStr = fmtTimeShort(`${Math.floor(slot.start / 60)}:${String(slot.start % 60).padStart(2, '0')}`);
  const endStr = fmtTimeShort(`${Math.floor(slot.end / 60)}:${String(slot.end % 60).padStart(2, '0')}`);
  const suggestions: string[] = [];
  if (ctx.dueTodayHomework.length > 0) suggestions.push(`knock out ${ctx.dueTodayHomework[0].title}`);
  else if (ctx.homework.length > 0) suggestions.push(`start ${ctx.homework[0].title}`);
  else if (ctx.tasks.length > 0) suggestions.push(`do ${ctx.tasks[0].title}`);
  else suggestions.push(`just take a break — you don't need to fill every gap`);
  return { text: `You're free from ${startStr} to ${endStr} (${fmtDuration(slot.duration)}). Good time to ${suggestions[0]}.` };
}

function handleFallback(ctx: LifeContext): AIResponse {
  const lastTurn = state.turns[state.turns.length - 1];
  if (lastTurn && state.turns.length > 0) {
    if (/^(yes|yeah|ok|sure|sounds good|do that|that works|agreed)$/.test(lastTurn.userMessage.toLowerCase().trim())) {
      return { text: `Is there something specific you'd like me to help with? I can prioritise your day, check homework, plan revision, or take actions like moving tasks.` };
    }
  }
  if (ctx.currentEvent) {
    return { text: `I'm not sure what you mean, but I can see you're in ${ctx.currentEvent.title} right now. Try asking me "what should I focus on?", "do I have homework?", or "plan my evening".` };
  }
  return { text: `I'm here to help with your day. Try asking "what should I focus on?", "plan my evening", "do I have any tests?", or "add a task for tomorrow".` };
}

export { needsConfirmation };
