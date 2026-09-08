'use client';
import { useEffect, useRef, type RefObject } from 'react';
import type { JarvisAudioFrame } from './jarvisAudio';
import { drawJarvisVoiceField } from './drawJarvisVoiceField';

export function JarvisWave({ audio }: { audio: RefObject<JarvisAudioFrame> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    let frame = 0;
    const samples = new Uint8Array(1024);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const rect = node.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      node.width = Math.max(1, rect.width * dpr); node.height = Math.max(1, rect.height * dpr);
    };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    const draw = (now: number) => {
      const { phase, analyser } = audio.current;
      const time = reduced ? 0 : now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, node.width, node.height);
      const scale = Math.min(node.width / 800, node.height / 280);
      ctx.setTransform(scale, 0, 0, scale, (node.width - 800 * scale) / 2, (node.height - 280 * scale) / 2);
      let level = 0;
      if (analyser && (phase === 'listening' || phase === 'speaking')) {
        analyser.getByteTimeDomainData(samples);
        for (const sample of samples) level += ((sample - 128) / 128) ** 2;
        level = Math.min(1, Math.sqrt(level / samples.length) * 5);
      } else samples.fill(128);
      const accent = getComputedStyle(node).getPropertyValue('--film-accent').trim() || '#5fe3ff';
      drawJarvisVoiceField(ctx, { time, phase, level, samples, accent });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [audio]);
  return <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="대기 중에는 잔잔한 물결, 수신 중에는 마이크 신호에 반응하는 음성 파동" role="img" />;
}
