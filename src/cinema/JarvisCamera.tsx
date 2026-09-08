'use client';
import { useEffect, useRef } from 'react';
import type { FilmCamera } from './useFilmCamera';
import { cameraPortraitCrop } from './cameraPortrait';
export function JarvisCamera({ camera }: { camera: FilmCamera }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    let frame = 0;
    const draw = () => {
      const { video, status, mirror, zoom, face, blur } = camera.frameRef.current;
      ctx.clearRect(0, 0, 480, 360);
      if (status === 'on' && video && video.readyState >= 2) {
        const crop = cameraPortraitCrop(video.videoWidth, video.videoHeight, zoom, face);
        if (crop) {
          ctx.save(); if (mirror) { ctx.translate(480, 0); ctx.scale(-1, 1); }
          ctx.filter = `blur(${blur * .018}px) saturate(.5) contrast(1.1)`;
          // Cover a small operator viewport without stretching the portrait crop.
          const h = crop.width * .75, yy = crop.y + (crop.height - h) * .28;
          ctx.drawImage(video, crop.x, yy, crop.width, h, 0, 0, 480, 360); ctx.restore();
        }
      } else {
        ctx.strokeStyle = '#5fe3ff33'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(240, 131, 48, 64, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(123, 310); ctx.bezierCurveTo(125, 207, 355, 207, 357, 310); ctx.stroke();
      }
      ctx.strokeStyle = '#5fe3ff0a'; ctx.lineWidth = 1;
      for (let y = 0; y < 360; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(480, y); ctx.stroke(); }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [camera.frameRef]);
  return <canvas ref={canvas} width={480} height={360} role="img" aria-label={camera.status === 'on' ? '우측 상단 운영자 카메라 영상' : '운영자 카메라 대기'} style={{ width: '100%', display: 'block' }} />;
}
