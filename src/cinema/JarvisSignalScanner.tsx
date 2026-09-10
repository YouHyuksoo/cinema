'use client';

import { useEffect, useState } from 'react';
import styles from './jarvisSignalScanner.module.css';
import { ScannerStatusOrbs } from './ScannerStatusOrbs';
import { ScannerTeslaEffect } from './ScannerTeslaEffect';
import type { FeedPollSummary } from './feedPolling';
import { CONNECTION_LABELS, scannerConnectionStatus } from './scannerConnectionStatus';

/** Where the blips land on the pedestal disc (unit circle, squashed with the disc) and when they flash. */
const BLIPS = [
  { x: .42, y: -.36, delay: 0 }, { x: -.55, y: .18, delay: 2.1 }, { x: .12, y: .58, delay: 4.4 }, { x: -.28, y: -.52, delay: 5.7 },
];
const SWEEP_PERIOD_S = 3.2;
/** One full turn of the drum (top-plate ticks, rings and grid) and of the wall bands. */
const DRUM_TURN_S = 14;

/** Pedestal geometry (viewBox 200×120): a short, wide drum seen slightly from above. */
const TOP_Y = 56, WALL_H = 26, RX = 90, RY = 28;
const BOTTOM_Y = TOP_Y + WALL_H;
const DISC_RX = 66, DISC_RY = Math.round(RY * DISC_RX / RX * 100) / 100; // keeps the disc on the same perspective as the rim
/** Front half of the drum wall between the top and bottom ellipses. */
const WALL_PATH = `M${100 - RX} ${TOP_Y}A${RX} ${RY} 0 0 0 ${100 + RX} ${TOP_Y}V${BOTTOM_Y}A${RX} ${RY} 0 0 1 ${100 - RX} ${BOTTOM_Y}Z`;
/** Tick marks on the top plate's lip; they ride the drum's rotation so the turn is visible from above. */
const PLATE_TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const coordinate=(value:number)=>Number(value.toFixed(3));
const WALL_PANELS = Array.from({ length:7 }, (_, i) => {
  const a=(i+.12)*Math.PI/7, b=(i+.88)*Math.PI/7;
  const x1=100+RX*Math.cos(a), x2=100+RX*Math.cos(b);
  const y1=TOP_Y+RY*Math.sin(a), y2=TOP_Y+RY*Math.sin(b);
  return `M${coordinate(x1)} ${coordinate(y1+4)}L${coordinate(x2)} ${coordinate(y2+4)}V${coordinate(y2+WALL_H-4)}L${coordinate(x1)} ${coordinate(y1+WALL_H-4)}Z`;
});

/**
 * Evidence-backed status spheres orbit above the metal scanner pedestal. SVG/CSS only;
 * existing feed polling supplies connection evidence, with a clock to detect stale observations.
 */
