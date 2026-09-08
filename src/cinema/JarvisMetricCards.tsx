import type { CSSProperties } from 'react';
import { jarvisMainData as data, jarvisMainMetrics } from './jarvisMainData';
import { JarvisMetricFrame } from './JarvisMetricFrame';
import styles from './jarvisMetricCards.module.css';

function ProductionInstrument() {
  const ratio = Math.min(1, Math.max(0, data.energy.production.value / data.energy.production.capacity));
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <path d="M8 46 24 56h140l10-10M8 16h164" className={styles.trace} />
    {Array.from({ length: 20 }, (_, i) => <g key={i} opacity={i / 20 < ratio ? 1 : .12}>
      <path d={`M${10 + i * 8} 29l4-5h5l-4 5z`} fill="currentColor" opacity=".5" />
      <path d={`M${10 + i * 8} 29h5v15h-5z`} fill="currentColor" />
      <path d={`M${15 + i * 8} 29l4-5v15l-4 5z`} fill="currentColor" opacity=".25" />
    </g>)}
    <path d="M8 51h160" className={styles.conveyor} />
    <path d={`M${10 + ratio * 160} 18v30`} stroke="var(--film-ink)" strokeWidth="1" />
    <path d="M12 12h24m-5-3 5 3-5 3" className={styles.flow} />
  </svg>;
}

function ProcessInstrument() {
  const points = data.process.nodes.map((_, i) => ({ x: 14 + i * 30, y: i % 2 ? 43 : 22 }));
  const line = points.map(p => `${p.x},${p.y}`).join(' ');
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <polyline points={line} className={styles.trace} />
    <polyline points={line} className={styles.flow} />
    {data.process.nodes.map((node, i) => <g key={node.id} transform={`translate(${points[i].x} ${points[i].y})`} className={data.bottlenecks.includes(node) ? styles.bottleneck : undefined}>
      {data.bottlenecks.includes(node) && <circle r="12" className={styles.warningHalo} />}
      <path d="M-7-4 0-8 7-4v8L0 8-7 4z" fill="var(--film-bg)" stroke="currentColor" />
      <circle r="2.3" fill="currentColor" />
      <text y={i % 2 ? 17 : -12} textAnchor="middle">{node.code}</text>
    </g>)}
  </svg>;
}

function QualityInstrument() {
  const q = data.quality;
  if (!q.valid) return <svg viewBox="0 0 180 64" aria-hidden="true"><text x="90" y="34" textAnchor="middle">NO DATA</text></svg>;
  const values = q.xbar.values;
  const min = Math.min(q.xbar.lower, ...values), max = Math.max(q.xbar.upper, ...values), span = max - min || 1;
  const y = (value: number) => 53 - (value - min) / span * 42;
  const x = (i: number) => 8 + i / Math.max(1, values.length - 1) * 164;
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <path d={`M8 ${y(q.xbar.lower)}H172M8 ${y(q.xbar.upper)}H172`} className={styles.limits} />
    <path d={`M8 ${y(q.xbar.center)}H172`} className={styles.trace} />
    <polyline points={values.map((value, i) => `${x(i)},${y(value)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" />
    {values.map((value, i) => q.xbar.violations[i] && <g key={i} transform={`translate(${x(i)} ${y(value)})`} className={styles.bottleneck}>
      <circle r="6" className={styles.warningHalo} /><circle r="2.5" fill="currentColor" />
    </g>)}
    <path d="M0 6v52" className={styles.qualityScan} />
  </svg>;
}

function PowerInstrument() {
  const ratio = Math.min(1, Math.max(0, data.energy.power.value / data.energy.power.capacity));
  const angle = Math.PI * (1 - ratio);
  return <svg viewBox="0 0 180 64" aria-hidden="true">
    <path d="M16 51a42 42 0 0 1 84 0" fill="none" stroke="currentColor" strokeWidth="7" opacity=".12" />
    <path d="M16 51a42 42 0 0 1 84 0" fill="none" stroke="currentColor" strokeWidth="7" pathLength="100" strokeDasharray={`${ratio * 100} 100`} />
    <path d="M10 51a48 48 0 0 1 96 0" className={styles.powerOrbit} />
    <path d={`M58 51L${58 + Math.cos(angle) * 30} ${51 - Math.sin(angle) * 30}`} stroke="var(--film-ink)" strokeWidth="1.6" />
    <circle cx="58" cy="51" r="3" fill="currentColor" />
    <path d="M108 31h13l5-15 10 35 7-20h29" className={styles.trace} />
    <path d="M108 31h13l5-15 10 35 7-20h29" className={styles.powerFlow} />
    <text x="146" y="62" textAnchor="middle">{Math.round(ratio * 100)}% LOAD</text>
  </svg>;
}

const instruments = [ProductionInstrument, ProcessInstrument, QualityInstrument, PowerInstrument];
const kinds = ['production', 'process', 'quality', 'power'];
const notes = [
  `목표 ${data.energy.production.capacity.toLocaleString('en-US')} EA`,
  data.bottlenecks.map(node => node.label).join(' · ') || '병목 없음',
  data.quality.valid ? `X̄ · ${data.qualitySource.subgroups.length}개 부분군` : '데이터 확인 필요',
  `용량 ${data.energy.power.capacity} ${data.energy.power.unit}`,
];

export function JarvisMetricCards() {
  return <div className={styles.cards} aria-label="상단 주요 지표">
    {jarvisMainMetrics.map((metric, i) => {
      const Instrument = instruments[i];
      return <article className={styles.card} key={metric.label} data-kind={kinds[i]} data-warning={metric.warning}
        style={{ '--card-delay': `${-i * 1.7}s`, '--card-period': `${6 + i * 1.3}s` } as CSSProperties}>
        <JarvisMetricFrame />
        <h2>{metric.label}</h2>
        <div className={styles.reading}><strong>{metric.value}</strong><span>{metric.unit}</span></div>
        <Instrument />
        <footer>{notes[i]}</footer>
      </article>;
    })}
  </div>;
}
