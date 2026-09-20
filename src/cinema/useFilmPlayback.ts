'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { drawSignalFilm } from './drawSignalFilm';
import { createFilmTextureRenderer, DEFAULT_FILM_TEXTURE, type FilmTextureSettings, type FilmTextureStyle } from './filmTexture';
import { advanceFilm, chapterAt, chapterStart, FILM_CHAPTERS, type FilmId, type PlaybackMode } from './filmProgram';
import { DEFAULT_FILM_CHARTS, normalizeChartPresentation, type ChartKind, type ChartPresentation, type FilmChartSettings } from './chartPresentation';
import { DEFAULT_FILM_THEME, getFilmTheme, type FilmThemeId } from './filmThemes';
import { createFilmThemeContext } from './filmThemeCanvas';
import { drawJarvisBackdrop } from './drawJarvisBackdrop';
import { filmFrameChanged, filmRenderTime, type FilmFrameKey } from './filmFrameGate';
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
import { type MenuLayout } from './filmMenuRing';
import { menuLayoutPreference } from './filmMenuPreference';
import { readPlaybackPreference, savePlaybackPreference } from './filmPlaybackPreference';
import { createFilmRenderBudget } from './filmRenderBudget';
import { isLowPerformance, performancePreference, prefersLowDetail, reportRenderPressure } from './filmPerformanceMode';
import { createFilmShadowGate } from './filmShadowGate';
import { playFilmTransitionSound } from './filmTransitionSound';

/** How long the canvas yields to an input so its handler, the React commit and the paint go first. */
const INPUT_YIELD_MS = 90;

