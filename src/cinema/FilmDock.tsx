import { useEffect, useRef, useState } from 'react';
import { FilmControls } from './FilmControls';
import { FilmChapterMenu } from './FilmChapterMenu';
import { FilmMenuCube } from './FilmMenuCubeView';
import type { FilmPlayback } from './useFilmPlayback';
import type { FilmCameraMode } from './FilmCameraControls';
import styles from './film.module.css';
import mobileStyles from './filmDock.module.css';
import { MACHINE_PRESENTATIONS } from './machinePresentation';

export function FilmDock({ player, camera, menuOpen, onMenuOpenChange }: {
  player: FilmPlayback; camera: FilmCameraMode; menuOpen: boolean; onMenuOpenChange: (open: boolean) => void;
}) {
  const [settingsOpen, setExpanded] = useState(false);
  const expanded = settingsOpen && !camera.preview;
  const settingsToggle = useRef<HTMLButtonElement>(null);
  const globeButton = useRef<HTMLButtonElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const previousMenuOpen = useRef(menuOpen);
  const focusWasInDock = useRef(false);
  const focusIntent = useRef<'globe' | 'front' | null>(null);

  useEffect(() => {
    const changed = previousMenuOpen.current !== menuOpen;
    previousMenuOpen.current = menuOpen;
    if (!changed || menuOpen) return;
    const active = document.activeElement;
    const survivingOutsideFocus = active instanceof HTMLElement && active !== document.body && !dock.current?.contains(active);
    if (focusIntent.current === 'globe' || (!survivingOutsideFocus && focusWasInDock.current)) {
      globeButton.current?.focus({ preventScroll: true });
    }
    focusIntent.current = null;
  }, [menuOpen]);

  const collapseMenu = () => {
    focusIntent.current = 'globe';
    setExpanded(false);
    onMenuOpenChange(false);
  };
  const expandMenu = () => {
    focusIntent.current = 'front';
    setExpanded(false);
    onMenuOpenChange(true);
  };
  const focusOpenedMenu = () => {
    if (focusIntent.current !== 'front') return;
    const active = document.activeElement;
    const survivingOutsideFocus = active instanceof HTMLElement && active !== document.body && !dock.current?.contains(active);
    if (!survivingOutsideFocus) {
      dock.current?.querySelector<HTMLButtonElement>('[data-front="true"]')?.focus({ preventScroll: true });
    }
    focusIntent.current = null;
  };
  const { chapter, localTime } = player.position;
  return (
    <div ref={dock} id="film-dock-panel" className={`${styles.filmDock} ${mobileStyles.dock}`} data-menu-open={menuOpen} data-menu-layout={player.menuLayout ?? 'dock'}
      onFocusCapture={() => { focusWasInDock.current = true; }}
      onBlurCapture={event => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) focusWasInDock.current = false;
      }}
      onKeyDown={(event) => {
      if (event.key === 'Escape' && expanded) {
        event.stopPropagation(); setExpanded(false); settingsToggle.current?.focus();
      } else if (event.key === 'Escape' && menuOpen) {
        event.stopPropagation(); collapseMenu();
      }
    }}>
      <div className={mobileStyles.panel} data-dock-actions="true" inert={!menuOpen} aria-hidden={!menuOpen}>
      <div id="film-dock-content" className={mobileStyles.content}>
      {expanded && !camera.preview && (
        <section className={styles.dockSettings} id="film-playback-settings" aria-label="연출 설정" data-dock-settings="true">
          <FilmControls player={player} camera={camera} />
        </section>
      )}
      {!expanded && camera.error && <p className={styles.cameraDockError} role="alert">{camera.error}</p>}
      <div className={styles.dockBar} data-dock-bar="true">
        <div className={styles.dockStatus} data-dock-status="true">
          <span className={styles.dockStatusLight} aria-hidden="true" />
          <span>{camera.preview ? 'HATCHERY 메인 메뉴' : chapter.id === 'machine' ? MACHINE_PRESENTATIONS[player.machineSubject].title : chapter.title}</span>
          <span className={styles.dockTime}>{camera.preview ? 'VOICE / CONTROL CENTER'
            : player.factory.manual && chapter.id === 'visor' ? '직접 탐색' : `${localTime.toFixed(1)} / ${chapter.duration}초`}</span>
        </div>
        <div className={styles.dockActions} data-dock-buttons="true">
          {!expanded && <button type="button" className={styles.dockAction} disabled={!player.ready}
            onClick={() => { camera.openPreview(); setExpanded(false); }}>
            메인 메뉴
          </button>}
          {!expanded && !camera.preview && <button type="button" className={styles.dockAction} disabled={!player.ready} onClick={player.togglePlay}>
            {player.playing ? '일시정지' : '재생'}
          </button>}
          {!camera.preview && <button ref={settingsToggle} type="button" className={styles.dockAction}
            aria-expanded={expanded} aria-controls="film-playback-settings"
            onClick={() => setExpanded(!expanded)}>{expanded ? '설정 닫기' : '연출 설정'}</button>}
          <button type="button" className={styles.dockAction} onClick={collapseMenu}>메뉴 축소</button>
        </div>
      </div>
      </div>
      </div>
      <FilmChapterMenu active={camera.preview ? null : chapter.id} disabled={!player.ready} menuOpen={menuOpen} layout={player.menuLayout ?? 'dock'}
        onExpand={expandMenu} onCollapse={collapseMenu} globeButtonRef={globeButton} onOpened={focusOpenedMenu} onSelect={(id) => {
          focusIntent.current = 'globe'; setExpanded(false); camera.closePreview(); player.selectChapter(id); onMenuOpenChange(false);
        }} />
      {camera.preview && <FilmMenuCube links={{ admin: '/cinema/admin', ai: '/cinema/ai' }} />}
    </div>
  );
}
