import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AIChatMessage, TimetableEvent, Homework, Task, TestExam, Routine } from '@/lib/types';

interface AIChatProps {
  open: boolean;
  onClose: () => void;
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

  async function generateContext(): Promise<string> {
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];
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

    const parts: string[] = [];
    parts.push(`Current time: ${currentTime} on ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);

    if (events.length > 0) {
      parts.push(`Today's schedule: ${events.map((e) => `${e.start_time}-${e.end_time} ${e.title}`).join(', ')}`);
    }

    const currentEvent = events.find((e) => currentTime >= e.start_time && currentTime < e.end_time);
    if (currentEvent) {
      parts.push(`Currently in: ${currentEvent.title} (ends at ${currentEvent.end_time})`);
    }

    const nextEvent = events.find((e) => e.start_time > currentTime);
    if (nextEvent) {
      parts.push(`Next event: ${nextEvent.title} at ${nextEvent.start_time}`);
    }

    if (homework.length > 0) {
      parts.push(`Pending homework: ${homework.map((h) => `${h.title} (due ${h.due_date})`).join('; ')}`);
    }

    if (tasks.length > 0) {
      parts.push(`Pending tasks: ${tasks.map((t) => `${t.title} (priority ${t.priority})`).join('; ')}`);
    }

    if (tests.length > 0) {
      parts.push(`Upcoming tests: ${tests.map((t) => `${t.title} on ${t.exam_date} (${t.revision_progress}% revised)`).join('; ')}`);
    }

