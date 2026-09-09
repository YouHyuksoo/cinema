import type { FilmViewportInsets } from './filmViewport';
import { createHoloProjection, type HoloPoint, type HoloProjectedPoint } from './holoSpace';
import { PCB_INSPECTION_TIMING, type PcbInspectionState } from './pcbInspection';
import type { PcbComponent, PcbInspectionData } from './pcbInspectionData';
import { smoothstep as smooth } from './filmMath';

export interface PcbLayoutRect { x: number; y: number; width: number; height: number }
export interface PcbInspectionLayout {
  portrait: boolean;
  logicalWidth: number;
  logicalHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  header: PcbLayoutRect;
  board: PcbLayoutRect;
  readout: PcbLayoutRect;
}

/** Responsive scene coordinates. Backing pixels and the dock inset scale together, so DPR cancels. */
export function pcbInspectionLayout(width: number, height: number, insets?: FilmViewportInsets): PcbInspectionLayout {
  const safeWidth = Math.max(1, width), safeHeight = Math.max(1, height);
  const dock = Math.max(0, Math.min(safeHeight - 1, insets?.bottomInset ?? safeHeight * .23));
  const available = Math.max(1, safeHeight - dock - safeHeight * .04);
  const portrait = safeWidth / Math.max(1, safeHeight - dock) < .95;
  if (portrait) {
    const logicalWidth = 440, scale = safeWidth / logicalWidth, logicalHeight = available / scale;
    const top = safeHeight * .02 / scale;
    const header: PcbLayoutRect = { x: 18, y: 8, width: logicalWidth - 36, height: 70 };
    const readoutHeight = Math.min(260, Math.max(168, logicalHeight * .36));
    const boardHeight = Math.max(126, logicalHeight - 82 - 10 - readoutHeight - 10);
    const board: PcbLayoutRect = { x: 14, y: 82, width: logicalWidth - 28, height: boardHeight };
    const readoutY = board.y + board.height + 10;
    return { portrait, logicalWidth, logicalHeight, scale, offsetX: 0, offsetY: top * scale,
      header, board, readout: { x: 14, y: readoutY, width: logicalWidth - 28, height: Math.max(0, logicalHeight - readoutY - 10) } };
  }
  const logicalWidth = 1280, logicalHeight = 720;
  const scale = Math.max(.001, Math.min(safeWidth / logicalWidth, available / logicalHeight));
  return { portrait, logicalWidth, logicalHeight, scale,
    offsetX: (safeWidth - logicalWidth * scale) / 2, offsetY: (available - logicalHeight * scale) / 2 + safeHeight * .02,
    header: { x: 48, y: 34, width: 1184, height: 66 },
    board: { x: 40, y: 102, width: 830, height: 490 },
    readout: { x: 900, y: 142, width: 332, height: 330 } };
}

export function applyPcbInspectionLayout(ctx: CanvasRenderingContext2D, layout: PcbInspectionLayout) {
  ctx.setTransform(layout.scale, 0, 0, layout.scale, layout.offsetX, layout.offsetY);
}

export interface PcbInspectionProjection {
  project(point: HoloPoint): HoloProjectedPoint;
  target: HoloProjectedPoint;
  zoom: number;
  boardTop: number;
}

/** One camera is shared by the board, pads, bodies, defect marks, target and connector anchors. */
export function createPcbInspectionProjection(layout: PcbInspectionLayout,
  state: Pick<PcbInspectionState, 'selectedComponent'>, data: PcbInspectionData): PcbInspectionProjection {
  const centreX = layout.board.x + layout.board.width / 2;
  const centreY = layout.board.y + layout.board.height / 2;
  // Front-facing table-top view: +y is the near edge, -z rises above the board.
  // Negative pitch makes the lower edge nearer/larger; zero yaw keeps both edges level.
  const yaw = 0, pitch = -1.02, boardTop = -data.thickness / 2;
  const distance = Math.max(data.width, data.height, data.thickness) * 1.25;
  const unitProject = createHoloProjection({ x: 0, y: 0, yaw, pitch, scale: 1, distance });
  const projectedBounds = (points: readonly HoloPoint[]) => {
    const projected = points.map(unitProject);
    return { width: Math.max(...projected.map(point => point.x)) - Math.min(...projected.map(point => point.x)),
      height: Math.max(...projected.map(point => point.y)) - Math.min(...projected.map(point => point.y)) };
  };
  const boardBounds = projectedBounds([-1, 1].flatMap(x => [-1, 1].map(y => ({
    x: x * data.width / 2, y: y * data.height / 2, z: boardTop,
  }))));
  const baseScale = Math.min(layout.board.width * .9 / Math.max(1, boardBounds.width), layout.board.height * .88 / Math.max(1, boardBounds.height));
  const project = createHoloProjection({ x: centreX, y: centreY, yaw, pitch, scale: baseScale, distance });
  const selected = state.selectedComponent;
  const anchor: HoloPoint = selected ? { x: selected.x, y: selected.y, z: boardTop - selected.depth } : { x: 0, y: 0, z: boardTop };
  return { project, target: project(anchor), zoom: 1, boardTop };
}

const componentPoint = (project: PcbInspectionProjection['project'], component: PcbComponent, boardTop: number) =>
  project({ x: component.x, y: component.y, z: boardTop - component.depth });

export interface PcbInspectionFocus {
  component: PcbComponent;
  point: HoloProjectedPoint;
  size: { width: number; height: number };
}

/** The camera never moves. During each approach only the HUD focus glides from the prior defect. */
export function pcbInspectionFocus(layout: PcbInspectionLayout, state: PcbInspectionState,
  data: PcbInspectionData): PcbInspectionFocus | null {
  const component = state.selectedComponent;
  if (!component || state.phase !== 'inspect') return null;
  const projection = createPcbInspectionProjection(layout, state, data);
  const index = Math.max(0, state.failedComponents.findIndex(item => item.id === component.id));
  const duration = PCB_INSPECTION_TIMING.inspectEnd - PCB_INSPECTION_TIMING.scanEnd;
  const slot = (state.time - PCB_INSPECTION_TIMING.scanEnd) / duration * state.failedComponents.length;
  const progress = Math.max(0, Math.min(1, slot - Math.floor(slot)));
  const amount = index > 0 && progress < PCB_INSPECTION_TIMING.approachFraction
    ? smooth(progress / PCB_INSPECTION_TIMING.approachFraction) : 1;
  const current = componentPoint(projection.project, component, projection.boardTop);
  const previousComponent = state.failedComponents[Math.max(0, index - 1)];
  const previous = componentPoint(projection.project, previousComponent, projection.boardTop);
  const point = { x: previous.x + (current.x - previous.x) * amount, y: previous.y + (current.y - previous.y) * amount,
    depth: previous.depth + (current.depth - previous.depth) * amount, scale: previous.scale + (current.scale - previous.scale) * amount };
  const angle = component.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const local = (x: number, y: number) => projection.project({ x: component.x + x * cos - y * sin,
    y: component.y + x * sin + y * cos, z: projection.boardTop - component.depth });
  const left = local(-component.width / 2, 0), right = local(component.width / 2, 0);
  const top = local(0, -component.height / 2), bottom = local(0, component.height / 2);
  return { component, point, size: { width: Math.max(34, Math.hypot(right.x - left.x, right.y - left.y) * 1.8),
    height: Math.max(28, Math.hypot(bottom.x - top.x, bottom.y - top.y) * 2.1) } };
}
