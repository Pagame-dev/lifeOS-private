import { supabase } from '@/lib/supabase';
import type { LifeContext } from './ai-context';
import type { AIAction, ActionResult } from './ai-actions';
import { executeAction, needsConfirmation } from './ai-actions';

export interface ConversationTurn {
  userMessage: string;
  assistantResponse: string;
  actions?: AIAction[];
  actionResults?: ActionResult[];
  timestamp: Date;
}

export interface AIResponse {
  text: string;
  actions?: AIAction[];
  actionResults?: ActionResult[];
}

const conversationHistory: ConversationTurn[] = [];

export function resetConversation() {
  conversationHistory.length = 0;
}

export function getConversationHistory(): ConversationTurn[] {
  return [...conversationHistory];
}

export async function processMessage(userMessage: string, ctx: LifeContext): Promise<AIResponse> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) {
    return { text: "I can't connect right now — please sign in again." };
  }

  const historyForApi = conversationHistory.slice(-10).map((t) => ({
    role: t.userMessage ? 'user' : 'assistant',
    content: t.userMessage || t.assistantResponse,
  }));

  const payload = {
    context: {
      ...ctx,
      now: ctx.now.toISOString(),
      conversationHistory: historyForApi,
      userMessage,
    },
  };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      if (res.status === 503) {
        return { text: "I need an OpenAI API key to work. You can add one in Settings under AI Personalisation." };
      }
      return { text: `I couldn't connect to my reasoning service: ${data.error || res.status}. Please try again.` };
    }

    const data = await res.json() as { text: string; actions?: AIAction[] };

    conversationHistory.push({
      userMessage,
      assistantResponse: data.text,
      actions: data.actions,
      timestamp: new Date(),
    });

    if (conversationHistory.length > 20) conversationHistory.shift();

    return { text: data.text, actions: data.actions };
  } catch (err) {
    return { text: `Something went wrong connecting to the AI service: ${(err as Error).message}. Please try again.` };
  }
}

export { executeAction, needsConfirmation };
