import { useId, type CSSProperties, type ReactNode } from 'react';
import styles from './scannerGyroscope.module.css';

const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

/** Metal annulus faces and stacked sidewalls keep each gimbal solid when viewed edge-on. */
function Gimbal({ axis, metal, children }: { axis:'yaw'|'pitch'|'roll'; metal:string; children?:ReactNode }) {
  return <div className={`${styles.axis} ${styles[axis]}`} data-gyro-axis={axis}>
    {[-2, 0, 2].map(depth => <i key={depth} className={styles.wall} style={{ '--wall-depth':`${depth}px` } as CSSProperties} />)}
    {['back', 'front'].map(face => <svg key={face} data-gyro-face={face} className={`${styles.face} ${styles[face]}`} viewBox="0 0 100 100" focusable="false">
      <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${metal})`} strokeWidth="10" />
      <circle className={styles.inlay} cx="50" cy="50" r="44" />
      <circle className={styles.rail} cx="50" cy="50" r="49" />
      <circle className={styles.innerRail} cx="50" cy="50" r="39" />
      {TICKS.map((angle, i) => <line key={angle} className={styles.tick} x1="50" y1="2" x2="50" y2={i % 3 === 0 ? 10 : 6} transform={`rotate(${angle} 50 50)`} />)}
      <circle className={styles.clamps} cx="50" cy="50" r="44" />
    </svg>)}
    <i className={`${styles.bearing} ${styles.bearingLeft}`} /><i className={`${styles.bearing} ${styles.bearingRight}`} />
    {children}
  </div>;
}

/** Nested yaw / pitch / roll share one center, with independent continuous full rotations. */
export function ScannerGyroscope({ still }: { still:boolean }) {
  const metal = `scanner-metal-${useId().replace(/:/g, '')}`;
  return <div className={styles.gyro} data-still={still}>
    <svg className={styles.definitions} width="0" height="0" aria-hidden="true"><defs>
      <linearGradient id={metal} x1="0" y1="0" x2=".8" y2="1">
        <stop offset="0" stopColor="#eff6f8" /><stop offset=".18" stopColor="#708592" />
        <stop offset=".45" stopColor="#142731" /><stop offset=".65" stopColor="#8196a2" /><stop offset="1" stopColor="#263e4b" />
      </linearGradient>
    </defs></svg>
    <Gimbal axis="yaw" metal={metal}>
      <Gimbal axis="pitch" metal={metal}>
        <Gimbal axis="roll" metal={metal} />
      </Gimbal>
    </Gimbal>
    <span className={styles.sensor}><i /></span>
  </div>;
}
