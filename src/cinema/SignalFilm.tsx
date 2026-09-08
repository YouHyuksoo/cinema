'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { FILM_CHAPTERS, FILM_SECONDS } from './filmProgram';
import { useFilmPlayback } from './useFilmPlayback';
import { FilmDock } from './FilmDock';
import { getFilmTheme } from './filmThemes';
import { useFilmCamera } from './useFilmCamera';
import { JarvisMain } from './JarvisMain';
import { SmtFactoryExplorer } from './SmtFactoryExplorer';
import { EnvironmentZoneInteraction } from './EnvironmentZoneInteraction';
import styles from './film.module.css';

export function SignalFilm() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useFilmCamera();
  const cameraView = useRef(true);
  const [preview, setPreview] = useState(true);
  const player = useFilmPlayback(canvas, camera.frameRef, cameraView);
  const cameraMode = {
    ...camera, preview,
    openPreview() { if (player.factory.manual) player.resumeTour(); player.environment.clear(); cameraView.current = true; setPreview(true); },
    closePreview() { camera.stop(); cameraView.current = false; setPreview(false); },
    enable() { player.environment.clear(); cameraView.current = true; setPreview(true); },
  };
  const duration = player.mode === 'chapter' ? player.position.chapter.duration : FILM_SECONDS;
  const themeStyle = useMemo(() => {
    const { accent } = getFilmTheme(player.theme);
    return {
      '--film-accent': accent,
      '--film-accent-soft': `color-mix(in srgb, ${accent} 55%, white)`,
      '--film-ink': `color-mix(in srgb, ${accent} 15%, #f0f4f5)`,
      '--film-muted': `color-mix(in srgb, ${accent} 30%, #899399)`,
      '--film-dim': `color-mix(in srgb, ${accent} 24%, #48545b)`,
      '--film-bg': `color-mix(in srgb, ${accent} 5%, #020509)`,
      '--film-panel': `color-mix(in srgb, ${accent} 7%, #020509)`,
      '--film-line': `color-mix(in srgb, ${accent} 22%, #102026)`,
    } as CSSProperties;
  }, [player.theme]);

  return (
    <main className={styles.page} style={themeStyle} data-film-theme={player.theme}>
      <header className={styles.header}>
        <span>{preview ? 'HATCHERY / MAIN INTERFACE' : 'SIGNAL / MOTION STUDIES'}</span>
        <span>{preview ? 'VOICE ASSISTANT · DEMO DATA'
          : `${player.mode === 'chapter' ? '현재 장면' : `${FILM_CHAPTERS.length}개 연출`} · ${(duration / player.speed).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}초 반복`}</span>
      </header>
      <div className={styles.screen}>
        <canvas ref={canvas} className={styles.canvas} role="img" aria-label={preview
          ? 'HATCHERY 메인 화면의 연속 공간 배경'
          : `${player.position.chapter.title}: ${player.position.chapter.subtitle} 시뮬레이션 연출.`} />
        {!preview && player.ready && player.position.chapter.id === 'visor'
          && <SmtFactoryExplorer canvas={canvas} controller={player.factory} onAuto={player.resumeTour} />}
        {!preview && player.ready && player.position.chapter.id === 'wave'
          && <EnvironmentZoneInteraction canvas={canvas} controller={player.environment} />}
        {!preview && !['visor', 'wave'].includes(player.position.chapter.id) && <button type="button" className={styles.screenToggle} disabled={!player.ready}
          aria-label={player.playing ? '연출 화면 일시정지' : '연출 화면 재생'}
          title={player.playing ? '화면을 클릭하면 일시정지' : '화면을 클릭하면 이어서 재생'}
          onClick={player.togglePlay} />}
      </div>
      {preview && <JarvisMain camera={camera} onChapter={id => { cameraMode.closePreview(); player.selectChapter(id); }} />}
      <FilmDock player={player} camera={cameraMode} />
    </main>
  );
}
