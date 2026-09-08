import { signalColor, smooth } from '../filmDrawing';

export type RibbonPoint = readonly [number, number];
interface FlowRibbonOptions {
  pointAt: (progress: number) => RibbonPoint;
  time: number;
  opening: number;
  opacity: number;
  heat: number;
  focus: number;
  reveal: number;
}

function path(ctx: CanvasRenderingContext2D, points: readonly RibbonPoint[], close = false) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
}

/** A shared-time carrier with a lit upper edge, translucent face and recessed side. */
export function drawFlowRibbon(ctx: CanvasRenderingContext2D, options: FlowRibbonOptions) {
  const { pointAt, time, opening, opacity, heat, focus } = options;
  const reveal = Math.max(0, Math.min(1, options.reveal));
  if (opacity <= 0 || reveal <= 0) return;
  const breadth = (u: number) => (9 + opening * 11 + focus * 3)
    * smooth(0, .2, u) * (1 - smooth(.97, 1, u) * .7) + 1.5;
  const thickness = 4 + opening * 3 + focus * 4;
  const frameAt = (u: number) => {
    const point = pointAt(u);
    const before = pointAt(Math.max(0, u - .001));
    const after = pointAt(Math.min(1, u + .001));
    const dx = after[0] - before[0], dy = after[1] - before[1];
    const length = Math.hypot(dx, dy);
    const tangent: RibbonPoint = length > .000001 ? [dx / length, dy / length] : [1, 0];
    const normal: RibbonPoint = [-tangent[1], tangent[0]];
    const offset = (across: number, along = 0): RibbonPoint => [
      point[0] + normal[0] * across + tangent[0] * along,
      point[1] + normal[1] * across + tangent[1] * along,
    ];
    return { point, tangent, offset };
  };
  const gradient = (start: RibbonPoint, end: RibbonPoint) => {
    const coincident = Math.hypot(end[0] - start[0], end[1] - start[1]) < .000001;
    return ctx.createLinearGradient(start[0], start[1], end[0] + (coincident ? 1 : 0), end[1]);
  };
  const top: RibbonPoint[] = [], bottom: RibbonPoint[] = [], rear: RibbonPoint[] = [];
  for (let i = 0; i <= 112; i++) {
    const u = i / 112 * reveal;
    const frame = frameAt(u), lower = frame.offset(breadth(u));
    top.push(frame.point); bottom.push(lower);
    const depth = thickness * smooth(0, .2, u);
    rear.push([lower[0] + depth * .55, lower[1] + depth]);
  }
  ctx.save(); ctx.globalAlpha *= opacity; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.setLineDash([]);

  // The lower surface separates the carrier from its faint reference path.
  path(ctx, [...bottom, ...rear.toReversed()], true);
  ctx.fillStyle = signalColor(heat, .10 + focus * .05); ctx.fill();
  path(ctx, rear); ctx.strokeStyle = signalColor(heat, .29); ctx.lineWidth = 1.2; ctx.stroke();
  const face = gradient(top[0], top[top.length - 1]);
  face.addColorStop(0, signalColor(heat, .03));
  face.addColorStop(.25, signalColor(heat, .12));
  face.addColorStop(.56, signalColor(heat, .24 + focus * .07));
  face.addColorStop(1, signalColor(heat, .065));
  path(ctx, [...top, ...bottom.toReversed()], true);
  ctx.fillStyle = face; ctx.fill();

  // Fine internal ribs read as structure inside a broad surface, not extra floating lines.
  for (let index = 0; index < 38; index++) {
    const u = .2 + index * .02;
    if (u > reveal) break;
    const frame = frameAt(u), size = breadth(u);
    const major = index % 5 === 0;
    path(ctx, [frame.offset(3), frame.offset(size - 3, major ? 5 : 2)]);
    ctx.strokeStyle = signalColor(heat, major ? .42 : .15); ctx.lineWidth = major ? 1.3 : .8; ctx.stroke();
    if (major) {
      const depth = thickness * smooth(0, .2, u);
      const lower = frame.offset(size);
      path(ctx, [lower, [lower[0] + depth * .55, lower[1] + depth]]);
      ctx.strokeStyle = signalColor(heat, .32); ctx.stroke();
    }
  }

  path(ctx, top); ctx.strokeStyle = signalColor(heat, .10); ctx.lineWidth = 9;
  ctx.shadowColor = signalColor(heat, .3); ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.strokeStyle = signalColor(heat, .76 + focus * .12); ctx.lineWidth = 2.5 + focus * .7; ctx.stroke();
  path(ctx, bottom); ctx.strokeStyle = signalColor(heat, .48); ctx.lineWidth = 1.25; ctx.stroke();

  // A packet train follows the same branching curve and can be paused or scrubbed.
  ctx.save(); path(ctx, [...top, ...bottom.toReversed()], true); ctx.clip();
  for (let packet = 0; packet < 5; packet++) {
    const head = ((time * .145 - packet * .2) % 1 + 1) % 1;
    if (head > reveal || head < .05) continue;
    const tail = Math.max(0, head - .065);
    const tip = frameAt(head);
    const end = tip.offset(breadth(head) * .52);
    const beam = gradient(frameAt(tail).offset(breadth(tail) * .52), end);
    beam.addColorStop(0, signalColor(heat, 0)); beam.addColorStop(1, signalColor(heat, .85));
    const trail: RibbonPoint[] = [];
    for (let sample = 0; sample <= 12; sample++) {
      const u = tail + (head - tail) * sample / 12;
      trail.push(frameAt(u).offset(breadth(u) * .52));
    }
    path(ctx, trail); ctx.strokeStyle = beam; ctx.lineWidth = 5; ctx.stroke();
    ctx.save(); ctx.translate(end[0], end[1]); ctx.rotate(Math.atan2(tip.tangent[1], tip.tangent[0]));
    ctx.fillStyle = signalColor(heat, .95); ctx.fillRect(-3, -2, 6, 4); ctx.restore();
  }
  ctx.restore(); ctx.restore();
}
