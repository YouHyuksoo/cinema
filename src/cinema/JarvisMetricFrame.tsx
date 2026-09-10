import styles from './jarvisMetricCards.module.css';

/** Shared clipped HUD frame; stretches with the card while strokes retain their width. */
export function JarvisMetricFrame() {
  return <svg className={styles.frame} viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path className={styles.frameOutline} d="M28 3H297V131L271 157H3V28Z" />
    <path className={styles.frameInset} d="M30 7H293V129L269 153H7V30Z" />
    <path className={styles.framePlate} d="M49 3H146L139 10H56ZM151 3H187L183 0H155ZM133 157H188L195 151H229L223 157H267L264 160H137Z" />
    <path className={styles.frameRail} d="M225 3H297V55M3 106V157H69" />
    <path className={styles.frameHighlight} d="M3 64V28L28 3H45M297 103V131L271 157H247" />
    <path className={styles.framePlate} d="M11 143H17V151H11ZM22 143H28V151H22ZM33 143H39V151H33ZM44 143H50V151H44Z" />
  </svg>;
}

/**
 * The cube bay at the strip's left end, in the same frame language as the cards: cut corners (top-right and
 * bottom-left, as the bay always had), a double outline, two heavy corner rails, soft highlights along the
 * cuts, filled plate tabs and segment marks. Stretches with the bay; strokes keep their width.
 */
export function JarvisCubeBayFrame() {
  return <svg className={styles.bayFrame} viewBox="0 0 160 160" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-cube-bay-frame="true">
    <path className={styles.frameOutline} d="M3 3H131L157 29V157H29L3 131Z" />
    <path className={styles.frameInset} d="M7 7H128L153 32V153H32L7 128Z" />
    <path className={styles.frameRail} d="M3 62V3H62M157 98V157H98" />
    <path className={styles.frameHighlight} d="M108 3H131L157 29V52M52 157H29L3 131V108" />
    <path className={styles.framePlate} d="M42 3H98L93 9H47ZM157 66V94L151 90V70ZM62 157H118L113 151H67ZM3 68V96L9 92V72Z" />
    <path className={styles.framePlate} d="M138 143H144V151H138ZM127 143H133V151H127ZM116 143H122V151H116ZM9 9H17V17H9ZM20 9H28V17H20Z" />
  </svg>;
}
