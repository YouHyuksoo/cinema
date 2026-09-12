'use client';
import { useEffect, useRef, useState } from 'react';
import { recognitionConstructor, type JarvisRecognition } from './jarvisAudio';

/** Dictation only: never submits a message or starts an AI session. */
export function useInputDictation(input: string, onInput: (value: string) => void, blocked: boolean) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const session = useRef<JarvisRecognition | null>(null);
  const latest = useRef({ input, onInput }); latest.current = { input, onInput };
  const stop = () => { const current = session.current; session.current = null; current?.abort(); setActive(false); };
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); session.current?.abort(); session.current = null; };
  }, []);
  useEffect(() => { if (blocked) stop(); }, [blocked]);
  const toggle = () => {
    if (session.current) { stop(); return; }
    if (blocked) return;
    const Recognition = recognitionConstructor();
    if (!Recognition) { setError('이 브라우저는 음성 입력을 지원하지 않습니다.'); return; }
    const recognition = new Recognition(); session.current = recognition;
    recognition.lang = 'ko-KR'; recognition.continuous = true; recognition.interimResults = false;
    recognition.onstart = () => { if (session.current === recognition) setActive(true); };
    recognition.onend = () => { if (session.current === recognition) { session.current = null; setActive(false); } };
    recognition.onerror = event => { if (session.current === recognition) { setError(event.error === 'not-allowed' ? '마이크 권한을 허용해주세요.' : '음성 입력을 계속할 수 없습니다. 다시 눌러주세요.'); stop(); } };
    recognition.onresult = event => {
      if (session.current !== recognition) return;
      const parts = [];
      for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) parts.push(event.results[i][0].transcript);
      if (!parts.length) return;
      const next = [latest.current.input, parts.join(' ')].filter(Boolean).join(' ');
      if (next.length > 1200) { setError('입력은 1,200자까지 가능합니다.'); stop(); return; }
      latest.current.input = next; latest.current.onInput(next);
    };
    setError('');
    try { recognition.start(); } catch { session.current = null; setActive(false); setError('음성 입력을 시작하지 못했습니다.'); }
  };
  return { active, error, toggle };
}
