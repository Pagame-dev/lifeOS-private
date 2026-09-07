import { useEffect, useRef, useState, useCallback } from 'react';

type RecognitionState = 'idle' | 'listening' | 'processing' | 'error';

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

type SpeechRecognitionInstance = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const [state, setState] = useState<RecognitionState>('idle');
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const supported = getRecognitionConstructor() !== null;

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor) {
      setState('error');
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim('');
        setState('processing');
        onTranscript(finalText.trim());
      }
    };

    rec.onerror = () => {
      setState('error');
      setInterim('');
    };

    rec.onend = () => {
      setState((prev) => (prev === 'processing' ? prev : 'idle'));
      setInterim('');
    };

    recRef.current = rec;
    setState('listening');
    setInterim('');
    rec.start();
  }, [onTranscript]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setState('idle');
    setInterim('');
  }, []);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { state, interim, start, stop, supported };
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const speak = useCallback((text: string, opts?: { voice?: string; rate?: number }) => {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\*\*/g, '').replace(/\n/g, ' ');
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.rate = opts?.rate ?? 1.0;
    if (opts?.voice) {
      const match = voices.find((v) => v.name === opts.voice);
      if (match) utter.voice = match;
    }
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utterRef.current = utter;
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }, [supported, voices]);

  const stopSpeaking = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, stopSpeaking, speaking, voices, supported };
}
