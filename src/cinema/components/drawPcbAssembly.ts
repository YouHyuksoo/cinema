import { signalColor, type FilmFonts } from '../filmDrawing';
import type { HoloPoint, HoloProjectedPoint } from '../holoSpace';
import { pcbComponentEntrance, type PcbEntranceState } from '../pcbEntrance';
import { PCB_DEFECT_LABELS, type PcbComponent, type PcbInspectionData } from '../pcbInspectionData';
import type { PcbInspectionState } from '../pcbInspection';
import { phoneCircle, phoneLabel, phonePath, phonePlate, type PhoneProject } from './phoneDrawing';

interface LocalPad { x: number; y: number; width: number; height: number }
const BOARD_FRONT = 'rgba(72,219,211,.075)';

function localPoint(component: PcbComponent, x: number, y: number, z: number): HoloPoint {
  const angle = component.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: component.x + x * cos - y * sin, y: component.y + x * sin + y * cos, z };
}

function face(ctx: CanvasRenderingContext2D, project: PhoneProject, component: PcbComponent,
  x: number, y: number, width: number, height: number, z: number, fill: string, stroke?: string) {
  phonePath(ctx, project, [localPoint(component, x - width / 2, y - height / 2, z), localPoint(component, x + width / 2, y - height / 2, z),
    localPoint(component, x + width / 2, y + height / 2, z), localPoint(component, x - width / 2, y + height / 2, z)], true);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .65; ctx.stroke(); }
}

function prism(ctx: CanvasRenderingContext2D, project: PhoneProject, component: PcbComponent,
  x: number, y: number, width: number, height: number, rearZ: number, depth: number, fill: string, side: string, edge: string) {
  const rear = [localPoint(component, x - width / 2, y - height / 2, rearZ), localPoint(component, x + width / 2, y - height / 2, rearZ),
    localPoint(component, x + width / 2, y + height / 2, rearZ), localPoint(component, x - width / 2, y + height / 2, rearZ)];
  const front = rear.map(point => ({ ...point, z: rearZ - depth }));
  const walls = rear.map((point, index) => {
    const next = (index + 1) % rear.length, points = [point, rear[next], front[next], front[index]];
    return { points, depth: points.reduce((sum, item) => sum + project(item).depth, 0) };
  }).sort((a, b) => b.depth - a.depth);
  for (const wall of walls) { phonePath(ctx, project, wall.points, true); ctx.fillStyle = side; ctx.fill(); }
  phonePath(ctx, project, front, true); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = .75; ctx.stroke();
}

function componentPads(component: PcbComponent): LocalPad[] {
  if (component.kind === 'resistor' || component.kind === 'capacitor') {
    return [-1, 1].map(sign => ({ x: sign * component.width * .48, y: 0, width: component.width * .34, height: component.height * 1.3 }));
  }
  if (component.kind === 'connector') {
    const count = Math.max(3, Math.min(10, Math.round(component.height / 3)));
    return Array.from({ length: count }, (_, index) => ({ x: 0, y: (index / (count - 1) - .5) * component.height * .76,
      width: component.width * 1.18, height: Math.max(.7, component.height / count * .38) }));
  }
  const count = Math.max(4, Math.min(8, Math.round(component.width / 3)));
  return [-1, 1].flatMap(side => Array.from({ length: count }, (_, index) => ({
    x: (index / (count - 1) - .5) * component.width * .78, y: side * component.height * .57,
    width: Math.max(.7, component.width / count * .38), height: component.height * .3,
  })));
}

