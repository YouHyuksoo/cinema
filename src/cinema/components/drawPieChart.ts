import { filmText, smooth, type FilmFonts } from '../filmDrawing';
import { getFilmContextTheme } from '../filmThemeCanvas';
import { applyFocusProjection, focusProjection, projectFocusPoint } from '../filmFocus';

const wallShades = new WeakMap<CanvasRenderingContext2D, { theme: string; gradient: CanvasGradient }>();
/** Unit-height glass wall shading, built once per context and palette (stops are theme-mapped at creation). */
function wallShade(ctx: CanvasRenderingContext2D) {
  const theme = getFilmContextTheme(ctx);
  const cached = wallShades.get(ctx);
  if (cached?.theme === theme) return cached.gradient;
  const gradient = ctx.createLinearGradient(0, 0, 0, 1);
  gradient.addColorStop(0, 'rgba(226,253,255,.26)');
  gradient.addColorStop(.16, 'rgba(169,230,241,.045)');
  gradient.addColorStop(.67, 'rgba(0,13,23,.23)');
  gradient.addColorStop(1, 'rgba(170,239,250,.14)');
  wallShades.set(ctx, { theme, gradient });
  return gradient;
}
import { normalizeChartPresentation, type ChartPresentation } from '../chartPresentation';
import {
  buildGlassPieSliceGeometry, projectGlassPiePoint,
  type GlassPieProjection, type ProjectedGlassPiePoint,
} from '../glassPieGeometry';

export interface PieDatum { label: string; value: number; color?: string }

export interface PieChartOptions {
  x: number;
  y: number;
  radius: number;
  time: number;
  data: readonly PieDatum[];
  activeIndex?: number;
  selection?: number;
  focus?: number;
  rotation?: number;
  opacity?: number;
  thickness?: number;
  tilt?: number;
  presentation?: ChartPresentation;
}

export interface PieSliceAnchor { x: number; y: number; percent: number }

const TAU = Math.PI * 2;
const COLORS = ['#6fe5f4', '#79b7a9', '#c4e7f0', '#ffc168'];
type SliceGeometry = NonNullable<ReturnType<typeof buildGlassPieSliceGeometry>>;
interface GlassSlice {
  geometry: SliceGeometry;
  fraction: number;
  color: string;
  selected: boolean;
  label: ProjectedGlassPiePoint;
  visible: number;
}

function path(ctx: CanvasRenderingContext2D, points: readonly ProjectedGlassPiePoint[], close = true) {
  ctx.beginPath();
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  if (close) ctx.closePath();
}

function averageDepth(points: readonly ProjectedGlassPiePoint[]) {
  return points.reduce((sum, point) => sum + point.depth, 0) / points.length;
}

function isClosedDisc(slice: GlassSlice, radius: number) {
  const points = slice.geometry.outerTop;
  const first = points[0], last = points[points.length - 1];
  return slice.fraction >= 1 - 1e-10 && points.length > 2
    && Math.hypot(first.x - last.x, first.y - last.y) < radius * 1e-7;
}

function drawFlatSupport(ctx: CanvasRenderingContext2D, radius: number, time: number, alpha: number) {
  ctx.save(); ctx.strokeStyle = '#71dcec'; ctx.lineWidth = .75;
  ctx.globalAlpha = alpha * .18;
  ctx.beginPath(); ctx.arc(0, 0, radius + 20, 0, TAU); ctx.stroke();
  ctx.globalAlpha = alpha * .3;
  ctx.beginPath(); ctx.arc(0, 0, radius + 28, time * .065, time * .065 + Math.PI * 1.22); ctx.stroke();
  ctx.restore();
}

/** The flat mode paints only the circular upper face; no walls, rims or reflections. */
function drawFlatSlice(ctx: CanvasRenderingContext2D, slice: GlassSlice, radius: number,
  alpha: number, selection: number) {
  const { geometry, color, selected } = slice;
  const opacity = alpha * (selected ? 1 : 1 - selection * .28);
  ctx.save(); ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  path(ctx, isClosedDisc(slice, radius) ? geometry.outerTop : geometry.top);
  ctx.fillStyle = color; ctx.globalAlpha = opacity * (selected ? .3 : .21); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = selected ? 1.8 : 1.1;
  ctx.globalAlpha = opacity * .86; ctx.stroke();
  path(ctx, geometry.outerTop, false);
  ctx.strokeStyle = '#dcfaff'; ctx.lineWidth = .7; ctx.globalAlpha = opacity * .48; ctx.stroke();
  ctx.restore();
}

