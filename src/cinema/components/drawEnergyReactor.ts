import { ENERGY_LAYERS, type EnergyCoreData, type EnergyCoreState } from '../energyCore';
import { coilIgnition, coilSegment, energyReactorProjection, reactorArcs, reactorCore, reactorLayerCenter, reactorLayerPoint, REACTOR_CENTER, REACTOR_COILS, REACTOR_SEGMENTS, ringCharge } from '../energyReactor';
import { signalColor } from '../filmDrawing';
import type { HoloPoint } from '../holoSpace';

const TAU = Math.PI * 2;
const FLOOR_Y = 205;

/**
 * Holographic arc reactor: a projector base on the floor casts a light cone; three metric rings
 * float as depth-shaded glass shells with meridian wireframes; coils ignite around the outer ring;
 * a plasma core breathes in the middle and discharges arcs; scanlines shimmer through everything.
 */
export function drawEnergyReactor(ctx: CanvasRenderingContext2D, time: number, data: EnergyCoreData, state: EnergyCoreState) {
  const project = energyReactorProjection(time, state);
  const core = reactorCore(data, state, time);
  const path = (points: readonly HoloPoint[]) => {
    ctx.beginPath();
    points.forEach((point, i) => { const p = project(point); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  };
  ctx.save(); ctx.globalAlpha = state.opacity;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // Projector base: concentric floor rings and a light cone rising to the core.
  const base = project({ x: 0, y: FLOOR_Y, z: 0 }), nucleus = project(reactorLayerCenter(2, state));
  for (const [radius, alpha] of [[230, .22], [175, .12], [120, .08]] as const) {
    path(Array.from({ length: 73 }, (_, tick) => ({ x: Math.cos(tick / 72 * TAU) * radius, y: FLOOR_Y, z: Math.sin(tick / 72 * TAU) * radius })));
    ctx.strokeStyle = signalColor(0, alpha * state.assembly); ctx.lineWidth = radius === 230 ? 1.2 : .7; ctx.stroke();
  }
  for (let spoke = 0; spoke < 16; spoke++) {
    const angle = spoke / 16 * TAU + time * .05;
    path([{ x: Math.cos(angle) * 120, y: FLOOR_Y, z: Math.sin(angle) * 120 }, { x: Math.cos(angle) * 230, y: FLOOR_Y, z: Math.sin(angle) * 230 }]);
    ctx.strokeStyle = signalColor(0, .07 * state.assembly); ctx.lineWidth = .6; ctx.stroke();
  }
  const cone = ctx.createLinearGradient(0, base.y, 0, nucleus.y);
  cone.addColorStop(0, signalColor(0, .16 * state.assembly)); cone.addColorStop(1, signalColor(0, 0));
  const left = project({ x: -150, y: FLOOR_Y, z: 0 }), right = project({ x: 150, y: FLOOR_Y, z: 0 });
  ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(nucleus.x - 8, nucleus.y); ctx.lineTo(nucleus.x + 8, nucleus.y); ctx.lineTo(right.x, right.y); ctx.closePath();
  ctx.fillStyle = cone; ctx.fill();
  const emitter = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, 60);
  emitter.addColorStop(0, signalColor(0, .55 * state.assembly)); emitter.addColorStop(1, signalColor(0, 0));
  ctx.fillStyle = emitter; ctx.fillRect(base.x - 60, base.y - 30, 120, 60);

  const glow = ctx.createRadialGradient(REACTOR_CENTER.x, REACTOR_CENTER.y, 6, REACTOR_CENTER.x, REACTOR_CENTER.y, 300);
  glow.addColorStop(0, signalColor(core.heat, .05 + core.intensity * .14));
  glow.addColorStop(.45, signalColor(core.heat, .02 + core.intensity * .03));
  glow.addColorStop(1, signalColor(core.heat, 0));
  ctx.fillStyle = glow; ctx.fillRect(REACTOR_CENTER.x - 300, REACTOR_CENTER.y - 300, 600, 600);

  // Coils sit outside the power ring and ignite clockwise during assembly.
  for (let index = 0; index < REACTOR_COILS; index++) {
    const ignition = coilIgnition(index, state);
    if (ignition <= 0) continue;
    const segment = coilSegment(index, state, time);
    const inner = project(segment.inner), outer = project(segment.outer), tip = project(segment.tip);
    const behind = outer.depth > 0 ? .55 : 1;
    const pulse = .55 + .45 * Math.sin(time * 4 + index * .9);
    ctx.beginPath(); ctx.moveTo(inner.x, inner.y); ctx.lineTo(outer.x, outer.y);
    ctx.strokeStyle = signalColor(.72, (.28 + .5 * ignition * pulse) * ignition * behind); ctx.lineWidth = 2.2 * outer.scale + 1; ctx.stroke();
    ctx.fillStyle = signalColor(.72, .9 * ignition * behind);
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 1.4 + ignition * 1.2 * tip.scale, 0, TAU); ctx.fill();
  }

  const ordered = ENERGY_LAYERS.map((layer, index) => ({ layer, index, center: project(reactorLayerCenter(index, state)) }))
    .sort((a, b) => b.center.depth - a.center.depth);
  for (const { index, center } of ordered) {
    const charge = ringCharge(index, data, state);
    const selected = index === state.index;
    const presence = selected ? 1 : 1 - state.focus * .55;
    // Glass shell: meridian wireframe (front halves brighter) gives each ring holographic volume.
    for (let meridian = 0; meridian < 4; meridian++) {
      for (let half = 0; half < 2; half++) {
        let depth = 0;
        const points: HoloPoint[] = [];
        for (let tick = 0; tick <= 24; tick++) {
          const latitude = -Math.PI / 2 + tick / 24 * Math.PI;
          const point = reactorLayerPoint(index, state, time, latitude, meridian / 4 * Math.PI + half * Math.PI);
          points.push(point); depth += project(point).depth - center.depth;
        }
        path(points);
        ctx.strokeStyle = signalColor(charge.heat, (depth > 0 ? .04 : .11) * presence * state.assembly);
        ctx.lineWidth = selected ? .9 : .6; ctx.stroke();
      }
    }
    // Track: a thin full circle so an empty ring still reads as a ring.
    path(Array.from({ length: 97 }, (_, tick) => reactorLayerPoint(index, state, time, 0, tick / 96 * TAU)));
    ctx.strokeStyle = signalColor(charge.heat, .16 * presence); ctx.lineWidth = .8; ctx.stroke();
    // Segments: lit ones carry the metric charge; the back half is dimmer, like light through glass.
    for (let segment = 0; segment < REACTOR_SEGMENTS; segment++) {
      const lit = segment < charge.lit;
      const start = segment / REACTOR_SEGMENTS * TAU + time * (index % 2 ? .12 : -.09), end = start + TAU / REACTOR_SEGMENTS * .72;
      const points = Array.from({ length: 4 }, (_, tick) => reactorLayerPoint(index, state, time, 0, start + (end - start) * tick / 3));
      const behind = project(points[1]).depth > center.depth ? .5 : 1;
      path(points);
      const glint = lit ? Math.max(0, 1 - Math.abs(segment / REACTOR_SEGMENTS - ((time * .21 + index * .3) % 1)) * 9) : 0;
      ctx.strokeStyle = signalColor(charge.heat, (lit ? .62 + glint * .38 : .1) * presence * behind);
      ctx.lineWidth = (lit ? (selected ? 5 : 3.6) : 1.6) * center.scale;
      ctx.shadowColor = signalColor(charge.heat, lit ? .6 * behind : 0); ctx.shadowBlur = lit ? 8 : 0;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let tick = 0; tick < 12; tick++) {
      const angle = tick / 12 * TAU, point = reactorLayerPoint(index, state, time, 0, angle), c = reactorLayerCenter(index, state);
      path([point, { x: c.x + (point.x - c.x) * .92, y: c.y + (point.y - c.y) * .92, z: c.z + (point.z - c.z) * .92 }]);
      ctx.strokeStyle = signalColor(charge.heat, .32 * presence); ctx.lineWidth = .8; ctx.stroke();
    }
  }

  // Discharges from the core to the power ring.
  for (const arc of reactorArcs(data, state, time)) {
    for (const [width, alpha, blur] of [[3.2, .16, 0], [1.1, .85, 9]] as const) {
      path(arc.points);
      ctx.strokeStyle = signalColor(core.heat, alpha * arc.flicker); ctx.lineWidth = width;
      ctx.shadowColor = signalColor(core.heat, .7); ctx.shadowBlur = blur; ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // Plasma core: light, disc, rotating iris and orbiting motes in depth.
  const radius = core.radius * nucleus.scale * core.breathing;
  const light = ctx.createRadialGradient(nucleus.x, nucleus.y, 0, nucleus.x, nucleus.y, radius * 2.6);
  light.addColorStop(0, signalColor(core.heat, .95 * core.intensity));
  light.addColorStop(.28, signalColor(core.heat, .55 * core.intensity));
  light.addColorStop(.6, signalColor(core.heat, .12 * core.intensity));
  light.addColorStop(1, signalColor(core.heat, 0));
  ctx.fillStyle = light; ctx.fillRect(nucleus.x - radius * 2.6, nucleus.y - radius * 2.6, radius * 5.2, radius * 5.2);
  ctx.beginPath(); ctx.arc(nucleus.x, nucleus.y, Math.max(1, radius * .42), 0, TAU);
  ctx.fillStyle = `rgba(236,250,255,${(.35 + core.intensity * .6).toFixed(3)})`; ctx.fill();
  for (let blade = 0; blade < 3; blade++) {
    const start = time * 1.7 + blade * TAU / 3, sweep = TAU / 3 * .62;
    ctx.beginPath(); ctx.arc(nucleus.x, nucleus.y, radius * .78, start, start + sweep);
    ctx.strokeStyle = signalColor(core.heat, (.25 + core.intensity * .6) * state.assembly); ctx.lineWidth = 2.2 * nucleus.scale; ctx.stroke();
  }
  const origin = reactorLayerCenter(2, state);
  for (let mote = 0; mote < 18; mote++) {
    const phase = time * .6 + mote * 2.39996, orbit = 24 + mote * 2.2;
    const p = project({ x: origin.x + Math.cos(phase) * orbit, y: origin.y + Math.sin(phase * .7) * 14, z: origin.z + Math.sin(phase) * orbit });
    ctx.fillStyle = signalColor(core.heat, (.25 + core.intensity * .6) * (p.depth > nucleus.depth ? .45 : 1) * state.assembly);
    ctx.beginPath(); ctx.arc(p.x, p.y, (.9 + core.intensity) * p.scale, 0, TAU); ctx.fill();
  }

  // Hologram scanlines drift upward across the reactor volume.
  ctx.save(); ctx.globalAlpha = state.opacity * .16 * state.assembly;
  ctx.beginPath(); ctx.arc(REACTOR_CENTER.x, REACTOR_CENTER.y + 10, 235, 0, TAU); ctx.clip();
  const offset = (time * 18) % 6;
  for (let y = REACTOR_CENTER.y - 235 - 6; y < REACTOR_CENTER.y + 250; y += 6) {
    ctx.fillStyle = signalColor(0, .5); ctx.fillRect(REACTOR_CENTER.x - 240, y - offset, 480, 1);
  }
  ctx.restore();
  ctx.restore();
  return project(reactorLayerPoint(state.index, state, time, 0, .35));
}
