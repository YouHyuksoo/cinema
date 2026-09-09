'use client';
import { useEffect, useRef, type RefObject } from 'react';
import type { JarvisAudioFrame } from './jarvisAudio';
import { drawJarvisVoiceField } from './drawJarvisVoiceField';
import { voiceCoreEnvelope, VOICE_CORE_VIEW } from './jarvisVoiceCore';

export function JarvisWave({ audio }: { audio: RefObject<JarvisAudioFrame> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    let frame = 0, previous = 0, level = 0, visualTime = 0;
    let samples = new Uint8Array(1024);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => {
      const rect = node.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      node.width = Math.max(1, rect.width * dpr); node.height = Math.max(1, rect.height * dpr);
    };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    const draw = (now: number) => {
      const { phase, analyser } = audio.current;
      const seconds = previous ? Math.min((now - previous) / 1000, .1) : 0;
      previous = now;
      if (!motion.matches) visualTime += seconds;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, node.width, node.height);
      const { width, height } = VOICE_CORE_VIEW;
      const scale = Math.min(node.width / width, node.height / height);
      ctx.setTransform(scale, 0, 0, scale, (node.width - width * scale) / 2, (node.height - height * scale) / 2);
      let target = 0;
      if (!motion.matches && analyser && (phase === 'listening' || phase === 'speaking')) {
        if (samples.length !== analyser.fftSize) samples = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(samples);
        for (const sample of samples) target += ((sample - 128) / 128) ** 2;
        target = Math.min(1, Math.sqrt(target / samples.length) * 5);
      } else samples.fill(128);
      level = voiceCoreEnvelope(level, target, seconds);
      drawJarvisVoiceField(ctx, { time: visualTime, phase, level, samples, reduced: motion.matches });
      frame = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(frame); previous = 0;
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', visibility); visibility();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [audio]);
  return <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="음성 반응형 입체 코어: 듣기·생각·말하기 상태와 실제 음량에 반응하는 구체와 궤도 파형" role="img" />;
}
