import styles from './jarvisIdentity.module.css';

/** A repeating signal → flat trace → neon wordmark sequence. */
export function JarvisIdentity() {
  return <div className={styles.identity} role="img" aria-label="JARVIS 핑크 네온 로고">
    <svg viewBox="0 0 220 120" aria-hidden="true" focusable="false">
      <g className={styles.signal}>
        <g className={styles.drift}>
          <path className={styles.echo} d="M8 60C22 60 27 35 40 35S58 85 72 85 90 27 107 27 129 92 146 92 167 38 181 38 198 60 212 60" />
          <path className={styles.wave} d="M8 60C24 60 29 80 43 80S61 28 77 28 96 89 112 89 129 32 145 32 164 80 180 80 199 60 212 60" />
          <path className={styles.filament} d="M8 60C29 60 37 44 52 44S77 78 94 78 116 40 133 40 155 75 173 75 197 60 212 60" />
        </g>
      </g>
      <path className={styles.line} d="M8 60H212" />
      <text className={styles.word} x="110" y="71" textAnchor="middle" textLength="202" lengthAdjust="spacingAndGlyphs">J.A.R.V.I.S.</text>
      <path className={styles.underline} d="M43 85H177" />
      <circle className={styles.node} cx="8" cy="60" r="2" />
      <circle className={styles.node} cx="212" cy="60" r="2" />
    </svg>
  </div>;
}
