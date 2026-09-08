import { useId } from 'react';
import styles from './jarvisStream.module.css';

/** Segments show the supplied ratio; the rotating registration rings are purely optical. */
export function JarvisHoloGauge({ value, unit, ratio, label, warning = false }: {
  value: string; unit: string; ratio: number; label: string; warning?: boolean;
}) {
  const fill = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const id = useId();
  return <svg viewBox="0 0 240 190" className={styles.holoGauge} data-warning={warning} role="img" aria-label={`${label} ${value} ${unit}`}>
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox">
        <stop stopColor="currentColor" stopOpacity=".12" /><stop offset=".28" stopColor="currentColor" stopOpacity=".75" />
        <stop offset=".5" stopColor="#eafaff" stopOpacity=".85" /><stop offset=".58" stopColor="currentColor" stopOpacity=".2" /><stop offset="1" stopColor="currentColor" stopOpacity=".45" />
      </linearGradient>
      <radialGradient id={`${id}-glass`}><stop stopColor="currentColor" stopOpacity="0" /><stop offset=".8" stopColor="currentColor" stopOpacity=".02" /><stop offset="1" stopColor="currentColor" stopOpacity=".14" /></radialGradient>
    </defs>
    <ellipse cx="120" cy="159" rx="83" ry="13" fill="none" stroke="currentColor" opacity=".12" />
    <circle cx="120" cy="95" r="73" fill="none" stroke="currentColor" strokeWidth="6" opacity=".13" />
    <path d="M47 88v7m146-7v7M68 140v7m104-7v7" stroke="currentColor" opacity=".4" />
    <circle cx="120" cy="88" r="73" fill={`url(#${id}-glass)`} stroke={`url(#${id}-rim)`} strokeWidth="2" />
    <path d="M43 123 37 155 85 175M197 123 203 155 155 175" fill="none" stroke="currentColor" opacity=".18" />
    <g className={styles.orbit}>
      <circle cx="120" cy="88" r="83" fill="none" stroke="currentColor" strokeWidth=".7" strokeDasharray="80 12 9 12" opacity=".55" />
      <circle cx="120" cy="88" r="78" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="5" strokeDasharray="59 10 9 45" opacity=".8" />
    </g>
    <g className={styles.counterOrbit}>
      <circle cx="120" cy="88" r="87" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 5" opacity=".3" />
      <circle cx="120" cy="88" r="57" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="45 20 4 20" opacity=".4" />
    </g>
    <circle cx="120" cy="92" r="65" fill="none" stroke="currentColor" strokeWidth="8" opacity=".06" />
    {Array.from({ length: 40 }, (_, i) => {
      const angle = (-225 + i * 6.75) * Math.PI / 180;
      return <line key={i} x1={120 + Math.cos(angle) * 62} y1={88 + Math.sin(angle) * 62}
        x2={120 + Math.cos(angle) * 70} y2={88 + Math.sin(angle) * 70}
        stroke="currentColor" strokeWidth="3.4" opacity={i / 40 < fill ? .9 : .12} />;
    })}
    <circle cx="120" cy="88" r="54" fill="currentColor" fillOpacity=".025" stroke="currentColor" strokeWidth=".5" strokeOpacity=".28" />
    <path d="M8 88h28m168 0h28M120 0v12M120 165v17" stroke="currentColor" strokeWidth=".8" opacity=".5" />
    <text x="120" y="81" textAnchor="middle" className={styles.gaugeValue}>{value}</text>
    <text x="120" y="102" textAnchor="middle" className={styles.gaugeUnit}>{unit}</text>
    <text x="120" y="136" textAnchor="middle" className={styles.gaugeCaption}>{label}</text>
    <text x="21" y="180" className={styles.gaugeCaption}>◈ SIGNAL LOCK</text>
    <text x="218" y="180" textAnchor="end" className={styles.gaugeCaption}>{Math.round(fill * 100)}%</text>
  </svg>;
}

export function JarvisMiniDial({ label, value, ratio, warning = false, variant = 'arcs' }: {
  label: string; value: string; ratio: number; warning?: boolean; variant?: 'arcs' | 'sectors' | 'vernier' | 'double' | 'blocks';
}) {
  const fill = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return <div className={styles.miniDial} data-warning={warning}>
    <svg viewBox="0 0 80 80" role="img" aria-label={`${label} ${value}`}>
      <circle cx="40" cy="43" r="29" fill="none" stroke="currentColor" strokeWidth="4" opacity=".13" />
      <g className={styles.miniOrbit}>
        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor"
          strokeWidth={variant === 'sectors' ? 4 : variant === 'blocks' ? 3 : 1}
          strokeDasharray={variant === 'sectors' ? '36 19' : variant === 'vernier' ? '1 3' : variant === 'blocks' ? '5 6' : '25 6 2 6'} opacity=".65" />
        {variant === 'double' && <circle cx="40" cy="40" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="65 54" opacity=".45" />}
      </g>
      <circle cx="40" cy="40" r="29" fill="none" stroke="currentColor" strokeWidth="3" opacity=".1" />
      <circle cx="40" cy="40" r="29" fill="none" stroke="currentColor" strokeWidth={variant === 'blocks' ? 5 : 3} pathLength="100" strokeDasharray={`${fill * 100} 100`} transform="rotate(-90 40 40)" />
      <path d="M14 30A28 28 0 0 1 33 13" fill="none" stroke="#e8f9ff" opacity=".55" strokeWidth=".6" />
      <circle cx="40" cy="40" r="23" fill="currentColor" fillOpacity=".025" stroke="currentColor" strokeWidth=".5" opacity=".5" />
      <text x="40" y="44" textAnchor="middle">{value}</text>
    </svg><span>{label}</span>
  </div>;
}
