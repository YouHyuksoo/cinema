import { useEffect, useRef, useState } from 'react';
import { FilmControls } from './FilmControls';
import { FilmChapterMenu } from './FilmChapterMenu';
import type { FilmPlayback } from './useFilmPlayback';
import type { FilmCameraMode } from './FilmCameraControls';
import styles from './film.module.css';
import mobileStyles from './filmDock.module.css';

export function FilmDock({ player, camera, menuOpen, onMenuOpenChange }: {
  player: FilmPlayback; camera: FilmCameraMode; menuOpen: boolean; onMenuOpenChange: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const settingsToggle = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (camera.preview) return;
    if (menuOpen) panel.current?.querySelector<HTMLButtonElement>('[data-front="true"]')?.focus({ preventScroll: true });
    else anchor.current?.focus({ preventScroll: true });
  }, [menuOpen, camera.preview]);
  const { chapter, localTime } = player.position;
  return (
    <div className={`${styles.filmDock} ${mobileStyles.dock}`} data-menu-open={menuOpen} onKeyDown={(event) => {
      if (event.key === 'Escape' && expanded) {
        event.stopPropagation(); setExpanded(false); settingsToggle.current?.focus();
      } else if (event.key === 'Escape' && menuOpen && !camera.preview) {
        event.stopPropagation(); onMenuOpenChange(false);
      }
    }}>
      <div ref={panel} id="film-dock-panel" className={mobileStyles.panel} inert={!menuOpen} aria-hidden={!menuOpen}>
      <div id="film-dock-content" className={mobileStyles.content}>
      {expanded && (
        <section className={styles.dockSettings} id="film-playback-settings" aria-label="연출 설정">
          <FilmControls player={player} camera={camera} />
        </section>
      )}
      {!expanded && camera.error && <p className={styles.cameraDockError} role="alert">{camera.error}</p>}
      <div className={styles.dockBar}>
        <div className={styles.dockStatus}>
          <span className={styles.dockStatusLight} aria-hidden="true" />
          <span>{camera.preview ? 'HATCHERY 메인 메뉴' : chapter.title}</span>
          <span className={styles.dockTime}>{camera.preview ? 'VOICE / CONTROL CENTER'
            : player.factory.manual && chapter.id === 'visor' ? '직접 탐색' : `${localTime.toFixed(1)} / ${chapter.duration}초`}</span>
        </div>
        <div className={styles.dockActions}>
          {!expanded && <button type="button" className={styles.dockAction} disabled={!player.ready}
            onClick={() => { camera.openPreview(); setExpanded(false); }}>
            메인 메뉴
          </button>}
          {!expanded && !camera.preview && <button type="button" className={styles.dockAction} disabled={!player.ready} onClick={player.togglePlay}>
            {player.playing ? '일시정지' : '재생'}
          </button>}
          <button ref={settingsToggle} type="button" className={styles.dockAction}
            aria-expanded={expanded} aria-controls="film-playback-settings"
            onClick={() => setExpanded(!expanded)}>{expanded ? '설정 닫기' : '연출 설정'}</button>
        </div>
      </div>
      <FilmChapterMenu active={camera.preview ? null : chapter.id} disabled={!player.ready} onSelect={(id) => {
        camera.closePreview(); player.selectChapter(id); setExpanded(false);
      }} />
      </div>
      </div>
      {!camera.preview && <button ref={anchor} type="button" className={mobileStyles.anchor}
        data-open={menuOpen} aria-expanded={menuOpen} aria-controls="film-dock-panel"
        aria-label={menuOpen ? '하단 메뉴 닫기' : '하단 메뉴 펼치기'}
        onClick={() => { setExpanded(false); onMenuOpenChange(!menuOpen); }}>
        <span className={mobileStyles.anchorSignal} aria-hidden="true"><i /><i /></span>
        <span>{menuOpen ? '메뉴 접기' : '메뉴 펼치기'}</span>
      </button>}
    </div>
  );
}
