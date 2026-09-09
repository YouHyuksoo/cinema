import { ENERGY_PALETTE, RING_CENTER, RING_RADIUS, litSegments, type EnergyBoardState } from '../energyDashboard';
import { ENERGY_LAYERS, energyRatio, type EnergyCoreData } from '../energyCore';
import { mix } from '../filmMath';
import { withAlpha } from './drawHudPanel';
import { drawSevenSegment } from './drawHudPanel';
import type { FilmFonts } from '../filmDrawing';

const TAU = Math.PI * 2;
const GEAR_TEETH = 24;
const OUTER_SEGMENTS = 48;
const INNER_SEGMENTS = 60;

/** Mix two hex colours in RGB. */
export function mixHex(a: string, b: string, t: number) {
  const parse = (hex: string) => { const v = Number.parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const [ar, ag, ab] = parse(a), [br, bg, bb] = parse(b);
  return `rgb(${Math.round(mix(ar, br, t))},${Math.round(mix(ag, bg, t))},${Math.round(mix(ab, bb, t))})`;
}

function ringSegments(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, count: number, lit: number,
  width: number, length: number, color: string, dimColor: string, alpha: number, rotation: number, gapRatio = .55) {
  const span = TAU / count * gapRatio;
  for (let index = 0; index < count; index++) {
    const start = rotation + index / count * TAU;
    ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + span);
    ctx.lineWidth = width; ctx.globalAlpha = alpha * (index < lit ? 1 : .28);
    ctx.strokeStyle = index < lit ? color : dimColor; ctx.stroke();
  }
  void length;
}

/**
 * Central ring. Act one: a gear-toothed reactor ring with two segmented arcs whose lit share follows
 * the active channel. Act two: the same ring recoloured, its outer arc turning into an orange wedge
 * and its ticks into dotted orbits. `blend` drives the morph.
 */
