'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useFilmPlayback } from './useFilmPlayback';
import { FilmDock } from './FilmDock';
import { FilmControls } from './FilmControls';
import { FilmSettingsDialog } from './FilmSettingsDialog';
import { FilmTurbineMenu } from './FilmTurbineMenu';
import { FilmBriefing } from './FilmBriefing';
import { ReactorMenuPrank } from './ReactorMenuPrank';
import { useFilmTurbine } from './useFilmTurbine';
import { getFilmTheme } from './filmThemes';
import { useFilmCamera } from './useFilmCamera';
import { JarvisMain } from './JarvisMain';
import { SmtFactoryExplorer } from './SmtFactoryExplorer';
import { EnvironmentZoneInteraction } from './EnvironmentZoneInteraction';
import { CctvExplorer } from './CctvExplorer';
import { MACHINE_PRESENTATIONS } from './machinePresentation';
import styles from './film.module.css';

export function SignalFilm() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useFilmCamera();
  const cameraView = useRef(true);
  const [preview, setPreview] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const player = useFilmPlayback(canvas, camera.frameRef, cameraView);
  const description = player.position.chapter.id === 'machine' ? MACHINE_PRESENTATIONS[player.machineSubject] : player.position.chapter;
  const cameraMode = {
    ...camera, preview,
    openPreview() { if (player.factory.manual || player.cctv.manual) player.resumeTour(); player.environment.clear(); cameraView.current = true; setPreview(true); setMenuOpen(true); },
    closePreview() { turbine.voice.stop(); camera.stop(); cameraView.current = false; setPreview(false); setMenuOpen(false); },
    enable() { player.environment.clear(); cameraView.current = true; setPreview(true); setMenuOpen(true); },
  };
  const turbine = useFilmTurbine(player,
    () => { cameraMode.openPreview(); setMenuOpen(false); },
    () => cameraMode.closePreview(),
    () => setSettingsOpen(true));
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
    <main className={styles.page} style={themeStyle} data-film-theme={player.theme} data-preview={preview} data-menu-open={menuOpen} data-menu-layout={player.menuLayout}>
      <div className={styles.screen}>
        <canvas ref={canvas} className={styles.canvas} role="img" aria-label={preview
          ? 'HATCHERY 메인 화면의 연속 공간 배경'
          : `${description.title}: ${description.subtitle} 시뮬레이션 연출.`} />
        {!preview && player.ready && player.position.chapter.id === 'visor'
          && <SmtFactoryExplorer canvas={canvas} controller={player.factory} onAuto={player.resumeTour} />}
        {!preview && player.ready && player.position.chapter.id === 'wave'
          && <EnvironmentZoneInteraction canvas={canvas} controller={player.environment} />}
        {!preview && player.ready && player.position.chapter.id === 'cctv'
          && <CctvExplorer canvas={canvas} controller={player.cctv} onAuto={player.resumeTour} />}
        {!preview && !['visor', 'wave', 'cctv'].includes(player.position.chapter.id) && <button type="button" className={styles.screenToggle} disabled={!player.ready}
          aria-label={player.playing ? '연출 화면 일시정지' : '연출 화면 재생'}
          title={player.playing ? '화면을 클릭하면 일시정지' : '화면을 클릭하면 이어서 재생'}
          onClick={player.togglePlay} />}
      </div>
      {preview && <JarvisMain feedStatus={player.feedStatus} externalBriefing theme={player.theme} camera={camera} voice={turbine.voice} onChapter={turbine.selectScene}
        sceneSettings={<FilmControls player={player} camera={cameraMode} />}
        actions={{ sceneData: () => player.sceneData, applySceneObjects: player.applySceneObjects }} />}
      <FilmBriefing text={turbine.voice.messages.filter(message => message.role === 'assistant').at(-1)?.content ?? ''} source={turbine.voice.source}/>
      <FilmDock player={player} camera={cameraMode} menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} />
      {settingsOpen && <FilmSettingsDialog player={player} camera={cameraMode} onClose={() => setSettingsOpen(false)} />}
      <FilmTurbineMenu ready={player.ready} playing={player.playing} voiceActive={turbine.voice.active} onCommand={turbine.command}/>
      {preview && <ReactorMenuPrank/>}
    </main>
  );
}
