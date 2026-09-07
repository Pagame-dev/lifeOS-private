import { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, X, Send, MessageCircle, Check, Trash2, Calendar, AlertCircle, Mic, MicOff, Volume2, Square, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildContext } from '@/lib/ai-context';
import { processMessage, resetConversation, needsConfirmation } from '@/lib/ai-engine';
import { executeAction as execAction } from '@/lib/ai-actions';
import { useSpeechRecognition, useSpeechSynthesis } from '@/lib/use-voice';
import type { AIAction, ActionResult } from '@/lib/ai-actions';
import type { AIChatMessage, VoiceSettings } from '@/lib/types';

interface AIChatProps {
  open: boolean;
  onClose: () => void;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: AIAction[];
  actionResults?: ActionResult[];
  pendingConfirmation?: boolean;
  spoken?: boolean;
}

export function AIChat({ open, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings | null>(null);
  const [lastInputMode, setLastInputMode] = useState<'text' | 'voice'>('text');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSpokenRef = useRef<string | null>(null);

  const { speak, stopSpeaking, speaking, voices, supported: ttsSupported } = useSpeechSynthesis();

  const handleTranscript = useCallback((text: string) => {
    setLastInputMode('voice');
    setInput(text);
  }, []);

  const { state: recState, interim, start: startListening, stop: stopListening, supported: sttSupported } = useSpeechRecognition(handleTranscript);

  useEffect(() => {
    if (!open) return;
    resetConversation();
    async function loadMessages() {
      const [msgRes, voiceRes] = await Promise.all([
        supabase.from('ai_chat_messages').select('*').order('created_at', { ascending: true }).limit(50),
        supabase.from('voice_settings').select('*').maybeSingle(),
      ]);
      const loaded = (msgRes.data as AIChatMessage[]) || [];
      setMessages(loaded.map((m) => ({ id: m.id, role: m.role, content: m.content })));
      setVoiceSettings((voiceRes.data as VoiceSettings) || null);
      setLoading(false);
    }
    loadMessages();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    if (!open) {
      stopSpeaking();
      stopListening();
    }
  }, [open, stopSpeaking, stopListening]);

  function shouldSpeakViaVoice(inputMode: 'text' | 'voice'): boolean {
    if (!voiceSettings || !ttsSupported) return false;
    if (inputMode === 'text') return voiceSettings.voice_when_type && voiceSettings.voice_output_enabled;
    return voiceSettings.voice_when_speak && voiceSettings.voice_output_enabled;
  }

  function speakResponse(text: string) {
    if (!ttsSupported) return;
    speak(text, { voice: voiceSettings?.selected_voice || undefined, rate: voiceSettings?.speaking_speed || 1.0 });
  }

  const handleSend = useCallback(async (messageOverride?: string, inputMode?: 'text' | 'voice') => {
    const userMessage = (messageOverride || input).trim();
    const mode = inputMode || lastInputMode;
    if (!userMessage || thinking) return;
    setInput('');
    setThinking(true);
    setLastInputMode(mode);

    const tempId = `temp-u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: userMessage }]);

    try {
      await supabase.from('ai_chat_messages').insert({ role: 'user', content: userMessage });

      const ctx = await buildContext();
      const response = await processMessage(userMessage, ctx);

      await supabase.from('ai_chat_messages').insert({ role: 'assistant', content: response.text });

      const assistantId = `temp-a-${Date.now()}`;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [...withoutTemp, {
          id: assistantId,
          role: 'assistant' as const,
          content: response.text,
          actions: response.actions,
          actionResults: response.actionResults,
        }];
      });

      if (shouldSpeakViaVoice(mode)) {
        lastSpokenRef.current = assistantId;
        speakResponse(response.text);
      }
    } catch {
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [...withoutTemp, { id: `err-${Date.now()}`, role: 'assistant', content: 'Something went wrong. Please try again.' }];
      });
    } finally {
      setThinking(false);
    }
  }, [input, thinking, lastInputMode, voiceSettings, ttsSupported, speak]);

  async function handleAction(action: AIAction, messageIndex: number) {
    if (needsConfirmation(action.type)) {
      setMessages((prev) => prev.map((m, i) => i === messageIndex ? { ...m, pendingConfirmation: true } : m));
      return;
    }
    const result = await execAction(action);
    setMessages((prev) => prev.map((m, i) => i === messageIndex ? {
      ...m,
      actions: m.actions?.filter((a) => a !== action),
      actionResults: [...(m.actionResults || []), result],
    } : m));
  }

  async function handleConfirmDelete(action: AIAction, messageIndex: number) {
    const result = await execAction(action);
    setMessages((prev) => prev.map((m, i) => i === messageIndex ? {
      ...m,
      pendingConfirmation: false,
      actions: m.actions?.filter((a) => a !== action),
      actionResults: [...(m.actionResults || []), result],
    } : m));
  }

  function handleCancelAction(messageIndex: number) {
    setMessages((prev) => prev.map((m, i) => i === messageIndex ? { ...m, pendingConfirmation: false } : m));
  }

  function toggleListening() {
    if (recState === 'listening') {
      stopListening();
    } else {
      setLastInputMode('voice');
      startListening();
    }
  }

  function handleSpeakMessage(msg: DisplayMessage) {
    if (speaking && lastSpokenRef.current === msg.id) {
      stopSpeaking();
      return;
    }
    lastSpokenRef.current = msg.id;
    speakResponse(msg.content);
  }

  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      if (!line) return <div key={i} className="h-2" />;
      const parts = line.split(/\*\*(.+?)\*\*/);
      if (parts.length > 1) {
        return (
          <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
            {parts.map((part, j) => j % 2 === 1
              ? <span key={j} className="font-semibold text-cream">{part}</span>
              : <span key={j}>{part}</span>
            )}
          </p>
        );
      }
      return <p key={i} className={i > 0 ? 'mt-1.5' : ''}>{line}</p>;
    });
  }

  if (!open) return null;

  const showVoiceInput = sttSupported && (voiceSettings?.voice_input_enabled !== false);
  const showVoiceOutput = ttsSupported && (voiceSettings?.voice_output_enabled === true);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-charcoal-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-card w-full md:max-w-lg h-[80vh] md:h-[640px] flex flex-col rounded-t-2xl md:rounded-2xl animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
              <Sparkles size={17} className="text-sage-300" />
            </div>
            <div>
              <h2 className="font-display text-lg text-cream leading-none">Assistant</h2>
              <p className="text-[10px] text-cream-dim mt-1">Your Life OS, in context</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showVoiceOutput && speaking && (
              <button onClick={stopSpeaking} className="text-sage-300 hover:text-sage-200 transition-colors" aria-label="Stop speaking">
                <Square size={16} />
              </button>
            )}
            <button onClick={onClose} className="text-cream-dim hover:text-cream transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-sage-500/20 border-t-sage-300 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-6">
              <div className="w-14 h-14 rounded-2xl bg-sage-500/10 border border-sage-500/20 flex items-center justify-center">
                <Sparkles size={26} className="text-sage-300/70" />
              </div>
              <div>
                <p className="text-sm text-cream font-medium">I'm your Life OS assistant.</p>
                <p className="text-xs text-cream-dim/70 leading-relaxed mt-2">I can see your schedule, tasks, homework, tests, routines, goals, and daily logs — and I can take actions for you. Ask me what to focus on, or try "plan my evening".</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {['What should I focus on?', 'Plan my evening', 'Any tests coming up?'].map((s) => (
                  <button key={s} onClick={() => { setInput(s); }} className="text-[11px] px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-cream-dim hover:text-cream hover:border-white/[0.12] transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-sage-500/10 border border-sage-500/15 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <Sparkles size={13} className="text-sage-300/70" />
                  </div>
                )}
                <div className={`max-w-[78%] ${msg.role === 'user' ? '' : 'w-full max-w-[85%]'}`}>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-sage-500/15 text-cream rounded-br-md border border-sage-500/12'
                        : 'bg-charcoal-800/50 text-cream-muted rounded-bl-md border border-white/[0.04]'
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>

                  {msg.role === 'assistant' && showVoiceOutput && (
                    <button
                      onClick={() => handleSpeakMessage(msg)}
                      className={`mt-1 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                        speaking && lastSpokenRef.current === msg.id
                          ? 'text-sage-300 bg-sage-500/10'
                          : 'text-cream-dim/50 hover:text-cream-dim hover:bg-white/[0.03]'
                      }`}
                    >
                      {speaking && lastSpokenRef.current === msg.id
                        ? <><Square size={9} /> Stop</>
                        : <><Volume2 size={10} /> Listen</>}
                    </button>
                  )}

                  {msg.actionResults && msg.actionResults.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {msg.actionResults.map((result, i) => (
                        <div key={i} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg ${result.success ? 'bg-sage-500/8 text-sage-300' : 'bg-red-500/8 text-red-400/80'}`}>
                          {result.success ? <Check size={12} /> : <AlertCircle size={12} />}
                          {result.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.actions && msg.actions.length > 0 && !msg.pendingConfirmation && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.actions.map((action, ai) => (
                        <button
                          key={ai}
                          onClick={() => handleAction(action, index)}
                          className="text-[11px] px-3 py-1.5 rounded-full border border-sage-500/20 bg-sage-500/8 text-sage-300 hover:bg-sage-500/15 hover:border-sage-500/30 transition-colors flex items-center gap-1.5"
                        >
                          {getActionIcon(action.type)}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.pendingConfirmation && msg.actions && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-cream-dim">Are you sure?</span>
                      {msg.actions.filter((a) => needsConfirmation(a.type)).map((action, ai) => (
                        <button key={ai} onClick={() => handleConfirmDelete(action, index)} className="text-[11px] px-2.5 py-1 rounded-full border border-red-500/20 bg-red-500/8 text-red-400/90 hover:bg-red-500/15 transition-colors flex items-center gap-1">
                          <Trash2 size={11} /> Yes, delete
                        </button>
                      ))}
                      <button onClick={() => handleCancelAction(index)} className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-cream-dim hover:text-cream transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
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
          {recState === 'listening' && (
            <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sage-500/8 border border-sage-500/15">
              <span className="flex gap-1">
                <span className="w-1 h-3 rounded-full bg-sage-300 animate-pulse" />
                <span className="w-1 h-3 rounded-full bg-sage-300 animate-pulse" style={{ animationDelay: '100ms' }} />
                <span className="w-1 h-3 rounded-full bg-sage-300 animate-pulse" style={{ animationDelay: '200ms' }} />
              </span>
              <span className="text-[11px] text-sage-300">{interim || 'Listening...'}</span>
            </div>
          )}
          {recState === 'error' && (
            <p className="mb-2 text-[11px] text-red-400/70">Voice input unavailable — please type instead.</p>
          )}
          <div className="flex items-center gap-2">
            {showVoiceInput && (
              <button
                onClick={toggleListening}
                disabled={thinking}
                className={`p-2.5 rounded-xl border transition-all disabled:opacity-30 ${
                  recState === 'listening'
                    ? 'bg-sage-500/20 border-sage-500/30 text-sage-200'
                    : 'border-white/[0.06] bg-white/[0.02] text-cream-dim hover:text-cream hover:bg-white/[0.04]'
                }`}
                aria-label={recState === 'listening' ? 'Stop recording' : 'Start voice input'}
              >
                {recState === 'listening' ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
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
              onClick={() => handleSend()}
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

function getActionIcon(type: string) {
  if (type.startsWith('complete')) return <Check size={11} />;
  if (type.startsWith('delete')) return <Trash2 size={11} />;
  if (type.startsWith('move') || type.startsWith('create') || type.startsWith('schedule')) return <Calendar size={11} />;
  return <ChevronRight size={11} />;
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