function drawPads(ctx: CanvasRenderingContext2D, project: PhoneProject, component: PcbComponent, boardTop: number) {
  const pads = componentPads(component);
  pads.forEach((pad, index) => {
    const insufficient = component.defect === 'insufficient_solder' && index === 0;
    face(ctx, project, component, pad.x, pad.y, pad.width, pad.height, boardTop - .12,
      insufficient ? 'rgba(255,193,104,.92)' : 'rgba(95,227,255,.40)', insufficient ? signalColor(1, .98) : 'rgba(119,239,255,.72)');
    if (insufficient) {
      const point = localPoint(component, pad.x, pad.y, boardTop - .2);
      phoneCircle(ctx, project, point.x, point.y, point.z, Math.max(.25, Math.min(pad.width, pad.height) * .18));
      ctx.fillStyle = 'rgba(255,206,121,.96)'; ctx.fill();
    }
  });
  if (component.defect === 'bridge' && pads.length >= 2) {
    const first = pads[0], second = pads[1];
    phonePath(ctx, project, [localPoint(component, first.x, first.y, boardTop - .26), localPoint(component, second.x, second.y, boardTop - .26)]);
    ctx.strokeStyle = signalColor(1, .98); ctx.lineWidth = 3.3; ctx.lineCap = 'round'; ctx.shadowColor = signalColor(1, .8); ctx.shadowBlur = 5; ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawBody(ctx: CanvasRenderingContext2D, project: PhoneProject, fonts: FilmFonts,
  component: PcbComponent, boardTop: number, selected: boolean) {
  const offset = component.defect === 'offset' ? Math.min(2.2, Math.max(1.1, component.width * .22)) : 0;
  if (offset) {
    ctx.save(); ctx.setLineDash([2.2, 1.6]);
    face(ctx, project, component, 0, 0, component.width, component.height, boardTop - .2, 'rgba(0,0,0,0)', signalColor(1, .9));
    ctx.restore();
    phonePath(ctx, project, [localPoint(component, 0, 0, boardTop - .25), localPoint(component, offset, 0, boardTop - .25)]);
    ctx.strokeStyle = signalColor(1, .95); ctx.lineWidth = 1.2; ctx.stroke();
  }
  const bodyFill = component.kind === 'capacitor' ? 'rgba(155,235,230,.13)' : component.kind === 'resistor' ? 'rgba(95,227,255,.10)'
    : component.kind === 'connector' ? 'rgba(119,221,233,.08)' : 'rgba(54,168,181,.09)';
  const bodySide = 'rgba(32,131,143,.055)';
  prism(ctx, project, component, offset, 0, component.width, component.height, boardTop - .22, component.depth,
    bodyFill, bodySide, selected || component.defect !== 'none' ? signalColor(component.defect === 'none' ? 0 : 1, .98) : 'rgba(95,227,255,.48)');
  const labelPoint = localPoint(component, offset, 0, boardTop - component.depth - .25);
  phoneLabel(ctx, project, component.id, labelPoint.x, labelPoint.y, labelPoint.z,
    component.kind === 'ic' ? Math.max(2.2, Math.min(3.2, component.width / 5)) : 2.1, fonts.mono,
    selected ? '#f5fbff' : 'rgba(184,238,235,.72)', 'center');
}

function drawBoardDetails(ctx: CanvasRenderingContext2D, project: PhoneProject, fonts: FilmFonts,
  data: PcbInspectionData, boardTop: number, entrance: PcbEntranceState) {
  ctx.save(); ctx.globalAlpha *= entrance.outline;
  if (!entrance.complete) { ctx.setLineDash([Math.max(1, entrance.outline * 76), 18]); ctx.lineDashOffset = -entrance.time * 24; }
  phonePlate(ctx, project, { x: 0, y: 0, z: 0, width: data.width, height: data.height, depth: data.thickness,
    radius: Math.min(3, data.height * .04), fill: BOARD_FRONT, side: 'rgba(53,201,192,.10)', edge: 'rgba(116,239,225,.62)' });
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= entrance.circuits;
  const buses = [-data.height * .32, 0, data.height * .32];
  for (const [index, component] of data.components.entries()) {
    const busY = buses[index % buses.length];
    phonePath(ctx, project, [{ x: component.x, y: component.y, z: boardTop - .04 },
      { x: component.x * .55, y: busY, z: boardTop - .04 }, { x: 0, y: busY, z: boardTop - .04 }]);
    ctx.strokeStyle = index % 4 ? 'rgba(95,227,255,.42)' : 'rgba(255,193,104,.34)';
    ctx.lineWidth = index % 3 ? .5 : .8; ctx.stroke();
    if (index % 3 === 0) {
      const via = { x: component.x * .55, y: busY, z: boardTop - .08 };
      phoneCircle(ctx, project, via.x, via.y, via.z, 1); ctx.fillStyle = 'rgba(95,227,255,.65)'; ctx.fill();
      phoneCircle(ctx, project, via.x, via.y, via.z - .02, .38); ctx.fillStyle = '#061a15'; ctx.fill();
    }
  }
  for (const [x, y] of [[-.46, -.4], [.46, -.4], [-.46, .4], [.46, .4]] as const) {
    phoneCircle(ctx, project, x * data.width, y * data.height, boardTop - .1, 2.2); ctx.fillStyle = 'rgba(115,232,226,.52)'; ctx.fill();
    phoneCircle(ctx, project, x * data.width, y * data.height, boardTop - .12, 1.1); ctx.fillStyle = '#061a15'; ctx.fill();
  }
  phoneLabel(ctx, project, data.name, -data.width * .46, data.height * .45, boardTop - .12, 2.8, fonts.mono, 'rgba(154,237,226,.58)');
  phoneLabel(ctx, project, `SN / ${data.serial}`, data.width * .46, data.height * .45, boardTop - .12, 2.4, fonts.mono, 'rgba(154,237,226,.58)', 'right');
  ctx.restore();
}

export interface PcbAssemblyResult { selectedAnchor: HoloProjectedPoint | null; selectedSize: { width: number; height: number } | null }

/** Draws physical geometry only; counts and copy stay in the readout component. */
export function drawPcbAssembly(ctx: CanvasRenderingContext2D, project: PhoneProject, fonts: FilmFonts,
  data: PcbInspectionData, state: PcbInspectionState, boardTop: number, entrance: PcbEntranceState): PcbAssemblyResult {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.shadowBlur = 0;
  drawBoardDetails(ctx, project, fonts, data, boardTop, entrance);
  const order = new Map(data.components.map((component, index) => [component.id, index]));
  const components = [...data.components].sort((a, b) => project({ x: b.x, y: b.y, z: boardTop }).depth - project({ x: a.x, y: a.y, z: boardTop }).depth);
  for (const component of components) {
    const failed = component.defect !== 'none' && component.defect !== 'uninspected';
    const selected = state.selectedComponent?.id === component.id;
    const arrival = pcbComponentEntrance(order.get(component.id) ?? 0, data.components.length, entrance);
    const componentTop = boardTop - arrival.lift;
    ctx.save(); ctx.globalAlpha *= state.presence * arrival.reveal * (selected ? 1 : failed ? .92 : component.defect === 'uninspected' ? .32 : .57);
    drawPads(ctx, project, component, componentTop);
    drawBody(ctx, project, fonts, component, componentTop, selected);
    if (failed) {
      const anchor = project({ x: component.x, y: component.y, z: componentTop - component.depth - .35 });
      const radius = selected ? 15 : 7;
      ctx.beginPath();
      for (let side = 0; side < 6; side++) {
        const angle = -Math.PI / 2 + side * Math.PI / 3;
        const x = anchor.x + Math.cos(angle) * radius, y = anchor.y + Math.sin(angle) * radius;
        if (side) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.strokeStyle = signalColor(1, selected ? 1 : .78); ctx.lineWidth = selected ? 1.8 : .9;
      ctx.shadowColor = signalColor(1, .6); ctx.shadowBlur = selected ? 7 : 3; ctx.stroke(); ctx.shadowBlur = 0;
      if (!selected || state.focus < .72) phoneLabel(ctx, project, PCB_DEFECT_LABELS[component.defect], component.x,
        component.y - component.height * .72, componentTop - component.depth - .4, 2.7, fonts.label, signalColor(1, .95), 'center');
    }
    ctx.restore();
  }
  const selected = state.selectedComponent;
  if (!selected) { ctx.restore(); return { selectedAnchor: null, selectedSize: null }; }
  const anchor = project({ x: selected.x, y: selected.y, z: boardTop - selected.depth });
  const left = project(localPoint(selected, -selected.width / 2, 0, boardTop - selected.depth));
  const right = project(localPoint(selected, selected.width / 2, 0, boardTop - selected.depth));
  const top = project(localPoint(selected, 0, -selected.height / 2, boardTop - selected.depth));
  const bottom = project(localPoint(selected, 0, selected.height / 2, boardTop - selected.depth));
  const result = { selectedAnchor: anchor, selectedSize: { width: Math.max(42, Math.hypot(right.x - left.x, right.y - left.y) * 1.35),
    height: Math.max(34, Math.hypot(bottom.x - top.x, bottom.y - top.y) * 1.55) } };
  ctx.restore();
  return result;
}
