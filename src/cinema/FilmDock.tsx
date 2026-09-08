import { useRef, useState } from 'react';
import { FilmControls } from './FilmControls';
import { FilmChapterMenu } from './FilmChapterMenu';
import type { FilmPlayback } from './useFilmPlayback';
import type { FilmCameraMode } from './FilmCameraControls';
import styles from './film.module.css';

export function FilmDock({ player, camera }: { player: FilmPlayback; camera: FilmCameraMode }) {
  const [expanded, setExpanded] = useState(false);
  const settingsToggle = useRef<HTMLButtonElement>(null);
  const { chapter, localTime } = player.position;
  return (
    <div className={styles.filmDock} onKeyDown={(event) => {
      if (event.key === 'Escape' && expanded) {
        setExpanded(false); settingsToggle.current?.focus();
      }
    }}>
      {expanded && (
        <section className={styles.dockSettings} id="film-playback-settings" aria-label="연출 설정">
          <FilmControls player={player} camera={camera} />
        </section>
      )}
      {!expanded && camera.error && <p className={styles.cameraDockError} role="alert">{camera.error}</p>}
      <div className={styles.dockBar}>
        <div className={styles.dockStatus}>
          <span className={styles.dockStatusLight} aria-hidden="true" />
          <span>{camera.preview ? '자비스 메인 메뉴' : chapter.title}</span>
          <span className={styles.dockTime}>{camera.preview ? 'VOICE / CONTROL CENTER'
            : player.factory.manual && chapter.id === 'visor' ? '직접 탐색' : `${localTime.toFixed(1)} / ${chapter.duration}초`}</span>
        </div>
        <div className={styles.dockActions}>
          {!expanded && <button type="button" className={styles.dockAction} disabled={!player.ready}
            onClick={camera.openPreview}>
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
  );
}
