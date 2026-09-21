import type { FilmPlayback } from './useFilmPlayback';
import { PLAYBACK_RATE_OPTIONS } from './playbackRates';
import { FILM_CHAPTERS } from './filmProgram';
import styles from './filmQuickMenu.module.css';
import { ENVIRONMENT_TIMING } from './zoneEnvironment';

const icon = (path: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;

export function FilmQuickMenu({ player }: { player: FilmPlayback }) {
  const currentIndex = Math.max(0, PLAYBACK_RATE_OPTIONS.findIndex(option => option.value === String(player.speed)));
  const nextRate = PLAYBACK_RATE_OPTIONS[Math.min(currentIndex + 1, PLAYBACK_RATE_OPTIONS.length - 1)];
  const previousRate = PLAYBACK_RATE_OPTIONS[Math.max(0, currentIndex - 1)];
  const chapterIndex = FILM_CHAPTERS.findIndex(chapter => chapter.id === player.position.chapter.id);
  const previousChapter = chapterIndex > 0 ? FILM_CHAPTERS[chapterIndex - 1] : undefined;
  const nextChapter = chapterIndex >= 0 && chapterIndex < FILM_CHAPTERS.length - 1 ? FILM_CHAPTERS[chapterIndex + 1] : undefined;
  return <>
    <nav className={styles.menu} aria-label="공통메뉴" data-scene-quick-menu="true">
      {player.position.chapter.id === 'wave' && player.position.localTime >= ENVIRONMENT_TIMING.monitoringStart && <span className={styles.label}>MONITORING</span>}
      <button type="button" aria-label="중지" title="중지" disabled={!player.ready || !player.playing} onClick={player.pause}>{icon('M8 5v14M16 5v14')}</button>
      <button type="button" aria-label="시작" title="시작" disabled={!player.ready || player.playing} onClick={player.play}>{icon('M8 5l11 7-11 7Z')}</button>
      <button type="button" aria-label="새로고침" title="현재 연출 다시 시작" disabled={!player.ready} onClick={() => player.selectChapter(player.position.chapter.id)}>{icon('M20 10a8 8 0 1 0-2 8M20 4v6h-6')}</button>
      <button type="button" disabled={!player.ready || currentIndex === 0}
        aria-label={`느리게: ${previousRate.label}`} title="느리게" onClick={() => player.changeSpeed(Number(previousRate.value))}>{icon('M6 12h12')}</button>
      <small aria-label="현재 재생 속도">{player.speed}×</small>
      <button type="button" disabled={!player.ready || !nextRate || currentIndex >= PLAYBACK_RATE_OPTIONS.length - 1}
        aria-label={`빠르게: ${nextRate?.label ?? `${player.speed}배`}`} onClick={() => nextRate && player.changeSpeed(Number(nextRate.value))}>
        {icon('M6 12h12M12 6v12')}
      </button>
    </nav>
    <aside className={styles.navigation} aria-label="연출 이동">
      <button type="button" className={styles.navigationButton} disabled={!player.ready || !previousChapter}
        data-scene-navigation="previous" aria-label={previousChapter ? `이전 연출: ${previousChapter.title}` : '이전 연출 없음'}
        onClick={() => previousChapter && player.selectChapter(previousChapter.id)}>
        {icon('M15 4l-8 8 8 8')}
      </button>
      <button type="button" className={styles.navigationButton} disabled={!player.ready || !nextChapter}
        data-scene-navigation="next" aria-label={nextChapter ? `다음 연출: ${nextChapter.title}` : '다음 연출 없음'}
        onClick={() => nextChapter && player.selectChapter(nextChapter.id)}>
        {icon('M9 4l8 8-8 8')}
      </button>
    </aside>
  </>;
}
