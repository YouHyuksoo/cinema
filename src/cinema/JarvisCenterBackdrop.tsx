import styles from './jarvisCenterBackdrop.module.css';

/** Decorative HUD coordinates follow the four control bays in the central scene. */
function CornerFrame({ transform }: { transform?: string }) {
  return <g transform={transform}>
    <path className={styles.frameWash} d="M24 65 54 30H219L240 51V166L221 185H24Z" />
    <path className={styles.frameOuter} d="M24 185V65L54 30H219L240 51M24 185H221L250 212" />
    <path className={styles.frameInner} d="M31 177V68L58 39H112M145 39H213L235 61V159L216 177H31" />
    <path className={styles.frameAccent} d="M27 105V68L57 34H101M27 181H174L194 201M133 32H212L240 60" />
    <path className={styles.fineTrace} d="M48 25H226L267 66H302M37 157H62L77 143H176L210 175M57 48H190L206 63" />
    <path className={styles.tinyBars} d="M114 48h7m4 0h7m4 0h7m4 0h7M208 83h20m-20 7h20m-20 7h13" />
  </g>;
}

export function JarvisCenterBackdrop() {
  return <div className={styles.backdrop} aria-hidden="true" data-center-backdrop="neon-hud">
    <div className={styles.grid} />
    <svg className={styles.frames} viewBox="0 0 800 500" preserveAspectRatio="none" focusable="false">
      <CornerFrame />
      <CornerFrame transform="translate(800 0) scale(-1 1)" />
      <CornerFrame transform="translate(0 500) scale(1 -.78) translate(0 2)" />
      <CornerFrame transform="translate(800 500) scale(-1 -.78) translate(0 2)" />
      <g className={styles.sideTraces}>
        <path d="M28 220H170L195 245H250M28 252H55L78 275H205M28 306H114L140 283H251" />
        <path d="M772 220H630L605 245H550M772 252H745L722 275H595M772 306H686L660 283H549" />
        <path d="M36 236H84M716 236H764M54 267H183M617 267H746" />
      </g>
      <g className={styles.edgeTicks}>
        <path d="M292 22V33M318 22V33M344 22V33M370 22V33M430 22V33M456 22V33M482 22V33M508 22V33M292 467V478M318 467V478M344 467V478M370 467V478M430 467V478M456 467V478M482 467V478M508 467V478" />
        <path d="M19 210H26M19 230H26M19 250H26M19 270H26M19 290H26M774 210H781M774 230H781M774 250H781M774 270H781M774 290H781" />
      </g>
    </svg>
    <svg className={styles.reactorRing} viewBox="0 0 400 400" focusable="false">
      <circle className={styles.outerTrack} cx="200" cy="200" r="185" />
      <circle className={styles.disc} cx="200" cy="200" r="155" />
      <circle className={styles.segmentedRing} cx="200" cy="200" r="165" pathLength="100" />
      <circle className={styles.fineRing} cx="200" cy="200" r="165" pathLength="100" />
      <circle className={styles.innerTrack} cx="200" cy="200" r="147" />
      <circle className={styles.innerArc} cx="200" cy="200" r="130" pathLength="100" />
      <circle className={styles.innerTicks} cx="200" cy="200" r="119" pathLength="100" />
      <path className={styles.reticle} d="m200 3-5 10h10Zm0 394-5-10h10ZM96 200l10-6v12Zm208 0-10-6v12Z" />
      <path className={styles.crosshair} d="M193 200h14m-7-7v14" />
    </svg>
  </div>;
}
