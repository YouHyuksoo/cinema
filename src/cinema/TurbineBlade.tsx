import { useId } from 'react';
import type { TurbineCommand } from './turbineCommands';
import styles from './filmTurbineMenu.module.css';

const outline = 'M57 3 Q84 13 96 37 L88 82 Q76 100 48 109 L22 96 Q7 71 8 43 Q25 15 57 3Z';
export function TurbineBlade() {
  const id = useId().replace(/:/g, '');
  return <svg className={styles.bladeArt} viewBox="0 0 104 120" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eef0f1"/><stop offset=".24" stopColor="#929a9f"/><stop offset=".5" stopColor="#343d44"/><stop offset=".77" stopColor="#cad0d3"/><stop offset="1" stopColor="#515b62"/></linearGradient>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#69727a"/><stop offset=".38" stopColor="#343d46"/><stop offset="1" stopColor="#10171f"/></linearGradient>
      <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b5d3de" stopOpacity=".55"/><stop offset=".28" stopColor="#213644" stopOpacity=".75"/><stop offset=".68" stopColor="#07121c" stopOpacity=".9"/><stop offset="1" stopColor="#6a91a2" stopOpacity=".65"/></linearGradient>
      <pattern id={`${id}-grain`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><path d="M0 0H5M0 2H3" stroke="#dae6ec" strokeOpacity=".13" strokeWidth=".45"/></pattern>
    </defs>
    <g className={styles.thickness}>
      <path d={outline} transform="translate(0 18)" fill="#07101855" stroke="#98c3d580" strokeWidth="2.5"/>
      <path d="M8 43Q7 71 22 96L48 109Q76 100 88 82L96 37V55L88 100Q76 118 48 127L22 114Q7 89 8 61Z" fill={`url(#${id}-side)`} stroke="#08121ac0" strokeWidth="1.5"/>
      <path d="M22 96v18M48 109v18M88 82v18M8 43v18" stroke="#c7e9f578" strokeWidth="1.5"/>
      <path d="M24 110 48 123 69 114" fill="none" stroke="var(--film-accent)" strokeOpacity=".55" strokeWidth="2"/>
      <path d="M12 75 22 104 47 117 75 104" fill="none" stroke="#02080a99" strokeWidth="3"/>
    </g>
    <path d={outline} fill={`url(#${id}-rim)`} fillOpacity=".72" stroke="#d2e8f1ba" strokeWidth="2.2"/>
    <path d="M57 8 Q81 17 90 38 L83 79 Q71 95 48 102 L26 91 Q13 70 14 45 Q29 19 57 8Z" fill={`url(#${id}-face)`} fillOpacity=".62" stroke="#b2daed40" strokeWidth="1.4"/>
    <path d={outline} fill={`url(#${id}-grain)`}/>
    <path d="M18 79 27 95 48 109 64 102" fill="none" stroke="#03090e55" strokeWidth="7"/>
    <path className={styles.inlay} d="M20 79 29 93 48 104 64 98" fill="none" strokeWidth="3"/>
    <path d="M16 44Q30 20 56 9" fill="none" stroke="#ffffff70" strokeWidth="1.3"/>
  </svg>;
}
export function TurbineCommandIcon({ command }: { command: TurbineCommand }) {
  const paths: Record<TurbineCommand, string> = {
    home: 'M3 11 12 3l9 8M6 10v11h5v-7h3v7h4V10',
    briefing: 'M6 3h13v19H6zM9 8h7M9 12h7M9 16h5',
    settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
    logout: 'M10 4H4v16h6M9 12h12m-4-4 4 4-4 4',
    conversation: 'M21 11c0 5-4 8-9 8H7l-5 3 2-6a8 8 0 0 1-2-5c0-5 4-8 10-8s9 3 9 8ZM7 10v3m5-5v7m5-5v3',
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d={paths[command]}/></svg>;
}
