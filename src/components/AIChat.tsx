import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AIChatMessage, TimetableEvent, Homework, Task, TestExam, Routine } from '@/lib/types';

interface AIChatProps {
  open: boolean;
  onClose: () => void;
}

function fmtTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ScheduleContext {
  currentTime: string;
  currentDate: string;
  events: TimetableEvent[];
  homework: Homework[];
  tasks: Task[];
  tests: TestExam[];
  routines: Routine[];
  currentEvent: TimetableEvent | null;
  nextEvent: TimetableEvent | null;
}

export function AIChat({ open, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    async function loadMessages() {
      const { data } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      setMessages((data as AIChatMessage[]) || []);
      setLoading(false);
    }
    loadMessages();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  async function gatherContext(): Promise<ScheduleContext> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    const [eventsRes, hwRes, tasksRes, testsRes, routinesRes] = await Promise.all([
      supabase.from('timetable_events').select('*').eq('day_of_week', dayOfWeek).order('start_time'),
      supabase.from('homework').select('*').in('status', ['todo', 'in_progress']).order('due_date').limit(10),
      supabase.from('tasks').select('*').in('status', ['todo', 'in_progress']).order('priority', { ascending: false }).limit(10),
      supabase.from('tests_exams').select('*').eq('status', 'upcoming').order('exam_date').limit(5),
      supabase.from('routines').select('*').eq('is_active', true),
    ]);

    const events = (eventsRes.data as TimetableEvent[]) || [];
    const homework = (hwRes.data as Homework[]) || [];
    const tasks = (tasksRes.data as Task[]) || [];
    const tests = (testsRes.data as TestExam[]) || [];
    const routines = (routinesRes.data as Routine[]) || [];

    return {
      currentTime,
      currentDate: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      events,
      homework,
      tasks,
      tests,
      routines,
      currentEvent: events.find((e) => currentTime >= e.start_time && currentTime < e.end_time) || null,
      nextEvent: events.find((e) => e.start_time > currentTime) || null,
    };
  }

  function respond(userMessage: string, ctx: ScheduleContext): string {
    const q = userMessage.toLowerCase().trim();

    if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)\b/.test(q)) {
      const greeting = ctx.currentEvent
        ? `You're currently in ${ctx.currentEvent.title} — it ends at ${fmtTime(ctx.currentEvent.end_time)}.`
        : ctx.nextEvent
          ? `Your next thing is ${ctx.nextEvent.title} at ${fmtTime(ctx.nextEvent.start_time)}.`
          : `Your schedule is clear right now.`;
      return `Hey! ${greeting} What can I help you with?`;
    }

    if (q.includes('help') || q.includes('what can you do') || q.includes('what do you do')) {
      return `Here's what I can help with:\n\n• Prioritise your tasks and homework\n• Plan revision for upcoming tests\n• Suggest what to do right now or during free periods\n• Check your schedule and routines\n• Give advice on sleep, workouts, and managing stress\n• Help when you're running late\n\nJust ask me naturally — like "what should I focus on?" or "am I running late?"`;
    }

    if (q.includes('late') || q.includes('running late') || q.includes('behind schedule') || q.includes('missed')) {
      const parts: string[] = [];
      if (ctx.currentEvent) {
        parts.push(`Right now you should be in **${ctx.currentEvent.title}** (ends at ${fmtTime(ctx.currentEvent.end_time)}).`);
      }
      if (ctx.nextEvent) {
        parts.push(`Your next event is **${ctx.nextEvent.title}** at ${fmtTime(ctx.nextEvent.start_time)}${ctx.nextEvent.room ? ` in room ${ctx.nextEvent.room}` : ''}.`);
      }
      if (ctx.homework.some((h) => h.due_date === new Date().toISOString().split('T')[0])) {
        const dueToday = ctx.homework.filter((h) => h.due_date === new Date().toISOString().split('T')[0]);
        parts.push(`You also have ${dueToday.length} homework item${dueToday.length > 1 ? 's' : ''} due today: ${dueToday.map((h) => h.title).join(', ')}.`);
      }
      if (parts.length === 0) return `You're not behind on anything — everything looks on track. Is there something specific you're worried about?`;
      return `Don't panic. Here's the situation:\n\n${parts.join('\n')}\n\nFocus on getting to your next event. If homework is due today, use any free time you have between classes to knock it out.`;
    }

    if (q.includes('priorit') || q.includes('what should i do') || q.includes('what to do') || q.includes('focus') || q.includes('next')) {
      const tips: string[] = [];
      if (ctx.currentEvent) {
        tips.push(`You're in ${ctx.currentEvent.title} right now — stay focused until it ends at ${fmtTime(ctx.currentEvent.end_time)}.`);
      }
      if (ctx.nextEvent) {
        const [nh, nm] = ctx.nextEvent.start_time.split(':').map(Number);
        const nowMin = parseInt(ctx.currentTime.slice(0, 2)) * 60 + parseInt(ctx.currentTime.slice(3, 5));
        const gap = nh * 60 + nm - nowMin;
        if (gap > 15 && !ctx.currentEvent) {
          tips.push(`You have about ${fmtDuration(gap)} until ${ctx.nextEvent.title} at ${fmtTime(ctx.nextEvent.start_time)}. Good window for a quick task.`);
        } else if (gap > 0) {
          tips.push(`Next up: ${ctx.nextEvent.title} at ${fmtTime(ctx.nextEvent.start_time)}${ctx.nextEvent.room ? ` in room ${ctx.nextEvent.room}` : ''}.`);
        }
      }
      const dueToday = ctx.homework.filter((h) => h.due_date === new Date().toISOString().split('T')[0]);
      if (dueToday.length > 0) {
        tips.push(`${dueToday.length} homework due today — ${dueToday.map((h) => h.title).join(', ')}. Do these first.`);
      }
      const dueTomorrow = ctx.homework.filter((h) => {
        const d = new Date(h.due_date + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return Math.round((d.getTime() - today.getTime()) / 86400000) === 1;
      });
      if (dueTomorrow.length > 0) {
        tips.push(`${dueTomorrow.length} due tomorrow: ${dueTomorrow.map((h) => h.title).join(', ')}.`);
      }
      if (ctx.tests.length > 0) {
        const closest = ctx.tests[0];
        const d = new Date(closest.exam_date + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = Math.round((d.getTime() - today.getTime()) / 86400000);
        if (days <= 3) {
          tips.push(`${closest.title} is ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} — revision is at ${closest.revision_progress}%.`);
        }
      }
      if (ctx.tasks.length > 0 && tips.length < 4) {
        const top = ctx.tasks[0];
        tips.push(`Highest priority task: ${top.title}.`);
      }
      if (tips.length === 0) return `You're all caught up. Nothing urgent on your plate — this is a great time to rest, review your goals, or get ahead on upcoming work.`;
      return `Here's what I'd focus on:\n\n${tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
    }

    if (q.includes('schedule') || q.includes('today') || q.includes('what\'s on') || q.includes("what's on")) {
      if (ctx.events.length === 0) return `Nothing scheduled for today. Enjoy the open day!`;
      const lines = ctx.events.map((e) => `${fmtTime(e.start_time)} — ${fmtTime(e.end_time)}  ${e.title}${e.room ? ` (room ${e.room})` : ''}`);
      return `Here's your day:\n\n${lines.join('\n')}`;
    }

    if (q.includes('homework') || q.includes('hw') || q.includes('assignment')) {
      if (ctx.homework.length === 0) return `No pending homework. You're all clear!`;
      const lines = ctx.homework.map((h) => `• ${h.title} — due ${fmtDate(h.due_date)}${h.subject_id ? '' : ''}`);
      return `You have ${ctx.homework.length} homework item${ctx.homework.length > 1 ? 's' : ''} pending:\n\n${lines.join('\n')}\n\n${ctx.homework[0] ? `I'd start with **${ctx.homework[0].title}** — it's the most urgent.` : ''}`;
    }

    if (q.includes('test') || q.includes('exam') || q.includes('revision') || q.includes('study')) {
      if (ctx.tests.length === 0) return `No upcoming tests. You're in good shape — I'll let you know when one comes up.`;
      const lines = ctx.tests.map((t) => {
        const d = new Date(t.exam_date + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = Math.round((d.getTime() - today.getTime()) / 86400000);
        const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days (${fmtDate(t.exam_date)})`;
        return `• ${t.title} — ${when} · ${t.revision_progress}% revised`;
      });
      const closest = ctx.tests[0];
      return `Upcoming tests:\n\n${lines.join('\n')}\n\nI'd prioritise **${closest.title}** — break revision into 25-minute focused sessions with short breaks. Focus on the topics you're least confident on first.`;
    }

    if (q.includes('sleep') || q.includes('tired') || q.includes('bedtime') || q.includes('rest')) {
      const hour = parseInt(ctx.currentTime.slice(0, 2));
      if (hour >= 21) return `It's ${fmtTime(ctx.currentTime)} — getting close to bedtime. Start winding down: dim the lights, put away screens, and give yourself 20-30 minutes to relax. Tomorrow will be much easier with proper rest.`;
      if (hour < 7) return `It's ${fmtTime(ctx.currentTime)} — still early. If you woke up naturally, great. If not, try to get a bit more rest if you can.`;
      return `Sleep is the foundation of everything else. Try to keep a consistent bedtime, avoid screens 30 minutes before bed, and aim for 7-8 hours. You can set your target bedtime in your settings.`;
    }

    if (q.includes('workout') || q.includes('exercise') || q.includes('gym') || q.includes('training')) {
      return `Movement is one of the best things you can do for focus and mood. Check the Health & Wellness tab for your scheduled workouts — if you've set up recurring ones, they'll show up automatically each week. Even 20 minutes is better than skipping entirely.`;
    }

    if (q.includes('routine') || q.includes('morning') || q.includes('evening')) {
      const todayRoutines = ctx.routines.filter((r) => r.applicable_days?.includes(new Date().getDay()));
      if (todayRoutines.length === 0) return `No active routines for today. You can set up morning and evening routines in your settings to build consistency.`;
      const lines = todayRoutines.map((r) => `• ${r.name}${r.start_time ? ` at ${fmtTime(r.start_time)}` : ''}`);
      return `Here are your routines for today:\n\n${lines.join('\n')}\n\nRoutines work best when you follow them even on busy days — even a shortened version keeps the habit.`;
    }

    if (q.includes('stress') || q.includes('overwhelm') || q.includes('anxious') || q.includes('anxiety') || q.includes('pressure')) {
      return `Take a breath. You don't have to do everything at once.\n\nHere's what helps: pick one thing — the smallest, most urgent task — and do just that. Everything else can wait 10 minutes while you reset. A short walk or some water can help too.\n\nWant me to help you pick the one thing to focus on?`;
    }

    if (q.includes('task') || q.includes('todo') || q.includes('to-do')) {
      if (ctx.tasks.length === 0) return `No pending tasks. You're all caught up!`;
      const lines = ctx.tasks.slice(0, 5).map((t) => `• ${t.title}${t.priority >= 4 ? ' (high priority)' : ''}${t.due_date ? ` — due ${fmtDate(t.due_date)}` : ''}`);
      return `Here are your top tasks:\n\n${lines.join('\n')}${ctx.tasks.length > 5 ? `\n\n...and ${ctx.tasks.length - 5} more.` : ''}`;
    }

    const snapshot: string[] = [];
    if (ctx.currentEvent) snapshot.push(`Right now: ${ctx.currentEvent.title} (until ${fmtTime(ctx.currentEvent.end_time)})`);
    if (ctx.nextEvent) snapshot.push(`Next: ${ctx.nextEvent.title} at ${fmtTime(ctx.nextEvent.start_time)}`);
    if (ctx.homework.length > 0) snapshot.push(`${ctx.homework.length} homework pending`);
    if (ctx.tests.length > 0) snapshot.push(`${ctx.tests.length} upcoming test${ctx.tests.length > 1 ? 's' : ''}`);
    if (snapshot.length > 0) {
      return `Here's a quick snapshot of your day:\n\n${snapshot.map((s) => `• ${s}`).join('\n')}\n\nAsk me to prioritise, check your homework, plan for a test, or help when you're running late.`;
    }
    return `I'm your personal assistant — I can see your schedule, homework, tasks, tests, and routines. Try asking me:\n\n• "What should I focus on?"\n• "Do I have any homework?"\n• "When's my next test?"\n• "Am I running late?"`;
  }

  async function handleSend() {
    if (!input.trim() || thinking) return;
    const userMessage = input.trim();
    setInput('');
    setThinking(true);

    try {
      const { data: savedUser } = await supabase
        .from('ai_chat_messages')
        .insert({ role: 'user', content: userMessage })
        .select('*')
        .single();
      if (savedUser) setMessages((prev) => [...prev, savedUser as AIChatMessage]);

      const ctx = await gatherContext();
      const response = respond(userMessage, ctx);

      const { data: savedAssistant } = await supabase
        .from('ai_chat_messages')
        .insert({ role: 'assistant', content: response })
        .select('*')
        .single();
      if (savedAssistant) setMessages((prev) => [...prev, savedAssistant as AIChatMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: 'temp-u', user_id: '', role: 'user', content: userMessage, created_at: new Date().toISOString() },
        { id: 'temp-a', user_id: '', role: 'assistant', content: 'Sorry, something went wrong. Please try again.', created_at: new Date().toISOString() },
      ]);
    } finally {
      setThinking(false);
    }
  }

  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      const boldMatch = line.match(/\*\*(.+?)\*\*/);
      if (boldMatch) {
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <p key={i} className={i > 0 ? 'mt-1' : ''}>
            {parts.map((part, j) => j % 2 === 1 ? <span key={j} className="font-semibold text-cream">{part}</span> : <span key={j}>{part}</span>)}
          </p>
        );
      }
      return <p key={i} className={i > 0 ? 'mt-1' : ''}>{line || '\u00A0'}</p>;
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-card w-full md:max-w-lg h-[80vh] md:h-[620px] flex flex-col rounded-t-2xl md:rounded-2xl animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
              <Sparkles size={17} className="text-sage-300" />
            </div>
            <div>
              <h2 className="font-display text-lg text-cream leading-none">Assistant</h2>
              <p className="text-[10px] text-cream-dim mt-1">Knows your schedule, tasks & routines</p>
            </div>
          </div>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors">
            <X size={18} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-sage-500/20 border-t-sage-300 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
              <div className="w-14 h-14 rounded-2xl bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
                <Sparkles size={26} className="text-sage-300/70" />
              </div>
              <p className="text-sm text-cream font-medium">Hey! I'm your assistant.</p>
              <p className="text-xs text-cream-dim/70 leading-relaxed">I can see your schedule, homework, tasks, tests, and routines. Ask me what to focus on, when your next test is, or what to do when you're running late.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-sage-500/10 border border-sage-500/15 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <Sparkles size={13} className="text-sage-300/70" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-sage-500/15 text-cream rounded-br-md border border-sage-500/12'
                      : 'bg-charcoal-800/50 text-cream-muted rounded-bl-md border border-white/[0.04]'
                  }`}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            ))
          )}
          {thinking && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-sage-500/10 border border-sage-500/15 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Sparkles size={13} className="text-sage-300/70" />
              </div>
              <div className="bg-charcoal-800/50 border border-white/[0.04] px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cream-dim/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cream-dim/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cream-dim/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask me anything..."
              className="input-field flex-1"
              disabled={thinking}
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || thinking}
              className="btn-primary p-2.5 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 md:bottom-10 right-4 md:right-8 z-30 w-14 h-14 rounded-full bg-sage-500/15 border border-sage-500/25 flex items-center justify-center text-sage-200 shadow-lg shadow-sage-500/10 hover:scale-105 hover:bg-sage-500/20 transition-all"
      aria-label="AI Assistant"
    >
      <MessageCircle size={22} />
      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sage-400 border-2 border-charcoal-950 animate-pulse" />
    </button>
  );
}
