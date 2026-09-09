import { ENERGY_PALETTE, HUD_PANELS, RING_CENTER, RING_RADIUS, energyHistory, gaugeAngle, type EnergyBoardState } from '../energyDashboard';
import { ENERGY_LAYERS, energyRatio, type EnergyCoreData } from '../energyCore';
import type { FilmFonts } from '../filmDrawing';
import { drawHudPanel, drawSevenSegment, withAlpha } from './drawHudPanel';

const TAU = Math.PI * 2;
const P = ENERGY_PALETTE.hud;

/** Act one: four glass panels, the holographic pedestal and the corner caption. Alpha fades the act out. */
export function drawEnergyHudBoard(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number, alpha: number) {
  if (alpha <= .005) return;
  const slide = (1 - state.assembly) * 60;
  const panelAlpha = alpha * state.assembly;
  ctx.save();
  drawPedestal(ctx, time, alpha * state.assembly);
  ctx.save(); ctx.translate(-slide, 0);
  drawBarsPanel(ctx, fonts, data, state, panelAlpha);
  drawSpeedGauge(ctx, fonts, data, state, time, panelAlpha);
  ctx.restore();
  ctx.save(); ctx.translate(slide, 0);
  drawRingGauges(ctx, fonts, data, state, time, panelAlpha);
  drawHexReadouts(ctx, fonts, data, state, panelAlpha);
  ctx.restore();
  // Caption (bottom-left) and three glowing controls (bottom-right).
  ctx.globalAlpha = panelAlpha * .85; ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.font = `12px ${fonts.label}`;
  const lines = [data.name, `전력 ${data.power.value} ${data.power.unit} · 생산 ${data.production.value.toLocaleString('en-US')} ${data.production.unit}`, `효율 ${data.efficiency.value} ${data.efficiency.unit} · 시연 데이터`];
  lines.forEach((text, index) => ctx.fillText(text, 84, 566 + index * 18));
  ctx.strokeStyle = withAlpha(P.line, .7); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(300, 560); ctx.lineTo(430, 560); ctx.lineTo(RING_CENTER.x - RING_RADIUS * .3, RING_CENTER.y + RING_RADIUS * .55); ctx.stroke();
  const controls: [string, string][] = [['⚡', P.channels[0]], ['⚙', P.channels[2]], ['●', P.channels[2]]];
  controls.forEach(([glyph, color], index) => {
    const x = 1010 + index * 74, y = 600;
    ctx.globalAlpha = panelAlpha; ctx.fillStyle = withAlpha(color, .22);
    ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `16px ${fonts.label}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y + 1); ctx.textBaseline = 'alphabetic';
  });
  ctx.restore();
}

/** Holographic platform under the ring: concentric dashed ellipses and a light column rising into the ring. */
function drawPedestal(ctx: CanvasRenderingContext2D, time: number, alpha: number) {
  const cx = RING_CENTER.x, baseY = 618, rx = 210, ry = 34;
  ctx.save();
  ctx.globalAlpha = alpha * .35;
  const beam = ctx.createLinearGradient(0, baseY, 0, RING_CENTER.y);
  beam.addColorStop(0, withAlpha('#5fe3ff', .5)); beam.addColorStop(1, withAlpha('#5fe3ff', 0));
  ctx.fillStyle = beam;
  ctx.beginPath(); ctx.moveTo(cx - 120, baseY); ctx.lineTo(cx + 120, baseY); ctx.lineTo(cx + 70, RING_CENTER.y + 40); ctx.lineTo(cx - 70, RING_CENTER.y + 40); ctx.closePath(); ctx.fill();
  const rings: [number, string, number[]][] = [[1, P.line, []], [1.18, P.channels[0], [6, 8]], [1.36, P.channels[2], [3, 9]]];
  rings.forEach(([scale, color, dash], index) => {
    ctx.save(); ctx.translate(cx, baseY); ctx.rotate(0); ctx.scale(1, ry / rx);
    ctx.rotate(time * (index % 2 ? -.25 : .18));
    ctx.setLineDash(dash); ctx.lineWidth = index === 0 ? 3 : 2; ctx.strokeStyle = color; ctx.globalAlpha = alpha * (index === 0 ? .9 : .6);
    ctx.beginPath(); ctx.arc(0, 0, rx * scale, 0, TAU); ctx.stroke();
    ctx.restore();
  });
  ctx.globalAlpha = alpha * .6;
  const glow = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, rx * .9);
  glow.addColorStop(0, withAlpha('#5fe3ff', .5)); glow.addColorStop(1, withAlpha('#5fe3ff', 0));
  ctx.save(); ctx.translate(cx, baseY); ctx.scale(1, ry / rx); ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, rx * .9, 0, TAU); ctx.fill(); ctx.restore();
  ctx.restore();
}

/** Top-left: history bars with an area curve for the active channel. */
function drawBarsPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, alpha: number) {
  const rect = HUD_PANELS.topLeft, layer = ENERGY_LAYERS[state.activeIndex];
  drawHudPanel(ctx, fonts, rect, { label: `${layer.label} / 24H`, line: P.line, panel: P.panel, ink: P.ink, alpha });
  const history = energyHistory(data[layer.key], 8, state.activeIndex);
  const left = rect.x + 26, right = rect.x + rect.width - 20, bottom = rect.y + rect.height - 26, top = rect.y + 44;
  const step = (right - left) / history.length;
  ctx.save(); ctx.globalAlpha = alpha;
  history.forEach((ratio, index) => {
    const h = (bottom - top) * ratio * state.channelProgress ** .3;
    const x = left + index * step + step * .2, w = step * .6;
    const bar = ctx.createLinearGradient(0, bottom - h, 0, bottom);
    bar.addColorStop(0, P.channels[index % 2 ? 0 : 2]); bar.addColorStop(1, withAlpha(P.line, .35));
    ctx.fillStyle = bar; ctx.fillRect(x, bottom - h, w, h);
  });
  ctx.beginPath();
  history.forEach((ratio, index) => {
    const x = left + index * step + step / 2, y = bottom - (bottom - top) * ratio * .8;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = P.channels[0]; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(right, bottom); ctx.lineTo(left + step / 2, bottom); ctx.closePath();
  ctx.fillStyle = withAlpha(P.channels[0], .16); ctx.fill();
  ctx.restore();
}

/** Bottom-left: speedometer for the active channel with a needle that settles over the channel window. */
function drawSpeedGauge(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number, alpha: number) {
  const rect = HUD_PANELS.bottomLeft, layer = ENERGY_LAYERS[state.activeIndex], reading = data[layer.key];
  drawHudPanel(ctx, fonts, rect, { label: `${layer.label} / GAUGE`, line: P.line, panel: P.panel, ink: P.ink, alpha, labelBottom: true });
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2 + 6, r = 74;
  const ratio = energyRatio(reading), settled = Math.min(1, state.channelProgress * 3);
  const needle = gaugeAngle(ratio * settled + Math.sin(time * 9) * .006 * (1 - settled));
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  ctx.strokeStyle = withAlpha(P.line, .35); ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(cx, cy, r, gaugeAngle(0), gaugeAngle(1)); ctx.stroke();
  const sweep = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  sweep.addColorStop(0, P.channels[2]); sweep.addColorStop(.6, P.line); sweep.addColorStop(1, P.channels[0]);
  ctx.strokeStyle = sweep; ctx.beginPath(); ctx.arc(cx, cy, r, gaugeAngle(0), needle); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = P.ink;
  for (let tick = 0; tick <= 10; tick++) {
    const a = gaugeAngle(tick / 10), inner = r - 14, outer = tick % 5 === 0 ? r - 26 : r - 20;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner); ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer); ctx.stroke();
  }
  ctx.strokeStyle = P.channels[0]; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(needle) * (r - 30), cy + Math.sin(needle) * (r - 30)); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
  ctx.font = `10px ${fonts.mono}`; ctx.fillStyle = P.dim; ctx.textAlign = 'center';
  ctx.fillText(`x ${reading.capacity.toLocaleString('en-US')} ${reading.unit}`, cx, cy - 24);
  drawSevenSegment(ctx, String(Math.round(ratio * 100)), cx + 2, cy + 6, 26, P.channels[0], alpha, { align: 'center', ghost: .1 });
  ctx.fillStyle = P.dim; ctx.fillText('%', cx + 40, cy + 30);
  // Side brackets like the reference.
  ctx.strokeStyle = withAlpha(P.channels[2], .8); ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(cx, cy, r + 18, side < 0 ? Math.PI * .9 : Math.PI * 1.85, side < 0 ? Math.PI * 1.15 : Math.PI * 2.1); ctx.stroke();
  }
  ctx.restore();
}

/** Top-right: one large double ring for the active channel and two small rings for the others. */
function drawRingGauges(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number, alpha: number) {
  const rect = HUD_PANELS.topRight;
  drawHudPanel(ctx, fonts, rect, { label: 'CHANNELS / RINGS', line: P.line, panel: P.panel, ink: P.ink, alpha });
  const others = ENERGY_LAYERS.map((_, index) => index).filter(index => index !== state.activeIndex);
  const big = { x: rect.x + rect.width - 84, y: rect.y + rect.height / 2 + 6, r: 58 };
  const smalls = others.map((index, position) => ({ index, x: rect.x + 62, y: rect.y + 66 + position * 78, r: 26 }));
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'butt';
  const ring = (x: number, y: number, r: number, ratio: number, color: string, width: number, dashed: boolean, direction: number) => {
    ctx.setLineDash(dashed ? [4, 5] : []); ctx.lineWidth = width;
    ctx.strokeStyle = withAlpha(color, .25); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2 + time * .2 * direction, -Math.PI / 2 + time * .2 * direction + TAU * ratio); ctx.stroke();
    ctx.setLineDash([]);
  };
  const activeRatio = energyRatio(data[ENERGY_LAYERS[state.activeIndex].key]);
  ring(big.x, big.y, big.r, activeRatio, P.channels[state.activeIndex], 9, false, 1);
  ring(big.x, big.y, big.r - 16, activeRatio * .9, P.line, 4, true, -1);
  ring(big.x, big.y, big.r + 12, activeRatio, withAlpha(P.channels[state.activeIndex], .5), 2, true, 1);
  ctx.fillStyle = P.ink; ctx.font = `14px ${fonts.mono}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(activeRatio * 100)}%`, big.x, big.y + 5);
  smalls.forEach(({ index, x, y, r }) => {
    const ratio = energyRatio(data[ENERGY_LAYERS[index].key]);
    ring(x, y, r, ratio, P.channels[index], 5, index === 2, index === 2 ? -1 : 1);
    ring(x, y, r - 9, ratio, withAlpha(P.channels[index], .55), 2, true, -1);
    ctx.fillStyle = P.ink; ctx.font = `10px ${fonts.mono}`; ctx.fillText(`${Math.round(ratio * 100)}%`, x, y + 4);
  });
  ctx.restore();
}

/** Bottom-right: one large hexagon readout for the active value and two small hexagons for the others. */
function drawHexReadouts(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, alpha: number) {
  const rect = HUD_PANELS.bottomRight;
  drawHudPanel(ctx, fonts, rect, { label: 'READOUT / VALUES', line: P.line, panel: P.panel, ink: P.ink, alpha, labelBottom: true });
  const hex = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath();
    for (let corner = 0; corner < 6; corner++) { const a = corner / 6 * TAU + Math.PI / 6; ctx[corner ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = withAlpha(color, .35); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let corner = 0; corner < 6; corner++) { const a = corner / 6 * TAU + Math.PI / 6; ctx[corner ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r * .84, y + Math.sin(a) * r * .84); }
    ctx.closePath(); ctx.stroke();
  };
  ctx.save(); ctx.globalAlpha = alpha;
  const active = ENERGY_LAYERS[state.activeIndex], reading = data[active.key];
  const big = { x: rect.x + rect.width - 92, y: rect.y + rect.height / 2 - 6, r: 64 };
  hex(big.x, big.y, big.r, P.channels[state.activeIndex]);
  const digits = Number.isFinite(reading.value) ? String(Math.round(reading.value)).slice(-4) : '--';
  drawSevenSegment(ctx, digits, big.x, big.y - 16, 30, P.line, alpha, { align: 'center', ghost: .1 });
  ctx.fillStyle = P.dim; ctx.font = `9px ${fonts.mono}`; ctx.textAlign = 'center'; ctx.fillText(`${active.label} ${reading.unit}`, big.x, big.y + 36);
  ENERGY_LAYERS.map((_, index) => index).filter(index => index !== state.activeIndex).forEach((index, position) => {
    const x = rect.x + 58, y = rect.y + 62 + position * 82, value = data[ENERGY_LAYERS[index].key].value;
    hex(x, y, 30, P.channels[index]);
    drawSevenSegment(ctx, Number.isFinite(value) ? String(Math.round(value)).slice(-3) : '--', x, y - 8, 15, P.line, alpha, { align: 'center', ghost: .1 });
    ctx.fillStyle = P.dim; ctx.font = `8px ${fonts.mono}`; ctx.fillText(ENERGY_LAYERS[index].label, x, y + 22);
  });
  ctx.restore();
}