export function useFilmPlayback(canvasRef: RefObject<HTMLCanvasElement | null>,
  cameraRef: RefObject<FilmCameraFrame>, cameraView: RefObject<boolean>) {
  const clock = useRef({ time: 0, paused: false, speed: 1, mode: 'chapter' as PlaybackMode, texture: DEFAULT_FILM_TEXTURE, charts: DEFAULT_FILM_CHARTS, theme: DEFAULT_FILM_THEME, machineSubject: DEFAULT_MACHINE_SUBJECT as MachineSubject });
  const preferencesLoaded = useRef(false);
  const [machineSubject, setMachineSubject] = useState<MachineSubject>(DEFAULT_MACHINE_SUBJECT);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<PlaybackMode>('chapter');
  const [texture, setTexture] = useState<FilmTextureSettings>(DEFAULT_FILM_TEXTURE);
  const [charts, setCharts] = useState<FilmChartSettings>(DEFAULT_FILM_CHARTS);
  const [theme, setTheme] = useState<FilmThemeId>(DEFAULT_FILM_THEME);
  const menuLayout = useSyncExternalStore(menuLayoutPreference.subscribe, menuLayoutPreference.getSnapshot, menuLayoutPreference.getServerSnapshot);
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
    const ctx = node?.getContext('2d', { alpha: false });
    if (!node || !ctx) return;
    const textureRenderers = new Map<FilmThemeId, ReturnType<typeof createFilmTextureRenderer>>();
    // Explicit low mode or a slow device by its hints never rasters above 1x; the choice may change while mounted.
    const renderBudget = createFilmRenderBudget(undefined, { lowDetail: () => prefersLowDetail() });
    let resizeForBudget = false;
    const unsubscribePreference = performancePreference.subscribe(() => { resizeForBudget = true; });
    // Low mode paints every canvas shadow without blur; renderers keep their own shadowBlur values.
    const shadowGate = createFilmShadowGate(ctx);
    let frame = 0;
    let previous = performance.now();
    let painted = previous;
    // A heavy draw blocks the main thread, so a click landing mid-frame waits for it and then for the
    // React commit behind the next one. Yielding the frames right after an input keeps buttons quick.
    let inputAt = -Infinity;
    const noteInput = (event: Event) => { if (!(event as KeyboardEvent).repeat) inputAt = performance.now(); };
    window.addEventListener('pointerdown', noteInput, { capture: true, passive: true });
    window.addEventListener('keydown', noteInput, { capture: true, passive: true });
    let lastPublished = -Infinity;
    let cameraTime = 3;
    let lastKey: FilmFrameKey | null = null;
    const current = clock.current;
    if (!preferencesLoaded.current) {
      try { Object.assign(current, readPlaybackPreference(window.localStorage)); } catch { /* Storage may be blocked. */ }
      preferencesLoaded.current = true;
    }
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
      const dpr = renderBudget.ratio(rect.width, rect.height, window.devicePixelRatio || 1);
      node.width = Math.max(1, Math.round(rect.width * dpr));
      node.height = Math.max(1, Math.round(rect.height * dpr));
      syncDockInset();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node); resize();
    const dockObserver = new MutationObserver(syncDockInset);
    const page = node.closest('[data-film-theme]');
    if (page) dockObserver.observe(page, { attributes: true, attributeFilter: ['data-menu-open', 'data-preview', 'data-menu-layout'] });
    const sync = requestAnimationFrame(() => {
      setReady(true); setPlaying(!current.paused); setPosition(chapterAt(current.time));
      setSpeed(current.speed); setMode(current.mode); setTheme(current.theme);
      setTexture(current.texture); setCharts(current.charts); setMachineSubject(current.machineSubject);
    });
    const render = (now: number) => {
      if (resizeForBudget) { resize(); lastKey = null; resizeForBudget = false; }
      if (!current.paused) {
        const elapsed = Math.min((now - previous) / 1000, .05) * current.speed;
        if (cameraView.current) cameraTime += elapsed;
        else current.time = advanceFilm(current.time, elapsed, current.mode);
      }
      previous = now;
      const active = chapterAt(current.time);
      // Publish even when the final frame is unchanged: the render gate must not
      // leave React at 89.9s while the canvas clock has already settled at 90s.
      if (now - lastPublished > 180 && !cameraView.current) {
        lastPublished = now;
        setPosition(previous => previous.index === active.index && Math.round(previous.localTime * 10) === Math.round(active.localTime * 10)
          ? previous : active);
      }
      const data = store.get();
      const environmentFrame = updateEnvironment(!cameraView.current && active.chapter.id === 'wave' ? active.localTime : null, data.environment);
      const factoryState = readFactoryState(), cctvState = readCctvState();
      // Identical inputs paint an identical frame: a paused scene or backdrop costs nothing until something moves.
      const key: FilmFrameKey = { camera: cameraView.current, time: cameraView.current ? cameraTime : filmRenderTime(current.time, active.chapter.id),
        width: node.width, height: node.height, inset: viewport.bottomInset, theme: current.theme, texture: current.texture,
        charts: current.charts, subject: current.machineSubject, factory: factoryState, cctvManual: !!cctvState,
        selectedZone: environmentFrame?.manualSelectedId ?? null, data, provenance: store.provenance('pcb'),
        stagePose: null /* TODO: Task 5에서 실제 무대 카메라 포즈 서명으로 교체 */ };

      if (!filmFrameChanged(lastKey, key)) { frame = requestAnimationFrame(render); return; }
      // Nothing of the canvas is reachable under a modal overlay (it makes the page inert), the film
      // clock keeps its own time, and a bounded cadence leaves the thread idle between heavy frames.
      const interval = renderBudget.frameInterval;
      if (now - inputAt < INPUT_YIELD_MS || (page instanceof HTMLElement && page.inert)
        || (interval > 0 && now - painted < interval - 1)) { frame = requestAnimationFrame(render); return; }
      const sinceLastPaint = now - painted;
      painted = now;
      lastKey = key;
      const drawStarted = performance.now();
      const low = isLowPerformance();
      shadowGate.closed = low;
      themed.setTheme(current.theme);
      if (cameraView.current) {
        const view = beginFilmViewport(themed.ctx, node.width, node.height, viewport);
        drawJarvisBackdrop(themed.ctx, view, cameraTime);
      }
      else {
        cameraTime = 3;
        // Manual CCTV browsing pauses the film clock but the feeds keep running on wall-clock time.
        drawSignalFilm(themed.ctx, node.width, node.height, current.time, fonts, viewport, current.charts, factoryState, environmentFrame, data,
          { subject: current.machineSubject, provenance: store.provenance('pcb') }, cctvState ? { ...cctvState, live: now / 1000 } : null);
      }
      let drawTexture = textureRenderers.get(current.theme);
      if (!drawTexture) {
        drawTexture = createFilmTextureRenderer(current.theme);
        textureRenderers.set(current.theme, drawTexture);
      }
      drawTexture(ctx, node.width, node.height, cameraView.current ? cameraTime : current.time, current.texture, { bloom: !cameraView.current, now, cheap: low });
      if (renderBudget.sample(now, performance.now() - drawStarted, sinceLastPaint)) resizeForBudget = true;
      // A capped cadence, or frames arriving late while the canvas is cheap, is this machine telling
      // us it is over budget: the page decoration steps down too, since the canvas is not the only
      // thing competing for frames. The report is sticky, so the two decoration sets do not alternate.
      reportRenderPressure(renderBudget.pressured);
      // Publish the position to React only when the readout would change; the preview freezes film
      // time, and the dock's time display has 0.1s resolution, so identical frames must not re-render.
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(sync); observer.disconnect(); dockObserver.disconnect(); unsubscribePreference();
      window.removeEventListener('pointerdown', noteInput, { capture: true });
      window.removeEventListener('keydown', noteInput, { capture: true });
    };
  }, [canvasRef, cameraRef, cameraView, readFactoryState, readCctvState, updateEnvironment, store]);

  return {
    ready, playing, speed, mode, position, texture, charts, theme, factory, cctv, environment, sceneData, feedStatus, machineSubject, menuLayout,
    /** How the folded globe unfolds: bottom dock ring or a ring around the globe. */
    changeMenuLayout(value: MenuLayout) { menuLayoutPreference.set(value); },
    changeMachineSubject(value: MachineSubject) {
      if (!isMachineSubject(value) || value === clock.current.machineSubject) return;
      clock.current.machineSubject = value; setMachineSubject(value);
      savePlaybackPreference(clock.current);
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
      savePlaybackPreference(clock.current);
    },
    changeChartPresentation(kind: ChartKind, change: Partial<ChartPresentation>) {
      clock.current.charts = {
        ...clock.current.charts,
        [kind]: normalizeChartPresentation({ ...clock.current.charts[kind], ...change }),
      };
      setCharts(clock.current.charts);
      savePlaybackPreference(clock.current);
    },
    changeTextureStyle(style: FilmTextureStyle) {
      clock.current.texture = { ...clock.current.texture, style };
      setTexture(clock.current.texture);
      savePlaybackPreference(clock.current);
    },
    changeTextureIntensity(value: number) {
      if (!Number.isFinite(value)) return;
      clock.current.texture = { ...clock.current.texture, intensity: Math.max(0, Math.min(1, value)) };
      setTexture(clock.current.texture);
      savePlaybackPreference(clock.current);
    },
    changeSpeed(value: number) { clock.current.speed = value; setSpeed(value); savePlaybackPreference(clock.current); },
    changeMode(value: PlaybackMode) { clock.current.mode = value; setMode(value); savePlaybackPreference(clock.current); },
    pause() { factory.clear(); cctv.clear(); clock.current.paused = true; setPlaying(false); },
    play() { factory.clear(); cctv.clear(); clock.current.paused = false; setPlaying(true); },
    togglePlay() { factory.clear(); cctv.clear(); clock.current.paused = !clock.current.paused; setPlaying(!clock.current.paused); },
    selectChapter(id: FilmId, forceTransitionSound = false) {
      if (forceTransitionSound || chapterAt(clock.current.time).chapter.id !== id) playFilmTransitionSound();
      factory.clear(); cctv.clear();
      environment.clear();
      clock.current.time = chapterStart(id); clock.current.paused = false; clock.current.mode = 'chapter';
      setPosition(chapterAt(clock.current.time)); setPlaying(true); setMode('chapter'); savePlaybackPreference(clock.current);
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
