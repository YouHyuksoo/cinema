'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useFilmPlayback } from './useFilmPlayback';
import { FilmDock } from './FilmDock';
import { FilmMenuCube } from './FilmMenuCubeView';
import { FilmSceneSettings, FilmThemeSettings } from './FilmControls';
import { FilmSettingsDialog } from './FilmSettingsDialog';
import { FilmTurbineMenu } from './FilmTurbineMenu';
import { FilmBriefing } from './FilmBriefing';
import { sceneBriefing } from './sceneBriefing';
import { ReactorMenuPrank } from './ReactorMenuPrank';
import { useFilmTurbine } from './useFilmTurbine';
import { getFilmTheme } from './filmThemes';
import { useFilmCamera } from './useFilmCamera';
import { JarvisMain } from './JarvisMain';
import { SmtFactoryExplorer } from './SmtFactoryExplorer';
import { EnvironmentZoneInteraction } from './EnvironmentZoneInteraction';
import { CctvExplorer } from './CctvExplorer';
import FactoryExplorer3D from './FactoryExplorer3D';
import { MACHINE_PRESENTATIONS } from './machinePresentation';
import styles from './film.module.css';
import { useScreenCommands } from './useScreenCommands';
import { JarvisCameraPopup } from './JarvisCameraPopup';
import { JarvisVoiceIndicator } from './JarvisVoiceIndicator';
import { createScreenObjectRegistry } from './screenObjectRegistry';
import { ScreenObjectProvider } from './ScreenObjectContext';
import { useFilmEscapeToHome } from './useFilmEscapeToHome';
import { ScreenObjectInspector } from './ScreenObjectInspector';
import { HatcheryAiOverlay } from './admin/HatcheryAiOverlay';
import { playFilmTransitionSound } from './filmTransitionSound';
import { applyPerformanceMode } from './filmPerformanceMode';
import { FilmQuickMenu } from './FilmQuickMenu';
import { ENVIRONMENT_TIMING } from './zoneEnvironment';
import { SmtLineExplorer } from './SmtLineExplorer';

