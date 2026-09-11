'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { JarvisAudioFrame } from './jarvisAudio';
import { drawJarvisVoiceField } from './drawJarvisVoiceField';
import { voiceCoreCanvasTransform, voiceCoreEnvelope } from './jarvisVoiceCore';
import { createReactorEggPlayback } from './reactorEasterEgg';
import { reactorTriggerStyle } from './reactorTriggerLayout';
import { createFilmThemeContext } from './filmThemeCanvas';
import type { FilmThemeId } from './filmThemes';
import { createFrameLoop, watchPageVisibility, watchReducedMotion } from './filmMotion';
import styles from './jarvisWave.module.css';
import { easterEggSequence } from './easterEggSequence';

export function JarvisWave({ audio, theme = 'cyan' }: { audio: RefObject<JarvisAudioFrame>; theme?: FilmThemeId }) {
  const palette = useRef<ReturnType<typeof createFilmThemeContext> | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const egg = useRef(createReactorEggPlayback());
  const finished = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const finish = useCallback(() => { finished.current?.(); finished.current = null; setPlaying(false); }, []);
  const start = () => {
    const root = trigger.current?.closest('main');
    if (root) easterEggSequence(root).play();
  };
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    const themed = createFilmThemeContext(ctx);
    palette.current = themed;
    let previous = 0, level = 0, visualTime = 0, cssW = 1, cssH = 1, dpr = 1, lastPhase = '';
    const playback = egg.current;
    let samples = new Uint8Array(1024);
    const motion = watchReducedMotion();
    const root = node.closest('main');
    const unregister = root && easterEggSequence(root).register('ship', done => {
      if (!playback.start(motion.reduced)) return false;
      finished.current = done; setPlaying(true); return true;
    });
    const resize = () => {
      const rect = node.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      cssW = Math.max(1, rect.width); cssH = Math.max(1, rect.height);
      node.width = Math.max(1, cssW * dpr); node.height = Math.max(1, cssH * dpr);
      if (trigger.current) {
        Object.assign(trigger.current.style, reactorTriggerStyle(cssW, cssH));
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node); if (node.parentElement) observer.observe(node.parentElement); resize();
    const draw = (now: number) => {
      const { phase, analyser } = audio.current;
      const seconds = previous ? Math.min((now - previous) / 1000, .1) : 0;
      previous = now;
      if (!motion.reduced) visualTime += seconds;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, node.width, node.height);
      const fit = voiceCoreCanvasTransform(cssW, cssH, dpr);
      ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.x, fit.y);
      let target = 0;
      if (!motion.reduced && analyser && (phase === 'listening' || phase === 'speaking')) {
        if (samples.length !== analyser.fftSize) samples = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(samples);
        for (const sample of samples) target += ((sample - 128) / 128) ** 2;
        target = Math.min(1, Math.sqrt(target / samples.length) * 5);
      } else samples.fill(128);
      level = voiceCoreEnvelope(level, target, seconds);
      const wasActive = playback.active, eggFrame = playback.advance(seconds, motion.reduced);
      if (wasActive && !playback.active) finish();
      const eggPhase = eggFrame?.phase ?? 'idle';
      if (eggPhase !== lastPhase) { node.dataset.easterEgg = eggPhase; lastPhase = eggPhase; }
      const expression = eggFrame && eggFrame.anger > .98 ? 'angry' : 'calm';
      if (node.dataset.expression !== expression) node.dataset.expression = expression;
      drawJarvisVoiceField(themed.ctx, { time: visualTime, phase, level, reduced: motion.reduced, egg: eggFrame }, ctx);
    };
    const loop = createFrameLoop(draw);
    const visibility = (hidden: boolean) => {
      loop.stop(); previous = 0;
      if (hidden) { playback.cancel(); finish(); }
      else loop.start();
    };
    const unwatch = watchPageVisibility(visibility); visibility(document.hidden);
    return () => { unregister?.(); finish(); playback.cancel(); loop.stop(); observer.disconnect(); unwatch(); motion.stop(); };
  }, [audio, finish]);
  // Recolor the existing renderer, without cancelling a running Easter egg or resetting its clock.
  useEffect(() => { palette.current?.setTheme(theme); }, [theme, audio]);
  return <div className={styles.stage}>
    <canvas ref={canvas} data-reactor-theme={theme} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="회전하는 아크 리액터: 음성 크기에 반응하는 테슬라 스파크" role="img" />
    <button ref={trigger} type="button" data-reactor-trigger className={styles.trigger} aria-label="다음 이스터에그 재생" aria-disabled={playing}
      onClick={start} onKeyDown={event => {
        if (event.key === 'Escape' && egg.current.active) {
          event.preventDefault(); event.stopPropagation(); egg.current.cancel(); finish();
        }
      }} />
    <span className={styles.announcement} role="status">{playing ? '우주선 추격 연출 중. Escape로 취소할 수 있습니다.' : ''}</span>
  </div>;
}