export function drawEnergyRing(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number) {
  const { x: cx, y: cy } = RING_CENTER;
  const blend = state.blend, alpha = state.opacity;
  const hud = ENERGY_PALETTE.hud, info = ENERGY_PALETTE.infographic;
  const layer = ENERGY_LAYERS[state.activeIndex];
  const ratio = energyRatio(data[layer.key]);
  const accent = mixHex(hud.channels[state.activeIndex], info.channels[state.activeIndex], blend);
  const line = mixHex(hud.line, info.line, blend), dim = mixHex('#1c4a6e', '#4a2a8a', blend);
  const scale = mix(.55, 1, state.assembly);
  const radius = RING_RADIUS * scale;
  const spin = time * .18;
  ctx.save();
  ctx.lineCap = 'butt'; ctx.setLineDash([]); ctx.shadowBlur = 0;

  // Halo behind the ring.
  const halo = ctx.createRadialGradient(cx, cy, radius * .2, cx, cy, radius * 1.45);
  halo.addColorStop(0, withAlpha(accent === line ? '#5fe3ff' : '#5fe3ff', 0)); halo.addColorStop(.55, `rgba(0,0,0,0)`);
  halo.addColorStop(.7, withAlpha(mixHex('#5fe3ff', '#ff4fd8', blend), .12 * alpha)); halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.globalAlpha = 1; ctx.fillRect(cx - radius * 1.5, cy - radius * 1.5, radius * 3, radius * 3);

  // Gear teeth (act one) fade into a dotted orbit (act two).
  const toothAlpha = alpha * (1 - blend);
  if (toothAlpha > .01) {
    ctx.globalAlpha = toothAlpha; ctx.fillStyle = withAlpha(hud.line, .85);
    for (let tooth = 0; tooth < GEAR_TEETH; tooth++) {
      const a = spin + tooth / GEAR_TEETH * TAU, inner = radius * 1.02, outer = radius * 1.12, half = TAU / GEAR_TEETH * .28;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - half) * inner, cy + Math.sin(a - half) * inner);
      ctx.lineTo(cx + Math.cos(a - half * .7) * outer, cy + Math.sin(a - half * .7) * outer);
      ctx.lineTo(cx + Math.cos(a + half * .7) * outer, cy + Math.sin(a + half * .7) * outer);
      ctx.lineTo(cx + Math.cos(a + half) * inner, cy + Math.sin(a + half) * inner);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = toothAlpha * .9; ctx.strokeStyle = hud.line; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.02, 0, TAU); ctx.stroke();
  }
  const dotAlpha = alpha * blend;
  if (dotAlpha > .01) {
    ctx.fillStyle = info.channels[1];
    for (let dot = 0; dot < 36; dot++) {
      const a = -spin * .7 + dot / 36 * TAU;
      ctx.globalAlpha = dotAlpha * (dot % 3 === 0 ? 1 : .5);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * radius * 1.16, cy + Math.sin(a) * radius * 1.16, dot % 3 === 0 ? 3 : 1.6, 0, TAU); ctx.fill();
    }
  }

  // Outer segmented arc (act one) morphing into the wedge (act two): lit share = channel ratio.
  const outerR = radius * .92, lit = litSegments(OUTER_SEGMENTS, ratio);
  ringSegments(ctx, cx, cy, outerR, OUTER_SEGMENTS, lit, 9 * (1 - blend * .35), 0, accent, dim, alpha * (1 - blend * .55), -Math.PI / 2 + spin * .35);
  if (blend > .02) {
    // Wedge: an orange sector from twelve o'clock spanning the ratio, sitting on the ring's outer band.
    const start = -Math.PI / 2, end = start + TAU * ratio * blend;
    const wedge = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy);
    wedge.addColorStop(0, info.channels[1]); wedge.addColorStop(1, info.channels[0]);
    ctx.globalAlpha = alpha * blend; ctx.fillStyle = wedge;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.24, start, end); ctx.arc(cx, cy, radius * .98, end, start, true); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = alpha * blend * .9; ctx.strokeStyle = withAlpha(info.background, .9); ctx.lineWidth = 3;
    for (let cut = 1; cut < 3; cut++) {
      const a = start + (end - start) * cut / 3;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * radius * .98, cy + Math.sin(a) * radius * .98);
      ctx.lineTo(cx + Math.cos(a) * radius * 1.24, cy + Math.sin(a) * radius * 1.24); ctx.stroke();
    }
  }

  // Inner fine segments (both acts), then the notched core ring.
  ringSegments(ctx, cx, cy, radius * .74, INNER_SEGMENTS, litSegments(INNER_SEGMENTS, ratio), 5, 0,
    mixHex(hud.line, info.channels[0], blend), dim, alpha, Math.PI / 2 - spin * .5, .5);
  ctx.globalAlpha = alpha; ctx.strokeStyle = line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, radius * .62, 0, TAU); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = withAlpha(line, .35);
  for (let notch = 0; notch < 6; notch++) {
    const a = spin * .8 + notch / 6 * TAU;
    ctx.beginPath(); ctx.arc(cx, cy, radius * .62, a, a + TAU / 6 * .22); ctx.stroke();
  }
  // Core disc.
  const core = ctx.createRadialGradient(cx - radius * .15, cy - radius * .18, radius * .05, cx, cy, radius * .55);
  core.addColorStop(0, mixHex('#bff6ff', '#9fe8ff', blend)); core.addColorStop(.5, mixHex('#2fb7e6', '#3f8fe0', blend));
  core.addColorStop(1, mixHex('#0a2b52', '#231060', blend));
  ctx.globalAlpha = alpha * (.55 + .45 * state.assembly); ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(cx, cy, radius * .55 * (.8 + .2 * state.assembly), 0, TAU); ctx.fill();

  // Readout: value of the active channel in seven-segment digits, label under it.
  const reading = data[layer.key];
  const value = Number.isFinite(reading.value) ? reading.value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '--';
  drawSevenSegment(ctx, value.replace(/[^0-9.\-]/g, ''), cx, cy - 12, 34, mixHex('#e8fbff', '#fff1ff', blend), alpha * .95, { align: 'center', ghost: .06 });
  ctx.globalAlpha = alpha * .8; ctx.fillStyle = mixHex(hud.dim, info.dim, blend);
  ctx.font = `11px ${fonts.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${layer.label} · ${reading.unit} · ${(ratio * 100).toFixed(0)}%`, cx, cy + 46);
  ctx.restore();
}
