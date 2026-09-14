'use client';

import { useRef, type CSSProperties } from 'react';
import { hatcheryMainData, hatcheryMetrics, type HatcheryMetric } from './jarvisMainData';
import { DEFAULT_FILM_SCENE_DATA, type FilmSceneData, type FilmSceneDataKey } from './filmSceneData';
import { JarvisCubeBayFrame, JarvisMetricFrame } from './JarvisMetricFrame';
import { JarvisSignalScanner } from './JarvisSignalScanner';
import { JarvisMetricInstrument } from './JarvisMetricInstruments';
import { useDriftScroll } from './useDriftScroll';
import styles from './jarvisMetricCards.module.css';
import type { FeedPollSummary } from './feedPolling';
import type { JarvisStreamFocusRequest } from './JarvisStream';
import type { FilmId } from './filmProgram';
import type { SceneDataProvenance } from './sceneDataStore';

interface JarvisMetricCardsProps {
  data?: FilmSceneData;
  feedStatus?: FeedPollSummary | null;
  provenance?: (key: FilmSceneDataKey) => SceneDataProvenance | undefined;
  onFocusMetric?: (request: JarvisStreamFocusRequest) => void;
  onChapter?: (id: FilmId) => void;
}

function JarvisMetricCard({ metric, index, data, feedStatus, provenance, onFocusMetric, onChapter }: {
  metric: HatcheryMetric; index: number; data: FilmSceneData; feedStatus?: FeedPollSummary | null;
  provenance?: JarvisMetricCardsProps['provenance']; onFocusMetric?: JarvisMetricCardsProps['onFocusMetric']; onChapter?: JarvisMetricCardsProps['onChapter'];
}) {
  const cardRef = useRef<HTMLElement>(null);
  const pointerStart = useRef<{ x:number; y:number } | null>(null);
  const focusMetric = () => {
    if (!cardRef.current || !onFocusMetric) return false;
    onFocusMetric({ source:cardRef.current, label:metric.label, side:'left', index });
    return true;
  };
  return <article ref={cardRef} tabIndex={0} role="button" aria-label={`${metric.label} 중앙 확대`}
    onPointerDown={event => { pointerStart.current = { x:event.clientX, y:event.clientY }; }}
    onPointerCancel={() => { pointerStart.current = null; }}
    onClick={event => {
      const start = pointerStart.current; pointerStart.current = null;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
      focusMetric();
    }}
    onKeyDown={event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); event.stopPropagation(); focusMetric();
    }}
    className={styles.card} data-kind={metric.kind} data-warning={metric.warning}
    style={{ '--card-delay': `${-index * 1.7}s`, '--card-period': `${6 + index * 1.3}s` } as CSSProperties}>
    <JarvisMetricFrame />
    <h2>{metric.label}</h2>
    <div className={styles.reading}><strong>{metric.value}</strong><span>{metric.unit}</span></div>
    <JarvisMetricInstrument kind={metric.kind} data={hatcheryMainData(data)} zones={data.environment.zones} />
    <footer>{metric.note}</footer>
  </article>;
}

export function JarvisMetricCards({data=DEFAULT_FILM_SCENE_DATA,feedStatus,provenance,onFocusMetric,onChapter}:JarvisMetricCardsProps = {}) {
  const metrics = hatcheryMetrics(data);
  const sourceLabel = feedStatus?.mode === 'server' ? 'FEED' : feedStatus?.mode === 'error' ? 'ERROR' : 'DEMO';
  const { hostRef: stripRef, viewportRef, paused, setPaused } = useDriftScroll({ axis: 'x', speed: 20, resumeMs: 1000, initialHoldMs: 1500 });
  const setAutoScroll = (enabled:boolean) => setPaused(!enabled);
  return <div ref={stripRef} className={styles.strip} role="region" aria-label="상단 주요 지표" data-metric-strip="true">
    <JarvisCubeBayFrame />
    <div className={styles.signalBay} data-signal-bay="true">
      <JarvisCubeBayFrame />
      <JarvisSignalScanner feedStatus={feedStatus} />
    </div>
    <div className={styles.stripBar}>
      <span>LIVE METRICS / {metrics.length} · {sourceLabel}</span>
      <button type="button" onClick={() => setAutoScroll(paused)} aria-pressed={paused}
        aria-label={`상단 지표 자동 스크롤 ${paused ? '재개' : '정지'}`}>{paused ? '재개 ▷' : '정지 Ⅱ'}</button>
    </div>
    <div ref={viewportRef} className={styles.cards} role="region" tabIndex={0} aria-label="상단 지표 목록"
      aria-describedby="jarvis-metric-scroll-help">
      <span id="jarvis-metric-scroll-help" className={styles.scrollHint}>8개 지표가 자동으로 좌우 이동합니다. 마우스나 키보드 초점을 올리면 멈춥니다. 좌우로 밀거나 방향키로 이동하고 정지 버튼으로 자동 이동을 끌 수 있습니다.</span>
      {metrics.map((metric, i) => <JarvisMetricCard key={metric.kind} metric={metric} index={i} data={data} feedStatus={feedStatus}
        provenance={provenance} onFocusMetric={onFocusMetric} onChapter={onChapter}/>)}
    </div>
  </div>;
}