function orbit(ctx: CanvasRenderingContext2D, projection: GlassPieProjection,
  radius: number, z: number, start = 0, end = TAU) {
  const points = Array.from({ length: 97 }, (_, index) => {
    const angle = start + (end - start) * index / 96;
    return projectGlassPiePoint({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z }, projection);
  });
  path(ctx, points, false);
}

/** A projected support plane makes the transparent solid's elevation legible. */
function drawSupport(ctx: CanvasRenderingContext2D, projection: GlassPieProjection,
  radius: number, thickness: number, time: number, alpha: number) {
  ctx.save();
  const floor = -thickness - 22;
  const origin = projectGlassPiePoint({ x: 0, y: 0, z: floor }, projection);
  ctx.translate(0, origin.y);
  ctx.scale(1, .33);
  const light = ctx.createRadialGradient(0, 0, radius * .06, 0, 0, radius * 1.45);
  light.addColorStop(0, 'rgba(72,212,234,.13)');
  light.addColorStop(.7, 'rgba(55,185,217,.035)');
  light.addColorStop(1, 'rgba(55,185,217,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = light;
  ctx.fillRect(-radius * 1.5, -radius * 1.5, radius * 3, radius * 3);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#71dcec';
  ctx.lineWidth = .75;
  ctx.globalAlpha = alpha * .16;
  orbit(ctx, projection, radius + 20, floor); ctx.stroke();
  ctx.globalAlpha = alpha * .28;
  orbit(ctx, projection, radius + 32, floor, time * .065, time * .065 + Math.PI * 1.22); ctx.stroke();
  ctx.globalAlpha = alpha * .12;
  orbit(ctx, projection, radius + 40, floor, -time * .048, -time * .048 + Math.PI * .72); ctx.stroke();
  for (let tick = 0; tick < 64; tick++) {
    const angle = tick / 64 * TAU - time * .024;
    const major = tick % 8 === 0;
    const a = projectGlassPiePoint({ x: Math.cos(angle) * (radius + 48), y: Math.sin(angle) * (radius + 48), z: floor }, projection);
    const b = projectGlassPiePoint({ x: Math.cos(angle) * (radius + (major ? 58 : 52)), y: Math.sin(angle) * (radius + (major ? 58 : 52)), z: floor }, projection);
    ctx.globalAlpha = alpha * (major ? .34 : .12);
    path(ctx, [a, b], false); ctx.stroke();
  }
  ctx.restore();
}

function drawGlassSlice(ctx: CanvasRenderingContext2D, slice: GlassSlice, radius: number,
  alpha: number, selection: number, time: number) {
  const { geometry, color, selected } = slice;
  const closedDisc = isClosedDisc(slice, radius);
  const strength = selected ? 1 : 1 - selection * .28;
  const opacity = alpha * strength;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowBlur = 0;

  // The lower face remains visible through the upper face, with a separate rim.
  path(ctx, closedDisc ? geometry.outerBottom : geometry.bottom);
  ctx.fillStyle = color; ctx.globalAlpha = opacity * .075; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = .8; ctx.globalAlpha = opacity * .3; ctx.stroke();

  // Depth once per wall, then paint back to front.
  const walls = geometry.walls.map(wall => ({ wall, depth: averageDepth(wall) })).sort((a, b) => b.depth - a.depth);
  const shade = wallShade(ctx);
  for (const { wall, depth } of walls) {
    path(ctx, wall);
    ctx.fillStyle = color;
    const facing = depth < geometry.depth;
    ctx.globalAlpha = opacity * (facing ? .19 : .065);
    ctx.fill();
    let topY = Infinity, bottomY = -Infinity;
    for (const point of wall) { if (point.y < topY) topY = point.y; if (point.y > bottomY) bottomY = point.y; }
    // The path is already in device space, so stretching the transform only maps the unit
    // gradient onto this wall's vertical span; one shared gradient replaces one per wall per frame.
    ctx.save();
    ctx.translate(0, topY); ctx.scale(1, bottomY + .1 - topY);
    ctx.fillStyle = shade;
    ctx.globalAlpha = opacity * (facing ? .56 : .2); ctx.fill();
    ctx.restore();
  }

  // Two faint traces follow the curved wall between the upper and lower rims.
  for (const amount of [.28, .72]) {
    const trace = geometry.outerTop.map((point, index) => ({
      x: point.x + (geometry.outerBottom[index].x - point.x) * amount,
      y: point.y + (geometry.outerBottom[index].y - point.y) * amount,
      depth: point.depth,
    }));
    path(ctx, trace, false);
    ctx.strokeStyle = color; ctx.lineWidth = .7; ctx.globalAlpha = opacity * .16; ctx.stroke();
  }
  for (let index = 0; index < geometry.outerTop.length; index += 4) {
    path(ctx, [geometry.outerTop[index], geometry.outerBottom[index]], false);
    ctx.strokeStyle = color; ctx.lineWidth = .65; ctx.globalAlpha = opacity * .11; ctx.stroke();
  }

  path(ctx, geometry.top);
  ctx.fillStyle = color; ctx.globalAlpha = opacity * (selected ? .15 : .105); ctx.fill();

  // Reflections belong to the object's upper face and stay inside its silhouette.
  ctx.save();
  path(ctx, geometry.top); ctx.clip();
  const reflection = ctx.createLinearGradient(-radius * .9, -radius, radius * .7, radius);
  reflection.addColorStop(0, 'rgba(236,253,255,.02)');
  reflection.addColorStop(.26, 'rgba(236,253,255,.23)');
  reflection.addColorStop(.35, 'rgba(236,253,255,.035)');
  reflection.addColorStop(.64, 'rgba(236,253,255,.015)');
  reflection.addColorStop(.78, 'rgba(236,253,255,.15)');
  reflection.addColorStop(1, 'rgba(236,253,255,0)');
  ctx.fillStyle = reflection; ctx.globalAlpha = opacity * .78;
  ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 4);

  // A moving narrow glint reveals the polished surface without obscuring values.
  const glintX = Math.sin(time * .24) * radius * 1.3;
  const glint = ctx.createLinearGradient(glintX - 34, -radius, glintX + 58, radius);
  glint.addColorStop(0, 'rgba(220,252,255,0)');
  glint.addColorStop(.47, 'rgba(220,252,255,.025)');
  glint.addColorStop(.5, 'rgba(232,255,255,.2)');
  glint.addColorStop(.53, 'rgba(220,252,255,.025)');
  glint.addColorStop(1, 'rgba(220,252,255,0)');
  ctx.fillStyle = glint; ctx.globalAlpha = opacity;
  ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 4);
  ctx.restore();

  // Bright upper edges and the dimmer lower rim expose the solid's thickness.
  path(ctx, closedDisc ? geometry.outerTop : geometry.top);
  ctx.strokeStyle = color; ctx.lineWidth = selected ? 1.65 : 1.15;
  ctx.globalAlpha = opacity * .78; ctx.stroke();
  path(ctx, geometry.outerTop, false);
  ctx.strokeStyle = '#ddfbff'; ctx.lineWidth = .75;
  ctx.globalAlpha = opacity * (selected ? .82 : .48); ctx.stroke();
  path(ctx, geometry.outerBottom, false);
  ctx.strokeStyle = color; ctx.lineWidth = selected ? 1.8 : 1;
  ctx.globalAlpha = opacity * .54; ctx.stroke();

  // Exposed cut edges are especially useful when the selected segment rises.
  for (const index of closedDisc ? [] : [0, geometry.outerTop.length - 1]) {
    path(ctx, [geometry.outerTop[index], geometry.outerBottom[index]], false);
    ctx.strokeStyle = color; ctx.lineWidth = .95; ctx.globalAlpha = opacity * .58; ctx.stroke();
  }
  ctx.restore();
}

