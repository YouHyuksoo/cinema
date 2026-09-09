'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { JarvisAudioFrame } from './jarvisAudio';
import { drawJarvisVoiceField } from './drawJarvisVoiceField';
import { voiceCoreCanvasTransform, voiceCoreEnvelope } from './jarvisVoiceCore';
import { createReactorEggPlayback } from './reactorEasterEgg';
import styles from './jarvisWave.module.css';

export function JarvisWave({ audio }: { audio: RefObject<JarvisAudioFrame> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const egg = useRef(createReactorEggPlayback());
  const [playing, setPlaying] = useState(false);
  const start = () => {
    if (egg.current.start(window.matchMedia('(prefers-reduced-motion: reduce)').matches)) setPlaying(true);
  };
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    let frame = 0, previous = 0, level = 0, visualTime = 0, cssW = 1, cssH = 1, dpr = 1, lastPhase = '';
    const playback = egg.current;
    let samples = new Uint8Array(1024);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => {
      const rect = node.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      cssW = Math.max(1, rect.width); cssH = Math.max(1, rect.height);
      node.width = Math.max(1, cssW * dpr); node.height = Math.max(1, cssH * dpr);
      const fit = voiceCoreCanvasTransform(cssW, cssH);
      if (trigger.current) {
        const size = Math.max(44, 224 * fit.scale);
        Object.assign(trigger.current.style, { width: size + 'px', height: size + 'px',
          left: (cssW - size) / 2 + 'px', top: (cssH - size) / 2 + 'px' });
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node); if (node.parentElement) observer.observe(node.parentElement); resize();
    const draw = (now: number) => {
      const { phase, analyser } = audio.current;
      const seconds = previous ? Math.min((now - previous) / 1000, .1) : 0;
      previous = now;
      if (!motion.matches) visualTime += seconds;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, node.width, node.height);
      const fit = voiceCoreCanvasTransform(cssW, cssH, dpr);
      ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.x, fit.y);
      let target = 0;
      if (!motion.matches && analyser && (phase === 'listening' || phase === 'speaking')) {
        if (samples.length !== analyser.fftSize) samples = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(samples);
        for (const sample of samples) target += ((sample - 128) / 128) ** 2;
        target = Math.min(1, Math.sqrt(target / samples.length) * 5);
      } else samples.fill(128);
      level = voiceCoreEnvelope(level, target, seconds);
      const wasActive = playback.active, eggFrame = playback.advance(seconds, motion.matches);
      if (wasActive && !playback.active) setPlaying(false);
      const eggPhase = eggFrame?.phase ?? 'idle';
      if (eggPhase !== lastPhase) { node.dataset.easterEgg = eggPhase; lastPhase = eggPhase; }
      const expression = eggFrame && eggFrame.anger > .98 ? 'angry' : 'calm';
      if (node.dataset.expression !== expression) node.dataset.expression = expression;
      drawJarvisVoiceField(ctx, { time: visualTime, phase, level, reduced: motion.matches, egg: eggFrame });
      frame = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(frame); previous = 0;
      if (document.hidden) { playback.cancel(); setPlaying(false); }
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', visibility); visibility();
    return () => { playback.cancel(); cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [audio]);
  return <div className={styles.stage}>
    <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="회전하는 아크 리액터: 음성 크기에 반응하는 테슬라 스파크" role="img" />
    <button ref={trigger} type="button" className={styles.trigger} aria-label="리액터 이스터에그 재생" aria-disabled={playing}
      onClick={start} onKeyDown={event => {
        if (event.key === 'Escape' && egg.current.active) {
          event.preventDefault(); event.stopPropagation(); egg.current.cancel(); setPlaying(false);
        }
      }} />
    <span className={styles.announcement} role="status">{playing ? '우주선 추격 연출 중. Escape로 취소할 수 있습니다.' : ''}</span>
  </div>;
}
