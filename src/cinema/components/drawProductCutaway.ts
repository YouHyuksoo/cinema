import { signalColor } from '../filmDrawing';
import type { HoloPoint, HoloProjectedPoint } from '../holoSpace';
import { productCylinderPoint, productZoneAnchor, type ProductInspectionState } from '../productInspection';

type Project = (point: HoloPoint) => HoloProjectedPoint;
interface Facet { points: HoloProjectedPoint[]; fill: string; stroke: string; width: number; depth: number }

/** A cutaway solid built from cylinders, annular end faces and a displaced upper shell. */
export function drawProductCutaway(ctx: CanvasRenderingContext2D, project: Project,
  state: ProductInspectionState, selectedHeat: number) {
  const facets: Facet[] = [];
  const { explode, elapsed } = state;
  const facet = (vertices: HoloPoint[], heat: number, opacity: number, light: number, edge = .14) => {
    const points = vertices.map(project);
    facets.push({ points, depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length,
      fill: signalColor(heat, opacity * light), stroke: signalColor(heat, edge), width: .65 });
  };
  const cylinder = (from: number, to: number, outer: number, inner: number, heat: number, opacity: number,
    start = 0, end = Math.PI * 2, lift = 0, edges = .14) => {
    const radialSegments = outer < 30 ? 24 : 36;
    const count = Math.max(4, Math.ceil((end - start) / (Math.PI * 2) * radialSegments));
    const p = (x: number, radius: number, angle: number) => productCylinderPoint(x, radius, angle, lift);
    for (let step = 0; step < count; step++) {
      const a = start + (end - start) * step / count, b = start + (end - start) * (step + 1) / count;
      const light = .42 + .58 * (.5 + .5 * Math.cos(a + state.yaw + .8));
      facet([p(from, outer, a), p(to, outer, a), p(to, outer, b), p(from, outer, b)], heat, opacity, light, edges * .25);
      for (const x of [from, to]) {
        facet([p(x, inner, a), p(x, outer, a), p(x, outer, b), p(x, inner, b)], heat, opacity * 1.5, light, edges * .7);
      }
      if (inner > 0 && end - start < Math.PI * 1.99) {
        facet([p(from, inner, b), p(to, inner, b), p(to, inner, a), p(from, inner, a)], heat, opacity * .4, light, 0);
      }
    }
    // Broad, lit cut edges convey the wall thickness at the opening.
    if (end - start < Math.PI * 1.99) for (const angle of [start, end]) {
      facet([p(from, inner, angle), p(to, inner, angle), p(to, outer, angle), p(from, outer, angle)], heat, .42, 1, .6);
    }
  };

  // The solid shaft remains connected through the floating rotor and bearing assembly.
  cylinder(-242, 247, 15, 0, .08, .5, 0, Math.PI * 2, 0, .22);
  cylinder(205, 243, 20, 15, .02, .42);
  for (let index = 0; index < 6; index++) cylinder(213 + index * 5, 214 + index * 5, 21, 18, .1, .64);
  const coilX = -80 - explode * 10;
  cylinder(coilX - 47, coilX + 47, 43, 20, .24, .16);
  for (let index = 0; index < 13; index++) {
    const x = coilX - 45 + index * 7;
    cylinder(x, x + 3.8, 57, 42, .8, .42, 0, Math.PI * 2, 0, .36);
  }
  cylinder(-20, 57, 46, 18, .04, .24);
  for (let index = 0; index < 10; index++) {
    const a = index / 10 * Math.PI * 2 + elapsed * .18;
    cylinder(-15, 54, 48, 45, .12, .53, a, a + .22);
  }
  const bearingX = 115 + explode * 14;
  cylinder(bearingX - 13, bearingX + 13, 56, 39, .05, .54);
  cylinder(bearingX - 14, bearingX + 14, 25, 16, .2, .42);
  // Bearing balls are small overlapping rings seen through a translucent race.
  for (let index = 0; index < 10; index++) {
    const angle = index / 10 * Math.PI * 2 + elapsed * .045;
    const p = productCylinderPoint(bearingX, 32, angle);
    const center = project(p);
    facets.push({ points: Array.from({ length: 10 }, (_, vertex) => {
      const a = vertex / 10 * Math.PI * 2;
      return { ...center, x: center.x + Math.cos(a) * 6.5 * center.scale,
        y: center.y + Math.sin(a) * 6.5 * center.scale };
    }), fill: signalColor(.12, .64), stroke: signalColor(0, .58), width: .65, depth: center.depth });
  }
  // Rear lower shell stays around the internals; the upper section lifts out of the inspection path.
  cylinder(-169, 170, 99, 91, .04, .12 + (1 - explode) * .21, -.5, Math.PI * .74, 0, .14);
  cylinder(-169, 170, 99, 91, .05, .1 + (1 - explode) * .21, Math.PI * .74, Math.PI * 2 - .5,
    -explode * 106, .17);
  for (const side of [-1, 1]) {
    const x = side * (173 + explode * 49);
    cylinder(x - 7, x + 7, 100, 66, .03, .33);
    cylinder(x + side * 9, x + side * 13, 73, 59, .12, .44);
    for (let index = 0; index < 6; index++) {
      const a = index / 6 * Math.PI * 2;
      cylinder(x - 9, x + 9, 88, 83, .2, .6, a, a + .095);
    }
  }

  ctx.save(); ctx.globalAlpha = state.reveal;
  facets.sort((a, b) => b.depth - a.depth);
  for (const face of facets) {
    ctx.beginPath(); face.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath(); ctx.fillStyle = face.fill; ctx.fill();
    ctx.strokeStyle = face.stroke; ctx.lineWidth = face.width; ctx.stroke();
  }

  // The scan moves along the same product axis rather than across the entire screen.
  const scanX = -225 + ((elapsed * .115) % 1) * 450;
  ctx.beginPath();
  for (let step = 0; step <= 64; step++) {
    const p = project(productCylinderPoint(scanX, 107, step / 64 * Math.PI * 2));
    if (step) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  }
  ctx.lineWidth = 1.6; ctx.strokeStyle = signalColor(.04, .36); ctx.shadowColor = signalColor(.04, .75);
  ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;

  if (state.activeZone) {
    const anchor = project(productZoneAnchor(state.activeZone, explode));
    const pulse = .5 + Math.sin(elapsed * 3.7) * .5;
    const glow = ctx.createRadialGradient(anchor.x, anchor.y, 1, anchor.x, anchor.y, 39);
    glow.addColorStop(0, signalColor(selectedHeat, .28 + pulse * .15));
    glow.addColorStop(1, signalColor(selectedHeat, 0));
    ctx.fillStyle = glow; ctx.fillRect(anchor.x - 40, anchor.y - 40, 80, 80);
    for (let ring = 0; ring < 2; ring++) {
      ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 7 + ring * 8 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = signalColor(selectedHeat, (.85 - ring * .45) * state.focus); ctx.lineWidth = ring ? 1 : 2; ctx.stroke();
    }
  }
  ctx.restore();
}
