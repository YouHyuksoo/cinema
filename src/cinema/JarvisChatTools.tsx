'use client';
import { useRef, useState } from 'react';
import { JarvisCameraPopup } from './JarvisCameraPopup';
import type { FilmCamera } from './useFilmCamera';
import styles from './jarvisChatTools.module.css';
import { useInputDictation } from './useInputDictation';

export function JarvisChatTools({ camera, voiceActive, input, onInput }: {
  camera: FilmCamera; voiceActive: boolean; input: string; onInput(value: string): void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const dictation = useInputDictation(input, onInput, voiceActive);
  return <div className={styles.tools}>
    <JarvisCameraPopup camera={camera} icon />
    <button type="button" aria-label="텍스트 파일 첨부" title="TXT · MD · CSV 첨부" onClick={() => file.current?.click()}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12 7-7a4 4 0 0 1 6 6L11 21a6 6 0 0 1-8-8L13 3m-7 12 10-10m-8 12 10-10" /></svg>
    </button>
    <input ref={file} type="file" hidden accept=".txt,.md,.csv" aria-label="첨부할 텍스트 파일" onChange={async event => {
      const selected = event.currentTarget.files?.[0]; event.currentTarget.value = ''; setError('');
      if (!selected) return;
      if (!/\.(txt|md|csv)$/i.test(selected.name) || selected.size > 12000) { setError('TXT·MD·CSV 파일만 첨부할 수 있습니다. 질문과 파일 내용은 합계 1,200자 이내여야 합니다.'); return; }
      try {
        const content = await selected.text();
        const next = [input, `[첨부: ${selected.name}]\n${content}`].filter(Boolean).join('\n\n');
        if (next.length > 1200) { setError('질문과 첨부 내용이 1,200자를 초과합니다. 파일 내용을 줄여주세요.'); return; }
        onInput(next);
      } catch { setError('파일을 읽지 못했습니다.'); }
    }} />
    <button type="button" aria-label={dictation.active ? '음성입력 종료' : '음성입력 시작'} title={voiceActive ? 'AI 대화를 종료한 후 음성입력을 사용하세요' : '음성을 입력창에 텍스트로 입력'}
      aria-pressed={dictation.active} disabled={voiceActive} onClick={dictation.toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></svg>
    </button>
    {dictation.error && <span className={styles.error} role="alert">{dictation.error}</span>}
    {error && <span className={styles.error} role="alert">{error}<button type="button" aria-label="첨부 안내 닫기" onClick={() => setError('')}>×</button></span>}
  </div>;
}
