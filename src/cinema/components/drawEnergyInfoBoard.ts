import { ENERGY_PALETTE, INFO_PANELS, RING_CENTER, RING_RADIUS, checkGrid, dotMatrix, energyHistory, type EnergyBoardState } from '../energyDashboard';
import { ENERGY_LAYERS, energyRatio, type EnergyCoreData } from '../energyCore';
import type { FilmFonts } from '../filmDrawing';
import { drawHudPanel, withAlpha } from './drawHudPanel';

const TAU = Math.PI * 2;
const P = ENERGY_PALETTE.infographic;

/** Act two: violet infographic panels around the ring. Alpha fades the act in; settle slides the panels home. */
export function drawEnergyInfoBoard(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number, alpha: number) {
  if (alpha <= .005) return;
  const slide = (1 - state.settle) * 50;
  ctx.save();
  ctx.save(); ctx.translate(-slide, 0);
  drawLeadPanel(ctx, fonts, data, alpha);
  drawWavePanel(ctx, fonts, data, state, time, alpha);
  drawRingPercents(ctx, fonts, data, state, alpha);
  ctx.restore();
  ctx.save(); ctx.translate(slide, 0);
  drawMatrixPanel(ctx, fonts, data, state, time, alpha);
  drawChecksPanel(ctx, fonts, data, alpha);
  drawMountainPanel(ctx, fonts, data, state, time, alpha);
  ctx.restore();
  // Caption under the ring, like the reference's ring title.
  ctx.globalAlpha = alpha * .9; ctx.fillStyle = P.line; ctx.font = `13px ${fonts.label}`; ctx.textAlign = 'center';
  ctx.fillText(`${data.name} · 시연 데이터`, RING_CENTER.x, RING_CENTER.y + RING_RADIUS + 44);
  ctx.restore();
}

function drawLeadPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, alpha: number) {
  const rect = INFO_PANELS.lead;
  drawHudPanel(ctx, fonts, rect, { label: 'ENERGY / SUMMARY', line: P.line, panel: P.panel, ink: P.ink, alpha, grid: false });
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'left';
  ctx.fillStyle = P.dim; ctx.font = `10px ${fonts.label}`;
  ctx.fillText('전력·생산·효율 세 채널을 기준 대비 비율로 요약합니다.', rect.x + 16, rect.y + 40);
  ctx.fillText('오른쪽 매트릭스와 점검표는 같은 값에서 파생됩니다.', rect.x + 16, rect.y + 56);
  const power = Math.round(energyRatio(data.power) * 100), efficiency = Math.round(energyRatio(data.efficiency) * 100);
  ctx.font = `30px ${fonts.label}`;
  ctx.fillStyle = P.channels[0]; ctx.fillText(`${power}%`, rect.x + 22, rect.y + 100);
  ctx.strokeStyle = withAlpha(P.line, .5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rect.x + 138, rect.y + 72); ctx.lineTo(rect.x + 138, rect.y + 106); ctx.stroke();
  ctx.fillStyle = P.channels[2]; ctx.fillText(`${efficiency}%`, rect.x + 156, rect.y + 100);
  ctx.restore();
}

