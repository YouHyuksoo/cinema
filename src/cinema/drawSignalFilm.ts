import { drawGearFilm } from './drawGearFilm';
import { drawWaveFilm } from './drawWaveFilm';
import { drawScanFilm } from './drawScanFilm';
import { drawUnfoldFilm } from './drawUnfoldFilm';
import { drawTraceFilm } from './drawTraceFilm';
import { drawConsoleFilm } from './drawConsoleFilm';
import { drawVisorFilm, drawPlanarVisorFilm } from './drawVisorFilm';
import { drawBarFilm } from './drawBarFilm';
import { drawPieFilm } from './drawPieFilm';
import { drawCornerFilm } from './drawCornerFilm';
import { drawTransparentMachineFilm } from './drawTransparentMachineFilm';
import { drawProcessNetworkFilm } from './drawProcessNetworkFilm';
import { drawEnergyCoreFilm } from './drawEnergyCoreFilm';
import { drawProductInspectionFilm } from './drawProductInspectionFilm';
import { drawSpcFilm } from './drawSpcFilm';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './drawGearTrain';
import { chapterAt, FILM_CHAPTERS, FILM_SECONDS, type FilmId } from './filmProgram';
import type { FilmViewportInsets } from './filmViewport';
import { DEFAULT_FILM_CHARTS, type FilmChartSettings } from './chartPresentation';
import type { FactoryInteraction } from './smtFactoryInteraction';

export { FILM_SECONDS } from './filmProgram';
type Renderer = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, fonts: FilmFonts, insets: FilmViewportInsets | undefined, charts: FilmChartSettings, factory: FactoryInteraction | null) => void;
const renderers: Record<FilmId, Renderer> = {
  wave: (ctx, width, height, time, fonts, insets) => drawWaveFilm(ctx, width, height, time, fonts, insets),
  gears: drawGearFilm, scan: drawScanFilm, unfold: drawUnfoldFilm, trace: drawTraceFilm,
  console: drawConsoleFilm, visor: (ctx, width, height, time, fonts, insets, _charts, factory) => drawVisorFilm(ctx, width, height, time, fonts, 'space', insets, factory),
  visorPan: drawPlanarVisorFilm,
  bars: (ctx, width, height, time, fonts, insets, charts) => drawBarFilm(ctx, width, height, time, fonts, charts.bars, insets),
  pie: (ctx, width, height, time, fonts, insets, charts) => drawPieFilm(ctx, width, height, time, fonts, charts.pie, insets),
  corners: drawCornerFilm,
  machine: (ctx, width, height, time, fonts, insets) => drawTransparentMachineFilm(ctx, width, height, time, fonts, insets),
  network: (ctx, width, height, time, fonts, insets) => drawProcessNetworkFilm(ctx, width, height, time, fonts, insets),
  energy: (ctx, width, height, time, fonts, insets) => drawEnergyCoreFilm(ctx, width, height, time, fonts, insets),
  product: (ctx, width, height, time, fonts, insets) => drawProductInspectionFilm(ctx, width, height, time, fonts, insets),
  spc: (ctx, width, height, time, fonts, insets) => drawSpcFilm(ctx, width, height, time, fonts, insets),
};

/** Paint a fresh frame independently of the preceding scene's fades and light effects. */
function resetFilmPaint(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.setLineDash([]);
  ctx.textBaseline = 'alphabetic';
  ctx.beginPath();
}

/** Each renderer receives local scene time; playback and progress stay continuous. */
export function drawSignalFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, charts: FilmChartSettings = DEFAULT_FILM_CHARTS, factory: FactoryInteraction | null = null) {
  ctx.save();
  try {
    resetFilmPaint(ctx);
    drawFilmChapter(ctx, width, height, t, fonts, insets, charts, factory);
  } finally {
    // Keep scene paint changes out of subsequent frames and the texture pass.
    ctx.restore();
  }
}

function drawFilmChapter(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, fonts: FilmFonts,
  insets: FilmViewportInsets | undefined, charts: FilmChartSettings, factory: FactoryInteraction | null) {
  const { chapter, index, start, localTime } = chapterAt(t);
  renderers[chapter.id](ctx, width, height, localTime, fonts, insets, charts, factory);

  // Chapter fades and navigation marks must not inherit an object's local opacity.
  resetFilmPaint(ctx);
  ctx.save();
  const visible = chapter.id === 'visor' && factory ? 1
    : smooth(0, .4, localTime) * (1 - smooth(chapter.duration - .4, chapter.duration, localTime));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(4,11,16,${1 - visible})`; ctx.fillRect(0, 0, width, height);
  ctx.restore();
  ctx.fillStyle = signalColor(0, .12); ctx.fillRect(72, 662, 1136, .7);
  ctx.fillStyle = signalColor(0, .55); ctx.fillRect(72, 662, 1136 * (start + localTime) / FILM_SECONDS, .7);
  let boundary = 0;
  for (const item of FILM_CHAPTERS.slice(0, -1)) {
    boundary += item.duration;
    ctx.fillRect(72 + 1136 * boundary / FILM_SECONDS, 659, 1, 7);
  }
  const chapterCode = chapter.id === 'wave' ? 'ENV' : chapter.id.toUpperCase();
  filmText(ctx, fonts, `${String(index + 1).padStart(2, '0')} / ${chapterCode}`, 1208, 76, 12, .65, true, 'right');
  ctx.restore();
}