/** Solid glass wedges use real angular proportions and a shared local clock. */
export function drawPieChart(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: PieChartOptions): Array<PieSliceAnchor | undefined> {
  const { x, y, radius, time, data, activeIndex } = options;
  const opacity = options.opacity ?? 1;
  if (![x, y, radius, time, opacity].every(Number.isFinite) || radius <= 0 || time < 0 || opacity <= 0) return [];
  const presentation = normalizeChartPresentation(options.presentation);
  const spatial = presentation.dimension === '3d';
  const baseThickness = Number.isFinite(options.thickness) ? Math.max(1, Math.min(radius, options.thickness!)) : radius * .29;
  const thickness = spatial ? Math.min(radius, baseThickness * presentation.depthScale) : 0;
  const tilt = Number.isFinite(options.tilt) ? Math.max(.3, Math.min(1.2, options.tilt!)) : .6;
  const projection = { tilt: spatial ? tilt + Math.sin(time * .19) * .022 : Math.PI / 2, distance: radius * 5.4 };
  const entries = data.map((datum, index) => ({ ...datum, index }))
    .filter(datum => Number.isFinite(datum.value) && datum.value > 0);
  const maximum = entries.reduce((largest, datum) => Math.max(largest, datum.value), 0);
  const total = entries.reduce((sum, datum) => sum + datum.value / maximum, 0);
  const hasSelection = entries.some(datum => datum.index === activeIndex);
  const selection = hasSelection ? Math.max(0, Math.min(1, Number.isFinite(options.selection) ? options.selection! : 1)) : 0;
  const alpha = ctx.globalAlpha * Math.min(1, opacity) * smooth(0, .65, time);
  const reveal = smooth(.2, 3.4, time);
  const rotation = Number.isFinite(options.rotation) ? options.rotation! : -Math.PI / 2 - .5 * (1 - smooth(0, 3.4, time));
  const anchors: Array<PieSliceAnchor | undefined> = Array.from({ length: data.length });
  const slices: GlassSlice[] = [];
  const lens = focusProjection({ x: 0, y: 0, focus: options.focus ?? 0, depth: 90, lift: 9 });

  ctx.save();
  ctx.translate(x, y);
  if (spatial) drawSupport(ctx, projection, radius, thickness, time, alpha * smooth(0, 1.1, time));
  else drawFlatSupport(ctx, radius, time, alpha * smooth(0, 1.1, time));
  if (!entries.length || total <= 0) {
    filmText(ctx, fonts, 'NO DATA', 0, 5, Math.min(18, radius * .15), alpha * .65, true, 'center');
    ctx.restore(); return [];
  }
  applyFocusProjection(ctx, lens);

  let fractionBefore = 0;
  entries.forEach((datum, index) => {
    const fraction = datum.value / maximum / total;
    const fractionAfter = index === entries.length - 1 ? 1 : fractionBefore + fraction;
    const middle = rotation + (fractionBefore + fraction / 2) * TAU;
    const selected = datum.index === activeIndex;
    const assembled = smooth(.4 + index * .16, 3.3 + index * .16, time);
    const separation = (1 - assembled) * radius * .12 + (selected ? radius * .17 * selection : 0);
    const offsetX = Math.cos(middle) * separation;
    const offsetY = Math.sin(middle) * separation + (spatial && selected ? radius * .16 * selection : 0);
    const lift = spatial ? thickness * .25 + (1 - assembled) * (60 + index * 12)
      + (selected ? thickness * 1.04 * selection : 0) + Math.sin(time * .75) * 2
      : (1 - assembled) * radius * .15 + (selected ? radius * .35 * selection : 0);
    const start = rotation + fractionBefore * TAU;
    const end = rotation + Math.min(fractionAfter, reveal) * TAU;
    const base = { radius, thickness, offsetX, offsetY, lift, projection };
    const anchor = projectGlassPiePoint({
      x: Math.cos(middle) * radius + offsetX, y: Math.sin(middle) * radius + offsetY, z: lift,
    }, projection);
    const focusedAnchor = projectFocusPoint(lens, anchor);
    // Original data indices remain stable when zero or invalid entries are omitted.
    anchors[datum.index] = { x: x + focusedAnchor.x, y: y + focusedAnchor.y, percent: fraction * 100 };
    if (end > start) {
      const geometry = buildGlassPieSliceGeometry({ ...base, start, end });
      if (geometry) {
        const labelRadius = radius * (fraction < .12 ? .76 : .63);
        slices.push({
          geometry, fraction, color: datum.color || COLORS[datum.index % COLORS.length], selected,
          visible: smooth(2.9 + index * .12, 4.2 + index * .12, time) * (reveal >= fractionAfter - .0001 ? 1 : 0),
          label: projectGlassPiePoint({
            x: Math.cos(middle) * labelRadius + offsetX, y: Math.sin(middle) * labelRadius + offsetY, z: lift + (spatial ? 3 : 0),
          }, projection),
        });
      }
    }
    fractionBefore = fractionAfter;
  });

  // Transparent pieces are painted back to front, with their labels in a final pass.
  slices.sort((a, b) => b.geometry.depth - a.geometry.depth);
  for (const slice of slices) {
    if (spatial) drawGlassSlice(ctx, slice, radius, alpha, selection, time);
    else drawFlatSlice(ctx, slice, radius, alpha, selection);
  }
  for (const slice of slices) {
    if (slice.fraction < .035 || slice.visible <= 0) continue;
    const labelAlpha = alpha * slice.visible * (slice.selected ? 1 : 1 - selection * .32);
    const size = Math.max(12, Math.min(24, radius * .1));
    ctx.save();
    ctx.shadowColor = '#031018'; ctx.shadowBlur = 7;
    filmText(ctx, fonts, (slice.fraction * 100).toFixed(1) + '%', slice.label.x, slice.label.y + size * .3,
      size, labelAlpha, true, 'center', slice.selected ? '#ffdda3' : '#d7f3f7');
    ctx.restore();
  }
  ctx.restore();
  return anchors;
}
