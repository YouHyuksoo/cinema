'use client';

import { useState, type CSSProperties } from 'react';
import { DEFAULT_ENVIRONMENT_DATA, environmentZoneStatus, type ZoneEnvironmentData } from './zoneEnvironment';
import { temperatureHistoryPoints, temperatureHistoryDomain } from './temperatureHistory';
import styles from './environmentFloorMonitor.module.css';
import type { FeedPollSummary } from './feedPolling';

const callouts = [
  { card:[16,27], anchor:[22,38] }, { card:[37,18], anchor:[39,29] },
  { card:[58,20], anchor:[53,31] }, { card:[25,48], anchor:[28,40] },
  { card:[47,55], anchor:[49,64] }, { card:[69,61], anchor:[76,69] },
  { card:[12,66], anchor:[21,53] }, { card:[64,43], anchor:[67,36] },
  { card:[84,42], anchor:[79,33] }, { card:[43,39], anchor:[45,32] },
] as const;
const reading = (n: number | null, humidity = false) => n === null || !Number.isFinite(n) || (humidity && (n < 0 || n > 100)) ? '—' : n.toFixed(1);

export function EnvironmentFloorMonitor({ data, feedStatus }: { data: ZoneEnvironmentData; feedStatus?: FeedPollSummary | null }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const zones = data.zones.slice(0, callouts.length);
  const feed = feedStatus?.feeds.find(item => item.feed === 'environment');
  const stale = feedStatus?.mode === 'error' || (feed?.enabled && !feed.ok);
  const zone = zones.find(z => z.id === selected) ?? zones[0];
  const end = data.historyEnd ?? zone?.temperatureHistory?.reduce((last, p) => Number.isFinite(p.at) ? Math.max(last, p.at) : last, 0);
  const points = temperatureHistoryPoints(zone?.temperatureHistory, end);
  const domain = temperatureHistoryDomain(points.map(p => p.value), zone ? [zone.temperatureRange] : []);
  let path = '', gap = true;
  for (const point of points) {
    if (point.value === null) { gap = true; continue; }
    path += `${gap ? 'M' : 'L'}${point.position * 1000},${55 - (point.value - domain.min) / (domain.max - domain.min) * 50} `;
    gap = false;
  }
  return <section className={styles.monitor} aria-label="공장 평면도 온습도 모니터링" data-environment-floor-monitor>
    <header><span>ENVIRONMENT / FLOOR MONITOR</span><h2>구역별 온습도</h2><p>{data === DEFAULT_ENVIRONMENT_DATA ? '시연 데이터' : stale ? '갱신 지연 · 마지막 수신값' : '센서 데이터'} · 공간과 설치 위치는 예시 배치</p></header>
    <div className={styles.map}>
      {/* Static generated background: live readings are never baked into this image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/cinema/environment-factory.png" alt="천장을 걷어낸 공장 입체 평면도" onError={() => setImageFailed(true)} />
      {imageFailed && <p className={styles.empty}>공장 배경을 불러오지 못했습니다. 센서 데이터는 아래에 표시됩니다.</p>}
      <svg className={styles.links} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {callouts.map(({ card:[x,y], anchor:[ax,ay] }, i) => {
          const bendY = y + (ay - y) * .55;
          return <g key={`link-${i}`} data-status={zones[i] ? environmentZoneStatus(zones[i]) : 'missing'}>
            <path d={`M${x} ${y} L${x} ${bendY} L${ax} ${ay}`} />
            <circle cx={ax} cy={ay} r=".42" vectorEffect="non-scaling-stroke" />
          </g>;
        })}
      </svg>
      {callouts.map(({ card:[x, y] }, i) => {
        const item = zones[i];
        if (!item) return <button key={`unassigned-${i}`} className={styles.sensor} data-status="missing" disabled
          aria-label={`센서 슬롯 ${i + 1} 미연결`} style={{ '--x': `${x}%`, '--y': `${y}%` } as CSSProperties}>
          <span className={styles.name}>SENSOR {String(i + 1).padStart(2, '0')}</span>
          <span className={styles.role}>설비 환경 · 온습도 센서</span>
          <span className={styles.values}><b>—<small> °C</small></b><b>—<small> %</small></b></span>
          <span className={styles.state}>미연결</span>
        </button>;
        return <button key={item.id} className={styles.sensor} data-status={environmentZoneStatus(item)}
        aria-pressed={zone?.id === item.id} onClick={() => setSelected(item.id)}
        style={{ '--x': `${x}%`, '--y': `${y}%` } as CSSProperties}>
        <span className={styles.name}>{item.name} {item.name !== item.id && <small>{item.id}</small>}</span>
        <span className={styles.role}>설비 환경 · 온습도 센서</span>
        <span className={styles.values}><b>{reading(item.temperature)}<small> °C</small></b><b>{reading(item.humidity, true)}<small> %</small></b></span>
        <span className={styles.state}>{environmentZoneStatus(item) === 'outside' ? '관리 범위 이탈' : environmentZoneStatus(item) === 'missing' ? '데이터 확인 필요' : '관리 범위 내'}</span>
      </button>; })}
    </div>
    <footer className={styles.history}>
      <div><strong>{zone?.name ?? '센서 데이터 대기 중'}</strong><span>온도 · 최근 24시간</span></div>
      {points.some(p => p.value !== null) ? <svg viewBox="0 0 1000 65" preserveAspectRatio="none" role="img" aria-label={`${zone?.name} 최근 24시간 온도 이력`}>
        <path d="M0 5H1000M0 30H1000M0 55H1000" stroke="#ffffff18" fill="none" />
        <path d={path} stroke="#8ce2df" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
      </svg> : <p>온도 이력 없음 · 수신된 데이터만 표시합니다</p>}
      <span className={styles.hint}>센서 선택 → 이력 확인</span>
    </footer>
  </section>;
}