    if (routines.length > 0) {
      const todayRoutines = routines.filter((r) => r.applicable_days?.includes(dayOfWeek));
      if (todayRoutines.length > 0) {
        parts.push(`Today's routines: ${todayRoutines.map((r) => r.name).join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  function generateResponse(userMessage: string, context: string): string {
    const lower = userMessage.toLowerCase();
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const hour = now.getHours();

    if (lower.includes('late') || lower.includes('running late') || lower.includes('behind')) {
      return "Let me check what's coming up next. Based on your schedule, if you're running late, focus on getting to your next event as soon as possible. I can help you figure out what to deprioritise — any homework or tasks due today should take precedence over lower-priority items. Want me to look at what's due?";
    }

    if (lower.includes('priorit') || lower.includes('what should i do') || lower.includes('focus')) {
      const lines = context.split('\n');
      const hwLine = lines.find((l) => l.includes('Pending homework'));
      const taskLine = lines.find((l) => l.includes('Pending tasks'));
      const testLine = lines.find((l) => l.includes('Upcoming tests'));
      const nextLine = lines.find((l) => l.includes('Next event'));

      const suggestions: string[] = [];
      if (nextLine) suggestions.push(`Your next scheduled event is coming up — make sure you're ready for that first.`);
      if (hwLine) suggestions.push(`You have homework due soon — tackle the most urgent one first.`);
      if (testLine) suggestions.push(`You have an upcoming test — if revision progress is low, dedicate some time to studying.`);
      if (taskLine) suggestions.push(`For tasks, start with the highest priority one.`);
      if (suggestions.length === 0) return "You're all caught up! This is a good time to rest, review your goals, or get ahead on upcoming work.";
      return `Here's what I'd suggest:\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    }

    if (lower.includes('sleep') || lower.includes('tired') || lower.includes('bedtime')) {
      if (hour >= 21) return `It's ${currentTime} — if your target bedtime is coming up, start winding down soon. Reduce screen time and try to relax. A good night's sleep will make tomorrow much more productive.`;
      return `Sleep is crucial for productivity and mood. Try to keep a consistent bedtime and avoid screens 30 minutes before bed. Your target bedtime is set in your Sleep & Lifestyle settings.`;
    }

    if (lower.includes('test') || lower.includes('exam') || lower.includes('revision') || lower.includes('study')) {
      const testLine = context.split('\n').find((l) => l.includes('Upcoming tests'));
      if (testLine) return `You have upcoming tests. ${testLine}. I'd recommend breaking your revision into focused sessions — 25 minutes of study with 5-minute breaks (Pomodoro). Prioritise the test that's closest or has the lowest revision progress.`;
      return "No upcoming tests right now. You're in good shape! When tests do come up, I'll help you plan your revision schedule.";
    }

    if (lower.includes('workout') || lower.includes('exercise') || lower.includes('gym')) {
      return "Regular exercise boosts energy, mood, and focus. Check your Health & Wellness tab for scheduled workouts — if you've set up recurring workouts, they'll appear automatically each week. Even a short workout is better than skipping entirely.";
    }

    if (lower.includes('routine') || lower.includes('morning') || lower.includes('evening')) {
      const routineLine = context.split('\n').find((l) => l.includes("Today's routines"));
      if (routineLine) return `Your routines for today: ${routineLine}. Routines help build consistency — try to follow them even on busy days, even if you need to shorten them.`;
      return "You don't have any active routines for today. Consider setting up morning and evening routines in your Routines settings to build better habits.";
    }

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return `Hello! I'm your AI assistant. I can help you with prioritising tasks, managing your schedule, tracking homework and tests, and staying on top of your routines. What's on your mind?`;
    }

    if (lower.includes('help') || lower.includes('what can you do')) {
      return `I can help you with:\n\n• Prioritising tasks and homework\n• Planning your study schedule for upcoming tests\n• Managing your daily routine\n• Advice on sleep, exercise, and productivity\n• Figuring out what to do next when you're running late\n\nJust ask me anything about your day or your goals!`;
    }

    if (lower.includes('stress') || lower.includes('overwhelm') || lower.includes('anxious')) {
      return "It sounds like you've got a lot going on. Let's break it down: what's the most urgent thing right now? Focus on one thing at a time — you don't have to do everything today. If you're feeling overwhelmed, taking a short break or a walk can help reset your focus.";
    }

    const contextLines = context.split('\n');
    const summary: string[] = [];
    const nextLine = contextLines.find((l) => l.includes('Next event'));
    const hwLine = contextLines.find((l) => l.includes('Pending homework'));
    if (nextLine) summary.push(nextLine);
    if (hwLine) summary.push(hwLine);

    if (summary.length > 0) {
      return `Here's a quick snapshot:\n\n${summary.join('\n')}\n\nIs there something specific you'd like help with? I can help you prioritise, plan your revision, or figure out what to do next.`;
    }

    return `I'm here to help! I can see your schedule, homework, tasks, tests, and routines. Ask me about prioritising your day, planning for tests, managing your routine, or what to do when you're running late. What would you like to know?`;
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

      if (savedUser) {
        setMessages((prev) => [...prev, savedUser as AIChatMessage]);
      }

      const context = await generateContext();
      const response = generateResponse(userMessage, context);

      const { data: savedAssistant } = await supabase
        .from('ai_chat_messages')
        .insert({ role: 'assistant', content: response })
        .select('*')
        .single();

      if (savedAssistant) {
        setMessages((prev) => [...prev, savedAssistant as AIChatMessage]);
      }
    } catch {
      // If save fails, still show the response locally
      setMessages((prev) => [
        ...prev,
        { id: 'temp-u', user_id: '', role: 'user', content: userMessage, created_at: new Date().toISOString() },
        { id: 'temp-a', user_id: '', role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.', created_at: new Date().toISOString() },
      ]);
    } finally {
      setThinking(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-card w-full md:max-w-lg h-[80vh] md:h-[600px] flex flex-col rounded-t-2xl md:rounded-2xl animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
              <Sparkles size={16} className="text-sage-300" />
            </div>
            <div>
              <h2 className="font-display text-base text-cream">AI Assistant</h2>
              <p className="text-[10px] text-cream-dim">Knows your schedule, tasks, and routines</p>
            </div>
          </div>
          <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-sage-500/20 border-t-sage-300 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <Sparkles size={28} className="text-sage-300/50" />
              <p className="text-sm text-cream-dim">Ask me anything about your day</p>
              <p className="text-xs text-cream-dim/60">I can help you prioritise, plan revision, or figure out what to do next</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-sage-500/15 text-cream rounded-br-md border border-sage-500/15'
                      : 'bg-charcoal-800/60 text-cream-dim rounded-bl-md border border-white/[0.04]'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {thinking && (
            <div className="flex justify-start">
              <div className="bg-charcoal-800/60 border border-white/[0.04] px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cream-dim/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cream-dim/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cream-dim/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about your day..."
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
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 w-14 h-14 rounded-full bg-sage-500/15 border border-sage-500/25 flex items-center justify-center text-sage-200 shadow-lg shadow-sage-500/10 hover:scale-105 hover:bg-sage-500/20 transition-all"
      aria-label="AI Assistant"
    >
      <MessageCircle size={22} />
      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sage-400 border-2 border-charcoal-950 animate-pulse" />
    </button>
  );
}
