import { signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { applyFocusProjection } from '../filmFocus';
import { barTelemetryLayout, type BarChartOptions, type BarAnchor } from '../barTelemetryGeometry';
import { drawTelemetryBar } from './drawTelemetryBar';

export type { BarDatum, BarChartOptions, BarAnchor } from '../barTelemetryGeometry';

/** HUD channels share segmented plates, local scales, a scan and projected focus. */
export function drawBarChart(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: BarChartOptions): BarAnchor[] {
  const layout = barTelemetryLayout(options);
  const opacity = Number.isFinite(options.opacity ?? 1) ? Math.max(0, Math.min(1, options.opacity ?? 1)) : 0;
  if (!layout || !opacity) return [];
  const { x, y, width, time, unit = '' } = options;
  const { baseline, columns, selected, focus, slot, target } = layout;
  ctx.save(); ctx.globalAlpha *= opacity * smooth(0, .45, time);
  ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  ctx.setLineDash([]); ctx.textBaseline = 'alphabetic';
  const text = (value: string, px: number, py: number, size: number, heat = 0, alpha = .8,
    align: CanvasTextAlign = 'left', maxWidth?: number) => {
    ctx.font = `${size}px ${fonts.mono}`; ctx.textAlign = align; ctx.fillStyle = signalColor(heat, alpha);
    ctx.fillText(value, px, py, maxWidth);
  };
  ctx.beginPath(); ctx.moveTo(x - 12, baseline + 9); ctx.lineTo(x + width, baseline + 9);
  ctx.strokeStyle = signalColor(0, .19); ctx.lineWidth = .7; ctx.stroke();
  text('0', x - 20, baseline + 4, 9, 0, .55, 'right');
  if (target !== undefined) text(`REF / ${target.toLocaleString('en-US')} ${unit}`, x + width, y - 71, 10, 0, .68, 'right');

  const { channelScale: scale, compact } = layout;
  for (const column of columns) {
    const { index, heat, center, datum, value, growth, top, start } = column;
    const channelLeft = x + slot * index + 2, channelRight = x + slot * (index + 1) - 8;
    const dim = selected === undefined || selected === index ? 1 : 1 - focus * .52;
    ctx.save(); ctx.globalAlpha *= dim * smooth(start - .6, start, time);
    // Small open headers identify each acquisition channel without enclosing the graph.
    ctx.beginPath(); ctx.moveTo(channelLeft, y - 31); ctx.lineTo(channelLeft, y - 58);
    ctx.lineTo(channelRight - 5, y - 58); ctx.lineTo(channelRight, y - 53); ctx.lineTo(channelRight, y - 31);
    ctx.strokeStyle = signalColor(heat, .28); ctx.lineWidth = .7; ctx.stroke();
    if (compact) {
      // Narrow channels keep only the channel number; the readouts below carry the value.
      text(`T${index + 1}`, center, y - 39, 18 * scale, heat, .96, 'center', slot - 8);
    }
    else {
      ctx.fillStyle = signalColor(heat, .08); ctx.fillRect(channelRight - 29, y - 55, 26, 21);
      text(`T${index + 1}`, channelRight - 16, y - 39, 18 * scale, heat, .96, 'center');
      text(`CH / ${String(index + 1).padStart(2, '0')}`, channelLeft + 6, y - 43, 9 * scale, heat, .7);
      text('OUTPUT', channelLeft + 6, y - 31, 7 * scale, heat, .4);
      for (let mark = 0; mark < 7; mark++) {
        ctx.fillStyle = signalColor(heat, mark < Math.round(value / layout.maximum * 7) ? .4 : .08);
        ctx.fillRect(channelLeft + 6 + mark * 7, y - 24, 4, 1.5);
      }
      text(`${Math.round(value / layout.maximum * growth * 100)}% FS`, channelRight, y - 18, 7 * scale, heat, .5, 'right');
    }
    ctx.save(); ctx.globalAlpha *= index === selected ? 1 - focus * .8 : 1;
    drawTelemetryBar(ctx, fonts, layout, column, time);
    ctx.globalAlpha *= index === selected ? 1 - focus : 1;
    text(Math.round(value * growth).toLocaleString('en-US'), center, top - layout.depth - 10, 18 * scale, heat, .95, 'center', slot - 10);
    ctx.restore();
    const characters = Math.max(0, Math.floor((time - start + .25) * 24));
    text(Array.from(datum.label).slice(0, characters).join(''), center, baseline + 33, 15 * scale, heat, .9, 'center', slot - 12);
    if (!compact) {
      const attainment = target !== undefined && target > 0 ? `${(value / target * 100).toFixed(1)}% / REF` : unit;
      text(attainment, center, baseline + 53, 9 * scale, heat, .56, 'center', slot - 12);
    }
    ctx.restore();
  }
  if (selected !== undefined && focus > .001) {
    const column = columns[selected];
    ctx.save(); ctx.globalAlpha *= focus;
    ctx.beginPath(); ctx.setLineDash([2, 5]); ctx.moveTo(column.center, baseline);
    ctx.lineTo(column.anchor.x, column.anchor.baseline); ctx.strokeStyle = signalColor(column.heat, .5); ctx.stroke(); ctx.setLineDash([]);
    applyFocusProjection(ctx, column.lens);
    drawTelemetryBar(ctx, fonts, layout, column, time, true);
    text(Math.round(column.value * column.growth).toLocaleString('en-US'), column.center,
      column.top - layout.depth - 10, 19, column.heat, 1, 'center', slot - 10);
    ctx.restore();
  }
  ctx.restore();
  return columns.map(column => column.anchor);
}
