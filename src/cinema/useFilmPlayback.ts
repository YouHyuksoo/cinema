'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { drawSignalFilm } from './drawSignalFilm';
import { createFilmTextureRenderer, DEFAULT_FILM_TEXTURE, type FilmTextureSettings, type FilmTextureStyle } from './filmTexture';
import { advanceFilm, chapterAt, chapterStart, FILM_CHAPTERS, type FilmId, type PlaybackMode } from './filmProgram';
import { DEFAULT_FILM_CHARTS, normalizeChartPresentation, type ChartKind, type ChartPresentation, type FilmChartSettings } from './chartPresentation';
import { DEFAULT_FILM_THEME, getFilmTheme, type FilmThemeId } from './filmThemes';
import { createFilmThemeContext } from './filmThemeCanvas';
import { drawJarvisBackdrop } from './drawJarvisBackdrop';
import { beginFilmViewport } from './filmViewport';
import type { FilmCameraFrame } from './filmCameraSession';
import { useSmtFactoryInteraction } from './useSmtFactoryInteraction';
import { useCctvInteraction } from './useCctvInteraction';
import { useEnvironmentSelection } from './useEnvironmentSelection';
import { DEFAULT_FILM_SCENE_DATA, type FilmSceneData, type FilmSceneDataKey } from './filmSceneData';
import { createSceneDataStore } from './sceneDataStore';
import { browserStaticSceneDataOptions, loadStaticSceneData } from './staticSceneData';
import { browserFeedPollingOptions, startFeedPolling, type FeedPollSummary } from './feedPolling';
import { DEFAULT_MACHINE_SUBJECT, isMachineSubject, type MachineSubject } from './machinePresentation';
import { isMenuLayout, type MenuLayout } from './filmMenuRing';

