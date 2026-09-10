'use client';
import { useEffect, useRef } from 'react';
import { createFrameLoop, watchPageVisibility, watchReducedMotion } from './filmMotion';
import styles from './jarvisHeader.module.css';

/** Optical heading demo, not a device compass reading. */
export function JarvisHeading() {
  const tape = useRef<SVGGElement>(null);
  const dial = useRef<SVGGElement>(null);
  const reading = useRef<SVGTextElement>(null);
  useEffect(() => {
    const motion = watchReducedMotion();
    const loop = createFrameLoop(now => {
      const angle = motion.reduced ? 90 : 90 + Math.sin(now / 18000) * 42 + Math.sin(now / 7000) * 7;
      tape.current?.setAttribute('transform', `translate(${430 - angle * 4} 0)`);
      dial.current?.setAttribute('transform', `rotate(${-angle} 36 34)`);
      if (reading.current) reading.current.textContent = `${angle.toFixed(1).padStart(5, '0')}°`;
    });
    const unwatch = watchPageVisibility(hidden => hidden ? loop.stop() : loop.start());
    if (!document.hidden) loop.start();
    return () => { loop.stop(); unwatch(); motion.stop(); };
  }, []);
  return <div className={styles.heading} role="img" aria-label="움직이는 나침반과 방위각 눈금 · 시연 연출">
    <svg viewBox="0 0 860 68" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className={styles.grid}>
        {[15, 30, 47, 65].map(y => <path key={y} d={`M0 ${y}H860`} />)}
        {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${430 + (i - 8) * 42} 0L${430 + (i - 8) * 78} 68`} />)}
      </g>
      <svg x="95" y="0" width="670" height="68" viewBox="95 0 670 68" overflow="hidden">
        <g ref={tape} transform="translate(70 0)">
          {Array.from({ length: 145 }, (_, i) => {
            const angle = (i - 36) * 5, normalized = (angle + 360) % 360;
            const cardinal: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
            return <g key={i} transform={`translate(${angle * 4} 0)`}>
              <path d={`M0 38v${angle % 15 === 0 ? 12 : 6}`} opacity={angle % 15 === 0 ? .7 : .28} />
              {angle % 30 === 0 && <text y="29" textAnchor="middle" className={cardinal[normalized] ? styles.cardinal : styles.degree}>{cardinal[normalized] ?? normalized.toString().padStart(3, '0')}</text>}
            </g>;
          })}
        </g>
      </svg>
      <path d="M425 4h10l-5 7zM430 12v5M423 55h14" className={styles.pointer} />
      <g ref={dial}>
        <circle cx="36" cy="34" r="24" fill="none" strokeDasharray="2 4" opacity=".5" />
        <path d="M36 12 43 41 36 36 29 41z" className={styles.pointer} />
      </g>
      <text x="80" y="61" className={styles.caption}>AZIMUTH / DEMO</text>
      <text ref={reading} x="852" y="32" textAnchor="end" className={styles.value}>090.0°</text>
      <text x="852" y="49" textAnchor="end" className={styles.caption}>HEADING</text>
    </svg>
  </div>;
}
