import styles from './cyanPanelBackdrop.module.css';

/** Vector instrument panel, shared by the live stage and its background thumbnail. */
export function CyanPanelBackdrop() {
  return <svg className={styles.panel} viewBox="0 0 800 400" preserveAspectRatio="none"
    aria-hidden="true" focusable="false" data-center-backdrop="cyan-panel" fill="none">
    <path fill="#02131d" d="M0 0h800v400H0z" />
    <g stroke="#0b3541" strokeWidth=".5" opacity=".45">
      {Array.from({ length: 25 }, (_, i) => <path key={`v${i}`} d={`M${i * 32} 0v400`} />)}
      {Array.from({ length: 13 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 32}h800`} />)}
    </g>
    <g className={styles.faint}>
      <circle cx="400" cy="200" r="186" strokeDasharray="42 8" />
      <circle cx="400" cy="200" r="163" strokeDasharray="4 9" strokeWidth="13" />
      <path d="M26 62 255 60 301 104M774 62 545 60 499 104M28 342l227-3 43-47M772 342l-227-3-43-47" />
    </g>
    <g className={styles.frame}>
      <path d="M16 20 294 51H506L784 20M16 380l278-31h212l278 31" strokeWidth="5" />
      <path d="M14 34 288 62h224L786 34M14 366l274-29h224l274 29" strokeWidth="1.5" />
      <path d="M53 64Q6 204 68 336M747 64q47 140-15 272" strokeWidth="5" />
      <path d="M35 72Q-3 203 49 328M765 72q38 131-14 256" strokeWidth="4" strokeDasharray="1 7" />
      <path d="M40 199h51l11 10h140M560 200h148l13-10h36" strokeWidth="6" />
      <path d="M40 187h190M566 189h167" strokeWidth="2" />
    </g>
    <g transform="translate(400 200)">
      <circle className={styles.rim} r="139" strokeWidth="13" strokeDasharray="29 8" />
      <circle className={styles.faint} r="127" strokeWidth="2" />
      <circle className={styles.ticks} r="116" strokeWidth="13" strokeDasharray="1.5 5" />
      <circle className={styles.rim} r="102" strokeWidth="3" />
      <circle className={styles.sweep} r="91" strokeWidth="8" strokeDasharray="130 40 80 38" />
      <circle className={styles.faint} r="76" />
      <path className={styles.faint} d="M-34 0h17M17 0h17M0-34v17M0 17v17" />
    </g>
    {[160, 640].map((x, i) => <g key={x} transform={`translate(${x} 282)`}>
      <circle className={styles.faint} r="57" />
      <circle className={styles.rim} r="49" strokeWidth="9" strokeDasharray="24 4" />
      <circle className={styles.ticks} r="40" strokeWidth="4" strokeDasharray="1 3" />
      <circle className={styles.rim} r="34" strokeWidth="1.5" />
      <path className={styles.faint} d={i ? 'M-20 0h40M0-20v40' : 'M-19 8l10-14 12 9 16-13'} />
    </g>)}
    <g className={styles.rim} strokeWidth="7">
      <path d="M40 145h113M40 158h59M40 171h38" />
      <path d="M609 178v-58m19 58v-25m19 25v-17m19 17v-40m19 40v-24" />
    </g>
  </svg>;
}