export function useFilmPlayback(canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraRef: RefObject<FilmCameraFrame>, cameraView: RefObject<boolean>) {
  const clock = useRef({ time: 0, paused: false, speed: 1, mode: 'sequence' as PlaybackMode, texture: DEFAULT_FILM_TEXTURE, charts: DEFAULT_FILM_CHARTS, theme: DEFAULT_FILM_THEME, machineSubject: DEFAULT_MACHINE_SUBJECT as MachineSubject });
  const [machineSubject, setMachineSubject] = useState<MachineSubject>(DEFAULT_MACHINE_SUBJECT);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<PlaybackMode>('sequence');
  const [texture, setTexture] = useState<FilmTextureSettings>(DEFAULT_FILM_TEXTURE);
  const [charts, setCharts] = useState<FilmChartSettings>(DEFAULT_FILM_CHARTS);
  const [theme, setTheme] = useState<FilmThemeId>(DEFAULT_FILM_THEME);
  const [menuLayout, setMenuLayout] = useState<MenuLayout>('dock');
  const [store] = useState(() => createSceneDataStore());
  const [sceneData, setSceneData] = useState<FilmSceneData>(DEFAULT_FILM_SCENE_DATA);
  useEffect(() => store.subscribe(setSceneData), [store]);
  // Static JSON adapter: public/cinema/data/scenes.json overrides the demo defaults when present.
  const [feedStatus, setFeedStatus] = useState<FeedPollSummary | null>(null);
  useEffect(() => {
    // Static JSON first, then the server feed adapter takes over when a feed route exists.
    let stop: (() => void) | undefined;
    let cancelled = false;
    void loadStaticSceneData(store, browserStaticSceneDataOptions()).then(() => {
      if (!cancelled) stop = startFeedPolling(store, { ...browserFeedPollingOptions(), onStatus: setFeedStatus });
    });
    return () => { cancelled = true; stop?.(); };
  }, [store]);
  const [position, setPosition] = useState(() => chapterAt(0));
  const factory = useSmtFactoryInteraction(() => chapterAt(clock.current.time).localTime,
    () => { clock.current.paused = true; setPlaying(false); });
  const readFactoryState = factory.readState;
  const cctv = useCctvInteraction(() => chapterAt(clock.current.time).localTime,
    () => { clock.current.paused = true; setPlaying(false); });
  const readCctvState = cctv.readState;
  const environment = useEnvironmentSelection();
  const updateEnvironment = environment.update;

  useEffect(() => {
    const node = canvasRef.current;
    const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    const textureRenderers = new Map<FilmThemeId, ReturnType<typeof createFilmTextureRenderer>>();
    let frame = 0;
    let previous = performance.now();
    let lastPublished = -Infinity;
    let cameraTime = 3;
    const current = clock.current;
    const themed = createFilmThemeContext(ctx, current.theme);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.paused = true; current.time = FILM_CHAPTERS[0].previewAt;
    }
    const style = getComputedStyle(node);
    const fonts = {
      label: `${style.getPropertyValue('--font-label')}, ${style.getPropertyValue('--font-korean')}, sans-serif`,
      mono: `${style.getPropertyValue('--font-mono')}, monospace`,
    };
    const viewport = { bottomInset: 0 };
    const syncDockInset = () => {
      const rect = node.getBoundingClientRect();
      const dockSpace = Number.parseFloat(getComputedStyle(node).getPropertyValue('--film-content-inset')) || 0;
      viewport.bottomInset = Math.max(0, dockSpace) * node.height / Math.max(1, rect.height);
    };
    const resize = () => {
      const rect = node.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      node.width = Math.max(1, Math.round(rect.width * dpr));
      node.height = Math.max(1, Math.round(rect.height * dpr));
      syncDockInset();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node); resize();
    const dockObserver = new MutationObserver(syncDockInset);
    const page = node.closest('[data-film-theme]');
    if (page) dockObserver.observe(page, { attributes: true, attributeFilter: ['data-menu-open', 'data-preview', 'data-menu-layout'] });
    const sync = requestAnimationFrame(() => { setReady(true); setPlaying(!current.paused); setPosition(chapterAt(current.time)); });
    const render = (now: number) => {
      if (!current.paused) {
        const elapsed = Math.min((now - previous) / 1000, .05) * current.speed;
        if (cameraView.current) cameraTime += elapsed;
        else current.time = advanceFilm(current.time, elapsed, current.mode);
      }
      previous = now;
      themed.setTheme(current.theme);
      const active = chapterAt(current.time);
      const environmentFrame = updateEnvironment(!cameraView.current && active.chapter.id === 'wave' ? active.localTime : null, store.get().environment);
      if (cameraView.current) {
        const view = beginFilmViewport(themed.ctx, node.width, node.height, viewport);
        drawJarvisBackdrop(themed.ctx, view, cameraTime);
      }
      else {
        cameraTime = 3;
        // Manual CCTV browsing pauses the film clock but the feeds keep running on wall-clock time.
        const cctvState = readCctvState();
        drawSignalFilm(themed.ctx, node.width, node.height, current.time, fonts, viewport, current.charts, readFactoryState(), environmentFrame, store.get(),
          { subject: current.machineSubject, provenance: store.provenance('pcb') }, cctvState ? { ...cctvState, live: now / 1000 } : null);
      }
      let drawTexture = textureRenderers.get(current.theme);
      if (!drawTexture) {
        drawTexture = createFilmTextureRenderer(current.theme);
        textureRenderers.set(current.theme, drawTexture);
      }
      drawTexture(ctx, node.width, node.height, cameraView.current ? cameraTime : current.time, current.texture);
      // Publish the position to React only when the readout would change; the preview freezes film
      // time, and the dock's time display has 0.1s resolution, so identical frames must not re-render.
      if (now - lastPublished > 180 && !cameraView.current) {
        lastPublished = now;
        setPosition(previous => {
          const next = chapterAt(current.time);
          const same = previous.index === next.index && Math.round(previous.localTime * 10) === Math.round(next.localTime * 10);
          return same ? previous : next;
        });
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(sync); observer.disconnect(); dockObserver.disconnect(); };
  }, [canvasRef, cameraRef, cameraView, readFactoryState, readCctvState, updateEnvironment, store]);

  return {
    ready, playing, speed, mode, position, texture, charts, theme, factory, cctv, environment, sceneData, feedStatus, machineSubject, menuLayout,
    /** How the folded globe unfolds: bottom dock ring or a ring around the globe. */
    changeMenuLayout(value: MenuLayout) { if (isMenuLayout(value)) setMenuLayout(value); },
    changeMachineSubject(value: MachineSubject) {
      if (!isMachineSubject(value) || value === clock.current.machineSubject) return;
      clock.current.machineSubject = value; setMachineSubject(value);
      if (chapterAt(clock.current.time).chapter.id === 'machine') {
        clock.current.time = chapterStart('machine'); setPosition(chapterAt(clock.current.time));
      }
    },
    resumeTour() { factory.clear(); cctv.clear(); clock.current.paused = false; setPlaying(true); },
    /** Scene data contract entry points: full replacement documents and object patches (see docs/standards/scene-data-contract.md). */
    applySceneDocument: (input: unknown) => store.replace(input),
    applySceneObjects: (input: unknown) => store.patch(input),
    sceneProvenance: (key: FilmSceneDataKey) => store.provenance(key),
    updateSceneData(change: Partial<FilmSceneData>) { store.merge(change); },
    changeTheme(value: FilmThemeId) {
      clock.current.theme = getFilmTheme(value).id;
      setTheme(clock.current.theme);
    },
    changeChartPresentation(kind: ChartKind, change: Partial<ChartPresentation>) {
      clock.current.charts = {
        ...clock.current.charts,
        [kind]: normalizeChartPresentation({ ...clock.current.charts[kind], ...change }),
      };
      setCharts(clock.current.charts);
    },
    changeTextureStyle(style: FilmTextureStyle) {
      clock.current.texture = { ...clock.current.texture, style };
      setTexture(clock.current.texture);
    },
    changeTextureIntensity(value: number) {
      if (!Number.isFinite(value)) return;
      clock.current.texture = { ...clock.current.texture, intensity: Math.max(0, Math.min(1, value)) };
      setTexture(clock.current.texture);
    },
    changeSpeed(value: number) { clock.current.speed = value; setSpeed(value); },
    changeMode(value: PlaybackMode) { clock.current.mode = value; setMode(value); },
    pause() { factory.clear(); cctv.clear(); clock.current.paused = true; setPlaying(false); },
    play() { factory.clear(); cctv.clear(); clock.current.paused = false; setPlaying(true); },
    togglePlay() { factory.clear(); cctv.clear(); clock.current.paused = !clock.current.paused; setPlaying(!clock.current.paused); },
    selectChapter(id: FilmId) {
      factory.clear(); cctv.clear();
      environment.clear();
      clock.current.time = chapterStart(id); clock.current.paused = false;
      setPosition(chapterAt(clock.current.time)); setPlaying(true);
    },
    seek(value: number) {
      factory.clear(); cctv.clear();
      const active = chapterAt(clock.current.time);
      clock.current.time = active.start + Math.max(0, Math.min(active.chapter.duration - .001, value));
      environment.update(active.chapter.id === 'wave' ? chapterAt(clock.current.time).localTime : null);
      setPosition(chapterAt(clock.current.time));
    },
    restart() {
      factory.clear(); cctv.clear();
      environment.clear();
      clock.current.time = clock.current.mode === 'chapter' ? chapterAt(clock.current.time).start : 0;
      clock.current.paused = false; setPlaying(true); setPosition(chapterAt(clock.current.time));
    },
  };
}

export type FilmPlayback = ReturnType<typeof useFilmPlayback>;