export function JarvisSignalScanner({feedStatus}:{feedStatus?:FeedPollSummary|null} = {}) {
  const [still, setStill] = useState(false);
  const [now,setNow]=useState<number|null>(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setStill(media.matches);
    update(); media.addEventListener('change', update);
    const clock=()=>setNow(Date.now());
    clock();const timer=setInterval(clock,5000);
    return () => { clearInterval(timer);media.removeEventListener('change', update); };
  }, []);
  const connections=scannerConnectionStatus(feedStatus,now??Date.parse(feedStatus?.at??''));
  const receiving=connections.some(item=>item.id==='feed'&&item.state==='on');
  const receiptKey=feedStatus?.feeds.filter(item=>item.enabled&&item.ok).map(item=>`${item.feed}:${item.at}`).join('|')??'none';
  const spin = (period: number, reverse = false) => still ? null
    : <animateTransform attributeName="transform" type="rotate" from={reverse ? '360 0 0' : '0 0 0'} to={reverse ? '0 0 0' : '360 0 0'} dur={`${period}s`} repeatCount="indefinite" />;
  return <div className={styles.scanner} role="group" aria-label={`신호 감지기 연출: ${connections.map(item=>`${item.label} ${CONNECTION_LABELS[item.state]}`).join(' · ')}`} data-signal-scanner="true" data-still={still} data-signal-active={receiving}>
    <span className={styles.label} aria-hidden="true">SIGNAL / SCAN</span>
    <div className={styles.stage} aria-hidden="true">
    <div className={styles.instrument}>
      <ScannerStatusOrbs connections={connections} still={still} />
      <svg className={styles.pedestal} viewBox="0 0 200 120" focusable="false">
        <defs>
          <radialGradient id="hatchery-scan-disc" cx="50%" cy="42%" r="62%">
            <stop offset="0" stopColor="#dffbff" stopOpacity=".95" />
            <stop offset=".18" stopColor="currentColor" stopOpacity=".7" />
            <stop offset=".6" stopColor="currentColor" stopOpacity=".2" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".05" />
          </radialGradient>
          <linearGradient id="hatchery-scan-wedge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" /><stop offset="1" stopColor="currentColor" stopOpacity=".6" />
          </linearGradient>
          <linearGradient id="hatchery-scan-wall" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#081018" /><stop offset=".22" stopColor="#334954" /><stop offset=".48" stopColor="#71848e" />
            <stop offset=".62" stopColor="#415966" /><stop offset=".85" stopColor="#253943" /><stop offset="1" stopColor="#070f16" />
          </linearGradient>
          <linearGradient id="hatchery-scan-rim" x1="0" y1="0" x2=".6" y2="1">
            <stop offset="0" stopColor="#b7c7d0" /><stop offset=".35" stopColor="#5d717d" /><stop offset=".7" stopColor="#25333c" /><stop offset="1" stopColor="#4b5f6b" />
          </linearGradient>
          <linearGradient id="hatchery-scan-lip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1218" /><stop offset="1" stopColor="#1f2d36" />
          </linearGradient>
          <filter id="hatchery-scan-shadow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
          <clipPath id="hatchery-scan-front"><rect x="0" y={TOP_Y} width="200" height={WALL_H + RY} /></clipPath>
        </defs>
        {/* Ground shadow stays on the floor and shrinks as the drum lifts. */}
        <ellipse className={styles.shadow} cx="100" cy={BOTTOM_Y + 6} rx={RX + 4} ry={RY * .5} filter="url(#hatchery-scan-shadow)" />
        <g className={styles.drum}>
          {/* Wall with cylindrical shading; the seam band and light strip slide around it so the drum reads as turning. */}
          <path className={styles.wall} d={WALL_PATH} />
          {WALL_PANELS.map((d,index) => <path key={index} data-pedestal-panel={index} className={styles.wallPanel} d={d} />)}
          <ellipse className={styles.wallBase} cx="100" cy={BOTTOM_Y} rx={RX} ry={RY} clipPath="url(#hatchery-scan-front)" />
          <ellipse className={styles.seamRing} cx="100" cy={TOP_Y + 6} rx={RX} ry={RY} clipPath="url(#hatchery-scan-front)" />
          <ellipse className={styles.wallStrip} cx="100" cy={TOP_Y + 16} rx={RX} ry={RY} clipPath="url(#hatchery-scan-front)" />
          <ellipse className={styles.wallLights} cx="100" cy={TOP_Y + 16} rx={RX} ry={RY} clipPath="url(#hatchery-scan-front)" />
          <ellipse className={styles.wallEdge} cx="100" cy={BOTTOM_Y} rx={RX} ry={RY} clipPath="url(#hatchery-scan-front)" />
          {/* Bevelled top: metal rim, inner lip, groove, then the glass disc recessed in the middle. */}
          <ellipse className={styles.rim} cx="100" cy={TOP_Y} rx={RX} ry={RY} />
          <ellipse className={styles.rimHighlight} cx="100" cy={TOP_Y} rx={RX - 1.5} ry={RY - .5} />
          {PLATE_TICKS.map(angle => <ellipse key={angle} className={styles.bolt} cx={coordinate(100+84*Math.cos(angle*Math.PI/180))} cy={coordinate(TOP_Y+25*Math.sin(angle*Math.PI/180))} rx="1.7" ry=".9" />)}
          <ellipse className={styles.lip} cx="100" cy={TOP_Y + 1} rx={RX - 10} ry={RY - 3.2} />
          <ellipse className={styles.groove} cx="100" cy={TOP_Y + 1} rx={RX - 16} ry={RY - 5} />
          <g transform={`translate(100 ${TOP_Y + 1}) scale(1 ${DISC_RY / DISC_RX})`}>
            <circle className={styles.discWell} r={DISC_RX + 3} />
            <circle className={styles.disc} r={DISC_RX} />
            {/* Everything on the plate turns with the drum: lip ticks, rings, grid and the blips. */}
            <g className={styles.plate}>
              {spin(DRUM_TURN_S)}
              <g className={styles.plateTicks}>
                {PLATE_TICKS.map(angle => <line key={angle} x1={DISC_RX + 4} y1="0" x2={DISC_RX + (angle % 90 === 0 ? 12 : 8)} y2="0" transform={`rotate(${angle})`} />)}
              </g>
              <circle className={styles.discRing} r="56" />
              <circle className={styles.discRing} r="42" />
              <circle className={styles.discRing} r="28" />
              <circle className={styles.discGrid} r="49" />
              <circle className={styles.discGrid} r="35" />
              <path className={styles.discSpokes} d={`M-${DISC_RX} 0H${DISC_RX}M0 -${DISC_RX}V${DISC_RX}`} />
              {BLIPS.map(blip => <g key={`${receiptKey}:${blip.x}:${blip.y}`} transform={`translate(${blip.x * 56} ${blip.y * 56})`}>
                <circle className={styles.ping} r="6" style={{ animationDelay: `${blip.delay}s` }} />
                <circle className={styles.blip} r="2.6" style={{ animationDelay: `${blip.delay}s` }} />
              </g>)}
            </g>
            <path className={styles.sweep} d={`M0 0L${DISC_RX} 0A${DISC_RX} ${DISC_RX} 0 0 0 ${Math.round(DISC_RX * .76)} ${-Math.round(DISC_RX * .65)}Z`}>
              {spin(SWEEP_PERIOD_S)}
            </path>
            <circle className={styles.core} r="6" />
            <circle className={styles.coreHalo} r="11" />
          </g>
          {/* Glass reflection across the disc. */}
          <ellipse className={styles.reflection} cx="82" cy={TOP_Y - 6} rx="34" ry="6" />
        </g>
      </svg>
      <i className={styles.beam} />
    </div>
    </div>
    <ScannerTeslaEffect still={still} details={connections.map(item=>`${item.label}: ${item.detail}`).join('\n')} />
  </div>;
}
