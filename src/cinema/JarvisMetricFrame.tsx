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
