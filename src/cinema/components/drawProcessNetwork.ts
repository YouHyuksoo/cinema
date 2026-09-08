import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { processCapacity, processFlowPoint, type ProcessNetworkData, type ProcessNetworkState, type ProcessNodeState } from '../processNetwork';
import type { HoloPoint } from '../holoSpace';

const TAU = Math.PI * 2;
export interface ProcessNetworkOptions { data: ProcessNetworkData; state: ProcessNetworkState }

function filament(ctx: CanvasRenderingContext2D, state: ProcessNetworkState, from: HoloPoint, to: HoloPoint,
  bend: number, start = 0, end = 1) {
  ctx.beginPath();
  for (let index = 0; index <= 40; index++) {
    const point = state.project(processFlowPoint(from, to, start + (end - start) * index / 40, bend));
    if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

function processSymbol(ctx: CanvasRenderingContext2D, code: string, radius: number) {
  ctx.save(); ctx.scale(radius / 22, radius / 22); ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (code === 'REFLOW') {
    for (let column = -1; column <= 1; column++) {
      ctx.moveTo(column * 10, 14); ctx.bezierCurveTo(column * 10 - 10, 4, column * 10 + 11, -5, column * 10, -16);
    }
  } else if (code === 'AOI') {
    ctx.moveTo(-22, 0); ctx.bezierCurveTo(-8, -19, 8, -19, 22, 0); ctx.bezierCurveTo(8, 19, -8, 19, -22, 0);
    ctx.moveTo(6, 0); ctx.arc(0, 0, 6, 0, TAU);
  } else if (code === 'MOUNT') {
    ctx.rect(-12, -12, 24, 24); ctx.rect(-6, -6, 12, 12);
    for (const sign of [-1, 1]) for (let i = -1; i <= 1; i++) {
      ctx.moveTo(i * 7, sign * 12); ctx.lineTo(i * 7, sign * 20);
      ctx.moveTo(sign * 12, i * 7); ctx.lineTo(sign * 20, i * 7);
    }
  } else if (code === 'PRINT') {
    ctx.rect(-19, 3, 38, 12); ctx.moveTo(-16, -14); ctx.lineTo(15, -14); ctx.lineTo(22, -5); ctx.lineTo(-9, -5); ctx.closePath();
  } else {
    ctx.moveTo(-18, -12); ctx.lineTo(0, -21); ctx.lineTo(18, -12); ctx.lineTo(18, 11); ctx.lineTo(0, 21);
    ctx.lineTo(-18, 11); ctx.closePath(); ctx.moveTo(-18, -12); ctx.lineTo(0, -2); ctx.lineTo(18, -12); ctx.moveTo(0, -2); ctx.lineTo(0, 21);
  }
  ctx.stroke(); ctx.restore();
}

function drawNode(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: ProcessNetworkState, entry: ProcessNodeState) {
  const point = state.project(entry.point), focus = entry.selected ? state.focus : 0;
  const radius = (37 + focus * 25) * point.scale;
  const heat = entry.selected ? .85 * (1 - state.recovery) : 0;
  const alpha = state.opacity * (entry.selected ? 1 : 1 - state.focus * .82);
  ctx.save(); ctx.globalAlpha = alpha;
  const halo = ctx.createRadialGradient(point.x, point.y, radius * .38, point.x, point.y, radius * 2.4);
  halo.addColorStop(0, signalColor(heat, .17 + focus * .08)); halo.addColorStop(.5, signalColor(heat, .04));
  halo.addColorStop(1, signalColor(heat, 0)); ctx.fillStyle = halo;
  ctx.fillRect(point.x - radius * 2.4, point.y - radius * 2.4, radius * 4.8, radius * 4.8);
  const glass = ctx.createRadialGradient(point.x - radius * .4, point.y - radius * .45, 0, point.x, point.y, radius);
  glass.addColorStop(0, signalColor(heat, .2)); glass.addColorStop(.55, signalColor(heat, .035)); glass.addColorStop(1, signalColor(heat, .15));
  ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fillStyle = glass; ctx.fill();
  ctx.strokeStyle = signalColor(heat, .56); ctx.lineWidth = 1; ctx.stroke();
  // Crossing orbital meridians and a rear rim make each synapse a small volume.
  ctx.strokeStyle = signalColor(heat, .2); ctx.lineWidth = .7;
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath(); ctx.ellipse(point.x, point.y, radius * .95, radius * (.24 + layer * .07), state.time * .07 + layer * Math.PI / 3, 0, TAU); ctx.stroke();
  }
  const rotation = state.time * (entry.index % 2 ? -.2 : .17);
  for (let segment = 0; segment < 3; segment++) {
    ctx.beginPath(); ctx.arc(point.x, point.y, radius + 7 * point.scale, rotation + segment * TAU / 3, rotation + segment * TAU / 3 + .85);
    ctx.strokeStyle = signalColor(heat, .76); ctx.lineWidth = (entry.selected ? 2.5 : 1.5) * point.scale; ctx.stroke();
  }
  ctx.translate(point.x, point.y); ctx.strokeStyle = signalColor(heat, .95);
  processSymbol(ctx, entry.node.code, (19 + focus * 8) * point.scale); ctx.restore();
  const labelAbove = !entry.selected && state.focus > .1 && point.x > 830 && point.y < 225;
  const labelY = labelAbove ? point.y - radius - 24 * point.scale : point.y + radius + 29 * point.scale;
  filmText(ctx, fonts, entry.node.label, point.x, labelY, 14 + focus * 2,
    alpha * .95, false, 'center');
  filmText(ctx, fonts, `${String(entry.index + 1).padStart(2, '0')} / ${entry.node.code}`, point.x,
    labelY + 17 * point.scale, 9, alpha * .5, true, 'center');
  if (entry.selected) {
    const surge = .5 + .5 * Math.sin(state.time * 3.2);
    ctx.save(); ctx.globalAlpha = alpha * (1 - state.recovery) * smooth(3, 6, state.time);
    ctx.beginPath(); ctx.arc(point.x, point.y, radius + (16 + surge * 8) * point.scale, 0, TAU);
    ctx.strokeStyle = signalColor(.85, .36 - surge * .2); ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
}

function drawReadout(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: ProcessNetworkData, state: ProcessNetworkState) {
  const target = state.target;
  if (!target || state.readout <= 0) return;
  const face = state.project(target.point);
  // This camera-facing annotation has a reserved reading area, connected to the actual 3D target.
  const anchor = { x: 905, y: 225 };
  const heat = .85 * (1 - state.recovery), alpha = state.opacity * state.readout;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.moveTo(face.x + 75 * face.scale, face.y - 10 * face.scale);
  ctx.bezierCurveTo(face.x + 115 * face.scale, face.y - 10 * face.scale, anchor.x - 50, anchor.y + 36, anchor.x - 13, anchor.y + 36);
  ctx.strokeStyle = signalColor(heat, .5); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.translate(anchor.x, anchor.y); const size = 1 + state.focus * .025; ctx.scale(size, size);
  ctx.strokeStyle = signalColor(heat, .6); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-12, 28); ctx.moveTo(-12, 167); ctx.lineTo(-12, 190); ctx.lineTo(18, 190); ctx.stroke();
  const text = (value: string, x: number, y: number, px: number, opacity = 1, mono = false, color = '#d7edf0') =>
    filmText(ctx, fonts, value, x, y, px, opacity * alpha, mono, 'left', color);
  text(state.flowRecovered ? 'FLOW RECOVERED' : state.recovery > 0 ? 'RECOVERY IN PROGRESS' : 'BOTTLENECK DETECTED',
    0, 0, 10, .8, true, signalColor(heat, 1));
  text(target.node.label, 0, 30, 23, .98);
  text('공정 앞 대기', 0, 60, 12, .6);
  text(String(Math.round(target.reading.queue)).padStart(2, '0'), 0, 118, 62, 1, true, signalColor(heat, 1));
  text('EA', 87, 115, 14, .65, true);
  const rows = [
    { label: '사이클', value: `${target.reading.cycleSeconds.toFixed(1)} s`, x: 0 },
    { label: '처리 능력', value: `${Math.round(processCapacity(target.reading))} /h`, x: 122 },
  ];
  for (const row of rows) { text(row.label, row.x, 149, 11, .55); text(row.value, row.x, 174, 20, .95, true); }
  const capacity = processCapacity(target.reading), demand = data.demandPerHour;
  ctx.fillStyle = signalColor(0, .1); ctx.fillRect(0, 205, 232, 4);
  ctx.fillStyle = signalColor(heat, .8); ctx.fillRect(0, 205, 232 * Math.min(1, capacity / Math.max(1, demand)), 4);
  text(state.flowRecovered ? '목표 처리량 확보 · 대기 분산 시뮬레이션'
    : state.recovery > .01 ? '대기 분산 시뮬레이션 진행 중' : '대기 입자 밀집 · 이 구간에서 흐름 지연', 0, 232, 11, .62);
  ctx.restore();
}

/** Data and scene time are inputs: geometry, particles and labels can be reused in another composition. */
export function drawProcessNetwork(ctx: CanvasRenderingContext2D, fonts: FilmFonts, { data, state }: ProcessNetworkOptions) {
  const lookup = new Map(state.nodes.map(node => [node.node.id, node]));
  ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = state.opacity * (1 - state.focus * .28);
  for (let index = 0; index < data.links.length; index++) {
    const link = data.links[index], from = lookup.get(link.from), to = lookup.get(link.to);
    if (!from || !to) continue;
    const blocked = to.selected && !state.flowRecovered;
    const heat = blocked ? .8 * (1 - state.recovery) : 0;
    // Three narrow channels braid around the same directed production link.
    for (let strand = -1; strand <= 1; strand++) {
      ctx.lineWidth = strand === 0 ? 2 : .65;
      ctx.strokeStyle = signalColor(heat, strand === 0 ? .24 : .12);
      filament(ctx, state, from.point, to.point, link.bend + strand * 24);
    }
    ctx.lineWidth = 9; ctx.strokeStyle = signalColor(heat, .028);
    filament(ctx, state, from.point, to.point, link.bend);
    for (let particle = 0; particle < 7; particle++) {
      const progress = ((state.time * (.15 + state.recovery * .075) + particle / 7 + index * .19) % 1 + 1) % 1;
      const p = state.project(processFlowPoint(from.point, to.point, progress, link.bend));
      ctx.lineWidth = 2.2; ctx.strokeStyle = signalColor(heat, .7);
      filament(ctx, state, from.point, to.point, link.bend, Math.max(0, progress - .04), progress);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 * p.scale, 0, TAU); ctx.fillStyle = signalColor(heat, .96); ctx.fill();
    }
    // Queue lights collect on the inbound path, then drain as the supplied recovery values arrive.
    if (to.selected) {
      const count = Math.min(32, Math.round(to.reading.queue)) * smooth(3, 6, state.time);
      for (let particle = 0; particle < count; particle++) {
        const progress = .69 + (particle % 9) * .025;
        const p = state.project(processFlowPoint(from.point, to.point, progress, link.bend + Math.floor(particle / 9) * 9));
        ctx.beginPath(); ctx.arc(p.x, p.y, (1.4 + Math.sin(particle + state.time * 3) * .35) * p.scale, 0, TAU);
        ctx.fillStyle = signalColor(heat, .5 + Math.sin(state.time * 2 + particle) * .2); ctx.fill();
      }
    }
  }
  // Fine peripheral synapses grow out of each process; they remain open to the surrounding space.
  for (const entry of state.nodes) for (let satellite = 0; satellite < 4; satellite++) {
    const angle = satellite * TAU / 4 + entry.index * 1.7 + state.time * .025;
    const end = { x: entry.point.x + Math.cos(angle) * 80, y: entry.point.y + Math.sin(angle) * 74,
      z: entry.point.z + Math.sin(angle * 2) * 55 };
    ctx.strokeStyle = signalColor(0, .07 * (1 - state.focus * .5)); ctx.lineWidth = .65;
    filament(ctx, state, entry.point, end, 20);
    const p = state.project(end); ctx.beginPath(); ctx.arc(p.x, p.y, 2.1 * p.scale, 0, TAU);
    ctx.fillStyle = signalColor(0, .34); ctx.fill();
  }
  ctx.restore();
  const ordered = [...state.nodes].sort((a, b) => state.project(b.point).depth - state.project(a.point).depth);
  for (const entry of ordered) drawNode(ctx, fonts, state, entry);
  drawReadout(ctx, fonts, data, state);
}
