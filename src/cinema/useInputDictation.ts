'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { recognitionConstructor, type JarvisRecognition } from './jarvisAudio';
import { playJarvisShutdownSound } from './jarvisShutdownSound';

/** One local utterance fills the input, then reports the final text after browser-detected silence. */
export function useInputDictation(input: string, onInput: (value: string) => void, blocked: boolean,
  onSubmit: (value: string) => void) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const session = useRef<JarvisRecognition | null>(null);
  const latest = useRef({ input, onInput, onSubmit }); latest.current = { input, onInput, onSubmit };
  const stop = useCallback(() => { const current = session.current; session.current = null; current?.abort(); setActive(false); }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      const current = session.current; session.current = null; current?.abort();
    };
  }, [stop]);
  useEffect(() => { if (blocked) stop(); }, [blocked, stop]);
  const toggle = () => {
    if (session.current) { stop(); playJarvisShutdownSound(); return; }
    if (blocked) return;
    const Recognition = recognitionConstructor();
    if (!Recognition) { setError('이 브라우저는 음성 입력을 지원하지 않습니다.'); return; }
    const recognition = new Recognition(); session.current = recognition;
    let hasFinal = false;
    recognition.lang = 'ko-KR'; recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => { if (session.current === recognition) setActive(true); };
    recognition.onend = () => {
      if (session.current !== recognition) return;
      session.current = null; setActive(false);
      const message = latest.current.input.trim();
      if (hasFinal && message) latest.current.onSubmit(message);
    };
    recognition.onerror = event => { if (session.current === recognition) { setError(event.error === 'not-allowed' ? '마이크 권한을 허용해주세요.' : '음성 입력을 계속할 수 없습니다. 다시 눌러주세요.'); stop(); } };
    recognition.onresult = event => {
      if (session.current !== recognition) return;
      const parts = [];
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) parts.push(event.results[i][0].transcript);
      if (!parts.length) return;
      const next = [latest.current.input, parts.join(' ')].filter(Boolean).join(' ');
      if (next.length > 1200) { setError('입력은 1,200자까지 가능합니다.'); stop(); return; }
      hasFinal = true;
      latest.current.input = next; latest.current.onInput(next);
    };
    setError('');
    try { recognition.start(); } catch { session.current = null; setActive(false); setError('음성 입력을 시작하지 못했습니다.'); }
  };
  return { active, error, toggle, stop };
}
