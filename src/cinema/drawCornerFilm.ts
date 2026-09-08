import { drawCornerField } from './components/drawCornerField';
import { cornerReadoutEdge, drawCornerReadout } from './components/drawCornerReadout';
import { drawHolographicCore } from './components/drawHolographicCore';
import { drawProjectedFilmSurface } from './components/drawProjectedFilmSurface';
import { CORNER_CARD_SIZE, CORNER_FINALE_START, CORNER_PRODUCTION, cornerSequenceState } from './cornerSequence';
import { cornerCoreAnchor } from './cornerCoreGeometry';
import { cornerReadingProjection } from './cornerProjection';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';

/** Read one item in the foreground, retain it in a corner, then reveal the central conclusion. */
export function drawCornerFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  const state = cornerSequenceState(time);
  drawCornerField(ctx, view, time, state.finale.reveal);

  for (const reading of state.items) {
    if (reading.opacity <= .001) continue;
    const { item, parkProgress } = reading;
    // A short fading path comes from this exact motion, including its retreat in depth.
    if (parkProgress > .001 && parkProgress < .999) {
      ctx.save(); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      const trail = Array.from({ length: 17 }, (_, sample) =>
        cornerSequenceState(Math.max(0, time - (1 - sample / 16) * .7)).items[reading.index]);
      for (let sample = 1; sample < trail.length; sample++) {
        const from = trail[sample - 1], to = trail[sample];
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = signalColor(item.heat, sample / 16 * .25 * reading.opacity); ctx.stroke();
      }
      ctx.restore();
    }

    if (state.finale.opacity > .001 && parkProgress === 1) {
      const right = item.corner.x > 640, lower = item.corner.y > 350;
      const source = cornerReadoutEdge('reading', right ? -1 : 1);
      const from = cornerReadingProjection(reading).point(source.x, source.y);
      const summary = state.finale;
      const destination = cornerCoreAnchor(Math.max(0, time - CORNER_FINALE_START), right ? 1 : -1, lower);
      const to = { x: summary.x + destination.x * summary.scale, y: summary.y + destination.y * summary.scale };
      const intensity = smooth(0, .6, summary.reveal) * summary.opacity;
      ctx.save(); ctx.globalAlpha = intensity;
      ctx.beginPath(); ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(from.x + (right ? -45 : 45), from.y,
        to.x + (right ? 55 : -55), to.y, to.x, to.y);
      ctx.strokeStyle = signalColor(item.heat, .32); ctx.lineWidth = 1.15; ctx.stroke();
      ctx.beginPath(); ctx.arc(from.x, from.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = signalColor(item.heat, .7); ctx.fill();
      ctx.beginPath(); ctx.arc(to.x, to.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // The same perspective controls the face, text, charts and annotation anchors.
  const ordered = state.items.map(reading => ({ reading, plane: cornerReadingProjection(reading) }))
    .sort((a, b) => b.plane.depth - a.plane.depth);
  for (const { reading, plane } of ordered) {
    if (reading.opacity <= .001) continue;
    drawProjectedFilmSurface(ctx, {
      ...CORNER_CARD_SIZE, project: plane.point,
      draw: surface => drawCornerReadout(surface, fonts, {
        item: reading.item, time: reading.localTime, reveal: reading.reveal,
        opacity: reading.opacity, parkProgress: reading.parkProgress,
      }),
    });
  }

  const summary = state.finale;
  if (summary.opacity > .001) {
    ctx.save(); ctx.translate(summary.x, summary.y); ctx.scale(summary.scale, summary.scale);
    drawHolographicCore(ctx, fonts, {
      time: Math.max(0, time - CORNER_FINALE_START), reveal: summary.reveal, opacity: summary.opacity,
      title: '생산 흐름 종합', label: '생산 목표까지', value: String(CORNER_PRODUCTION.remaining), unit: 'EA',
      eyebrow: 'PRODUCTION / CORE',
      status: '품질 안정 · 생산 보완',
      progress: CORNER_PRODUCTION.actual / CORNER_PRODUCTION.target,
      detail: `실적 ${CORNER_PRODUCTION.actual.toLocaleString('en-US')} / 목표 ${CORNER_PRODUCTION.target.toLocaleString('en-US')} EA`,
    });
    ctx.restore();
  }

  const presence = smooth(.1, 1.2, time) * state.release;
  filmText(ctx, fonts, 'CORNER / SEQUENTIAL COMPOSITION', 72, 76, 14, presence * .7, true);
  filmText(ctx, fonts, 'SIMULATION', 72, 689, 10, presence * .52, true);
}
