'use client';

import type { CSSProperties } from 'react';
import { jarvisMainMetrics } from './jarvisMainData';
import { JarvisMetricFrame } from './JarvisMetricFrame';
import { JarvisMetricInstrument } from './JarvisMetricInstruments';
import { useDriftScroll } from './useDriftScroll';
import styles from './jarvisMetricCards.module.css';

export function JarvisMetricCards() {
  const { hostRef: stripRef, viewportRef, paused, toggle } = useDriftScroll({ axis: 'x', speed: 20, resumeMs: 1000, initialHoldMs: 1500 });
  return <div ref={stripRef} className={styles.strip} role="region" aria-label="상단 주요 지표" data-metric-strip="true">
    <div className={styles.stripBar}>
      <span>LIVE METRICS / {jarvisMainMetrics.length} · DEMO</span>
      <button type="button" onClick={toggle} aria-pressed={paused}
        aria-label={`상단 지표 자동 스크롤 ${paused ? '재개' : '정지'}`}>{paused ? '재개 ▷' : '정지 Ⅱ'}</button>
    </div>
    <div ref={viewportRef} className={styles.cards} role="region" tabIndex={0} aria-label="상단 지표 목록"
      aria-describedby="jarvis-metric-scroll-help">
      <span id="jarvis-metric-scroll-help" className={styles.scrollHint}>8개 지표가 자동으로 좌우 이동합니다. 마우스나 키보드 초점을 올리면 멈춥니다. 좌우로 밀거나 방향키로 이동하고 정지 버튼으로 자동 이동을 끌 수 있습니다.</span>
      {jarvisMainMetrics.map((metric, i) => <article className={styles.card} key={metric.kind} data-kind={metric.kind} data-warning={metric.warning}
        style={{ '--card-delay': `${-i * 1.7}s`, '--card-period': `${6 + i * 1.3}s` } as CSSProperties}>
        <JarvisMetricFrame />
        <h2>{metric.label}</h2>
        <div className={styles.reading}><strong>{metric.value}</strong><span>{metric.unit}</span></div>
        <JarvisMetricInstrument kind={metric.kind} />
        <footer>{metric.note}</footer>
      </article>)}
    </div>
  </div>;
}