/** Left middle: title, note and layered wave lines whose amplitude follows the active channel. */
function drawWavePanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number, alpha: number) {
  const rect = INFO_PANELS.text, layer = ENERGY_LAYERS[state.activeIndex], ratio = energyRatio(data[layer.key]);
  drawHudPanel(ctx, fonts, rect, { label: `${layer.label} / ${layer.title}`, line: P.channels[0], panel: P.panel, ink: P.ink, alpha, grid: false });
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'left';
  ctx.fillStyle = P.ink; ctx.font = `18px ${fonts.label}`; ctx.fillText(`${layer.title} ${data[layer.key].value.toLocaleString('en-US')} ${data[layer.key].unit}`, rect.x + 16, rect.y + 52);
  ctx.fillStyle = P.dim; ctx.font = `10px ${fonts.label}`;
  ctx.fillText(`기준 ${data[layer.key].capacity.toLocaleString('en-US')} ${data[layer.key].unit} 대비 ${(ratio * 100).toFixed(1)}%`, rect.x + 16, rect.y + 72);
  ctx.fillText('파형은 비율에 비례한 연출이며 실측 파형이 아닙니다.', rect.x + 16, rect.y + 88);
  const left = rect.x + 14, right = rect.x + rect.width - 14, mid = rect.y + 160;
  for (let strand = 0; strand < 7; strand++) {
    ctx.beginPath();
    for (let step = 0; step <= 60; step++) {
      const u = step / 60, x = left + (right - left) * u;
      const envelope = Math.sin(Math.PI * u) ** 1.4 * (18 + ratio * 30);
      const y = mid + Math.sin(u * TAU * 2.4 + time * 2.2 + strand * .5) * envelope * (1 - strand * .08) + strand * 3;
      ctx[step ? 'lineTo' : 'moveTo'](x, y);
    }
    ctx.strokeStyle = withAlpha(strand % 2 ? P.channels[1] : P.channels[0], .75 - strand * .07); ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.fillStyle = P.channels[0]; ctx.beginPath(); ctx.moveTo(rect.x + 14, rect.y + rect.height - 14); ctx.lineTo(rect.x + 26, rect.y + rect.height - 14); ctx.lineTo(rect.x + 14, rect.y + rect.height - 26); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Bottom-left: three ring percentages, the active one largest. */
function drawRingPercents(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, alpha: number) {
  const rect = INFO_PANELS.rings;
  drawHudPanel(ctx, fonts, rect, { label: 'CHANNELS / RATIO', line: P.line, panel: P.panel, ink: P.ink, alpha, grid: false });
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  const order = [state.activeIndex, ...ENERGY_LAYERS.map((_, index) => index).filter(index => index !== state.activeIndex)];
  order.forEach((index, position) => {
    const ratio = energyRatio(data[ENERGY_LAYERS[index].key]);
    const r = position === 0 ? 40 : 30, x = rect.x + 58 + position * 92, y = rect.y + 100;
    ctx.lineWidth = position === 0 ? 7 : 5;
    ctx.strokeStyle = withAlpha(P.channels[index], .25); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    const sweep = ctx.createLinearGradient(x - r, y, x + r, y);
    sweep.addColorStop(0, P.channels[1]); sweep.addColorStop(1, P.channels[index]);
    ctx.strokeStyle = sweep; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * ratio); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.font = `${position === 0 ? 20 : 14}px ${fonts.label}`; ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(ratio * 100)}%`, x, y + (position === 0 ? 7 : 5));
    ctx.fillStyle = P.dim; ctx.font = `8px ${fonts.label}`; ctx.fillText(ENERGY_LAYERS[index].label, x, y + r + 16);
  });
  ctx.restore();
}

/** Top-right: dot matrix, columns filling with the active channel's ratio (brighter toward the right). */
function drawMatrixPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number, alpha: number) {
  const rect = INFO_PANELS.matrix, layer = ENERGY_LAYERS[state.activeIndex];
  drawHudPanel(ctx, fonts, rect, { label: `${layer.label} / MATRIX`, line: P.line, panel: P.panel, ink: P.ink, alpha, grid: false });
  const rows = 8, columns = 14, cell = 14, left = rect.x + 20, top = rect.y + 40;
  const grid = dotMatrix(rows, columns, energyRatio(data[layer.key]), state.activeIndex);
  ctx.save(); ctx.globalAlpha = alpha;
  grid.forEach((line, row) => line.forEach((level, column) => {
    const flicker = level > 0 ? .85 + .15 * Math.sin(time * 6 + column * .7 + row) : .12;
    ctx.fillStyle = level > 0 ? (column > columns * .55 ? P.channels[0] : P.channels[1]) : withAlpha(P.line, .2);
    ctx.globalAlpha = alpha * (level > 0 ? level * flicker : .35);
    const size = cell - 4;
    ctx.fillRect(left + column * cell, top + row * cell, size, size);
  }));
  // Fading header dots (the reference's sparse top row).
  for (let column = 0; column < columns; column++) {
    ctx.globalAlpha = alpha * Math.max(.1, 1 - column / columns);
    ctx.fillStyle = P.channels[1]; ctx.fillRect(left + column * cell, rect.y + 28, 6, 6);
  }
  ctx.restore();
}

/** Right middle: check grid (two rows of three) and a gradient bar for the active channel. */
function drawChecksPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, alpha: number) {
  const rect = INFO_PANELS.checks;
  drawHudPanel(ctx, fonts, rect, { label: 'CHECKS / 임계 판정', line: P.line, panel: P.panel, ink: P.ink, alpha, grid: false });
  const cells = checkGrid(data), size = 34, gap = 10, left = rect.x + 22, top = rect.y + 30;
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  cells.forEach((cell, index) => {
    const x = left + (index % 3) * (size + gap) * 2.25, y = top + Math.floor(index / 3) * (size + gap * .4);
    ctx.strokeStyle = withAlpha(P.line, .8); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size, y + size - 6); ctx.lineTo(x + size - 6, y + size); ctx.lineTo(x, y + size); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = cell.ok ? P.channels[1] : P.channels[0]; ctx.lineWidth = 3;
    ctx.beginPath();
    if (cell.ok) { ctx.moveTo(x + 9, y + 18); ctx.lineTo(x + 15, y + 24); ctx.lineTo(x + 26, y + 11); }
    else { ctx.moveTo(x + 10, y + 10); ctx.lineTo(x + 24, y + 24); ctx.moveTo(x + 24, y + 10); ctx.lineTo(x + 10, y + 24); }
    ctx.stroke();
  });
  const barY = rect.y + rect.height - 22, barX = rect.x + 22, barW = rect.width - 44;
  const bar = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  bar.addColorStop(0, P.channels[1]); bar.addColorStop(1, P.channels[0]);
  ctx.fillStyle = bar; ctx.globalAlpha = alpha * .9;
  const ratio = energyRatio(data.power);
  for (let tick = 0; tick < 40; tick++) {
    if (tick / 40 > ratio) ctx.globalAlpha = alpha * .18;
    ctx.fillRect(barX + tick * (barW / 40), barY - 8, barW / 40 - 2, 14);
  }
  ctx.restore();
}

/** Bottom-right: layered mountain lines for the active channel's history, with the proximity caption. */
function drawMountainPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: EnergyCoreData, state: EnergyBoardState, time: number, alpha: number) {
  const rect = INFO_PANELS.mountain, layer = ENERGY_LAYERS[state.activeIndex];
  drawHudPanel(ctx, fonts, rect, { label: `${layer.label} / TREND`, line: P.channels[0], panel: P.panel, ink: P.ink, alpha, grid: false, labelBottom: true });
  const history = energyHistory(data[layer.key], 24, state.activeIndex + 3);
  const left = rect.x + 12, right = rect.x + rect.width - 12, bottom = rect.y + rect.height - 30, height = rect.height - 70;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = P.ink; ctx.font = `11px ${fonts.label}`; ctx.textAlign = 'right';
  ctx.fillText(`Round ${Math.round(energyRatio(data[layer.key]) * 100)}% proximity`, right, rect.y + 24);
  for (let strand = 0; strand < 5; strand++) {
    ctx.beginPath();
    history.forEach((ratio, index) => {
      const u = index / (history.length - 1), x = left + (right - left) * u;
      const spike = Math.abs(Math.sin(u * TAU * 2.7 + strand * .6 + time * .3)) ** 3;
      const y = bottom - height * ratio * (.35 + .65 * spike) * (1 - strand * .12);
      ctx[index ? 'lineTo' : 'moveTo'](x, y);
    });
    ctx.strokeStyle = withAlpha(strand % 2 ? P.channels[1] : P.channels[0], .7 - strand * .1); ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.fillStyle = withAlpha(P.line, .35);
  for (let dot = 0; dot < 30; dot++) ctx.fillRect(left + dot * ((right - left) / 30), bottom + 6, 2, 2);
  ctx.restore();
}