export function SignalFilm() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const camera = useFilmCamera();
  const cameraView = useRef(true);
  const [preview, setPreview] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [objectInspectorOpen, setObjectInspectorOpen] = useState(false);
  const [objectInspectorError, setObjectInspectorError] = useState<string>();
  const [objectInspectorSelectedId, setObjectInspectorSelectedId] = useState('metric.production');
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [managementPage, setManagementPage] = useState<'ai' | 'admin'>('ai');
  const [managementSection, setManagementSection] = useState<'voice'>();
  const objectInspectorOpenRef = useRef(false);
  const aiSettingsOpenRef = useRef(false);
  const objectInspectorReturnRef = useRef<'focus' | 'openDetail' | null>(null);
  const screenObjects = useMemo(createScreenObjectRegistry, []);
  // Publishes data-film-perf on <html>; the corner instruments drop continuous decoration in low mode.
  useEffect(() => { applyPerformanceMode(window.localStorage); }, []);
  const stopAllRef = useRef<() => void>(() => {});
  const player = useFilmPlayback(canvas, camera.frameRef, cameraView);
  useEffect(() => screenObjects.notify(), [screenObjects, player.sceneData, player.feedStatus]);
  const description = player.position.chapter.id === 'machine' ? MACHINE_PRESENTATIONS[player.machineSubject] : player.position.chapter;
  const cameraMode = {
    ...camera, preview,
    openPreview() {
      if (player.factory.manual || player.cctv.manual) player.resumeTour(); player.environment.clear(); cameraView.current = true; setPreview(true); setMenuOpen(true);
      if (objectInspectorReturnRef.current === 'openDetail') requestAnimationFrame(() => {
        objectInspectorReturnRef.current = null; objectInspectorOpenRef.current = true; setObjectInspectorOpen(true);
      });
    },
    closePreview() { camera.stop(); cameraView.current = false; setPreview(false); setMenuOpen(false); },
    enable() { player.environment.clear(); cameraView.current = true; setPreview(true); setMenuOpen(true); },
  };
  const screenCommands = useScreenCommands({ registry: screenObjects, player, camera, menuOpen, settingsOpen, preview,
    menu: setMenuOpen, settings: setSettingsOpen, home(value) { cameraView.current = value; setPreview(value); },
    stopAll() { stopAllRef.current(); } });
  const turbine = useFilmTurbine(player,
    () => { cameraMode.openPreview(); setMenuOpen(false); },
    () => cameraMode.closePreview(),
    () => setSettingsOpen(true), screenCommands);
  stopAllRef.current = () => {
    turbine.voice.stop(); camera.stop();
    player.factory.clear(); player.cctv.clear(); player.environment.clear(); player.pause();
    objectInspectorOpenRef.current = false; setObjectInspectorOpen(false); setObjectInspectorError(undefined);
    aiSettingsOpenRef.current = false; setAiSettingsOpen(false);
    setSettingsOpen(false); setMenuOpen(false); cameraView.current = true; setPreview(true);
    void Promise.all([
      screenObjects.execute('menu.turbine','setOpen',{open:false}),
      screenObjects.execute('menu.cube','setOpen',{open:false}),
      screenObjects.execute('camera.popup','setOpen',{open:false}),
      screenObjects.execute('card.focus','close'),
    ]);
  };
  useFilmEscapeToHome(() => {
    if (aiSettingsOpenRef.current) {
      aiSettingsOpenRef.current = false; setAiSettingsOpen(false); void turbine.voice.refreshSettings(); return;
    }
    if (objectInspectorOpenRef.current) {
      objectInspectorOpenRef.current = false; setObjectInspectorOpen(false); setObjectInspectorError(undefined); return;
    }
    if (objectInspectorReturnRef.current === 'focus') {
      void screenObjects.execute('card.focus','close');
      return;
    }
    if (objectInspectorReturnRef.current === 'openDetail') {
      objectInspectorReturnRef.current = null;
      void screenObjects.execute('screen','stopAndHome').then(() => requestAnimationFrame(() => {
        objectInspectorOpenRef.current = true; setObjectInspectorOpen(true);
      }));
      return;
    }
    void screenObjects.execute('screen','stopAndHome');
  });
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

  return <ScreenObjectProvider registry={screenObjects}>
    <main ref={mainRef} className={styles.page} style={themeStyle} data-film-theme={player.theme} data-preview={preview} data-menu-open={menuOpen} data-menu-layout={player.menuLayout}>
      <div className={styles.screen}>
        <canvas ref={canvas} className={styles.canvas} role="img" aria-label={preview
          ? 'HATCHERY 메인 화면의 연속 공간 배경'
          : `${description.title}: ${description.subtitle} 시뮬레이션 연출.`} />
        {!preview && player.ready && player.position.chapter.id === 'visor'
          && <SmtFactoryExplorer canvas={canvas} controller={player.factory} onAuto={player.resumeTour} />}
        {!preview && player.ready && player.position.chapter.id === 'wave' && player.position.localTime < ENVIRONMENT_TIMING.heatmapStart
          && <EnvironmentZoneInteraction canvas={canvas} controller={player.environment} />}
        {!preview && player.ready && player.position.chapter.id === 'wave' && player.position.localTime >= ENVIRONMENT_TIMING.heatmapStart
          && <SmtLineExplorer onManual={player.pause} environment={player.sceneData.environment}
            elapsed={player.position.localTime} playing={player.playing} />}
        {!preview && player.ready && player.position.chapter.id === 'cctv'
          && <CctvExplorer canvas={canvas} controller={player.cctv} onAuto={player.resumeTour} />}
        {!preview && player.ready && player.position.chapter.id === 'space3d' && <FactoryExplorer3D onManual={player.pause} />}
        {!preview && !['visor', 'wave', 'cctv', 'space3d'].includes(player.position.chapter.id) && <button type="button" className={styles.screenToggle} disabled={!player.ready}
          aria-label={player.playing ? '연출 화면 일시정지' : '연출 화면 재생'}
          title={player.playing ? '화면을 클릭하면 일시정지' : '화면을 클릭하면 이어서 재생'}
          onClick={player.togglePlay} />}
      </div>
      {!preview && <FilmQuickMenu player={player} />}
      {preview && <JarvisMain data={player.sceneData} feedStatus={player.feedStatus} provenance={player.sceneProvenance} externalBriefing theme={player.theme} camera={camera} voice={turbine.voice} onChapter={turbine.selectScene}
        onCardFocusClose={() => {
          if (objectInspectorReturnRef.current !== 'focus') return;
          objectInspectorReturnRef.current = null; objectInspectorOpenRef.current = true; setObjectInspectorOpen(true);
        }}
        themeSettings={<FilmThemeSettings player={player}/>} sceneSettings={<FilmSceneSettings player={player} camera={cameraMode}/>}
        actions={{ sceneData: () => player.sceneData, applySceneObjects: player.applySceneObjects }} />}
      <FilmBriefing key={preview ? 'main' : player.position.chapter.id}
        text={preview ? turbine.voice.messages.filter(message => message.role === 'assistant').at(-1)?.content ?? ''
          : turbine.voice.briefing?.scene === player.position.chapter.id ? turbine.voice.briefing.text
            : sceneBriefing(player.position.chapter.id, player.sceneData)}
        source={preview ? turbine.voice.source
          : turbine.voice.briefing?.scene === player.position.chapter.id ? turbine.voice.briefing.source
            : `${player.position.chapter.title} · ${player.feedStatus?.mode === 'server' ? '피드 데이터' : '시연 데이터'}`}/>
      <FilmDock player={player} camera={cameraMode} menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} />
      {preview && <FilmMenuCube onSelect={id => {
        if (id === 'voice') { playFilmTransitionSound(); setManagementPage('ai'); setManagementSection('voice'); aiSettingsOpenRef.current = true; setAiSettingsOpen(true); return; }
        if (id === 'system') { playFilmTransitionSound(); setSettingsOpen(true); return; }
        if (id === 'admin') { playFilmTransitionSound(); setManagementPage('admin'); setManagementSection(undefined); aiSettingsOpenRef.current = true; setAiSettingsOpen(true); return; }
        if (id === 'ai') { playFilmTransitionSound(); setManagementPage('ai'); setManagementSection(undefined); aiSettingsOpenRef.current = true; setAiSettingsOpen(true); return; }
        if (id === 'display') { playFilmTransitionSound(); objectInspectorOpenRef.current = true; setObjectInspectorError(undefined); setObjectInspectorOpen(true); }
      }}/>}
      <JarvisCameraPopup camera={camera} host />
      {settingsOpen && <FilmSettingsDialog player={player} camera={cameraMode} onClose={() => setSettingsOpen(false)} />}
      {!preview && <JarvisVoiceIndicator active={turbine.voice.active} mode={turbine.voice.voiceMode} audio={turbine.voice.audioRef} phase={turbine.voice.phase}
        theme={player.theme} onStop={turbine.voice.stop} />}
      <FilmTurbineMenu ready={player.ready} playing={player.playing} voiceActive={turbine.voice.active} onCommand={turbine.command}/>
      {preview && <ReactorMenuPrank/>}
    </main>
    {objectInspectorOpen && <ScreenObjectInspector registry={screenObjects} mainRef={mainRef} actionError={objectInspectorError}
      selectedId={objectInspectorSelectedId} onSelectionChange={setObjectInspectorSelectedId}
      onClose={reason => { if (reason === 'dismiss') objectInspectorReturnRef.current = null; objectInspectorOpenRef.current = false; setObjectInspectorOpen(false); setObjectInspectorError(undefined); }}
      onActionStart={methodId => { objectInspectorReturnRef.current = methodId === 'focus' ? 'focus' : 'openDetail'; }}
      onActionFailure={message => { objectInspectorReturnRef.current = null; objectInspectorOpenRef.current = true; setObjectInspectorError(message); setObjectInspectorOpen(true); }}/>}
    {aiSettingsOpen && <HatcheryAiOverlay mainRef={mainRef} initialPage={managementPage} initialSection={managementSection} onClose={() => {
      aiSettingsOpenRef.current = false; setAiSettingsOpen(false); void turbine.voice.refreshSettings();
    }}/>}
  </ScreenObjectProvider>;
}
