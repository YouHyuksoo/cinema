import { ENERGY_LAYERS, energyRatio, energyLayerCenter, energyLayerPoint, energyCoreProjection,
  type EnergyCoreData, type EnergyCoreState } from '../energyCore';
import { signalColor } from '../filmDrawing';

const TAU = Math.PI * 2;

/** Three glass shells retain independent depth, rotation, telemetry fill and light. */
export function drawEnergyLayers(ctx: CanvasRenderingContext2D, time: number,
  data: EnergyCoreData, state: EnergyCoreState) {
  const project = energyCoreProjection(time, state);
  const ordered = ENERGY_LAYERS.map((layer, index) => ({ layer, index,
    center: project(energyLayerCenter(index, state)) })).sort((a, b) => b.center.depth - a.center.depth);
  ctx.save(); ctx.globalAlpha = state.opacity;
  const radiance = energyRatio(data.power) * energyRatio(data.efficiency);
  const glow = ctx.createRadialGradient(478, 365, 5, 478, 365, 276);
  glow.addColorStop(0, signalColor(.2, .04 + radiance * .12)); glow.addColorStop(.4, signalColor(0, .025));
  glow.addColorStop(1, signalColor(0, 0)); ctx.fillStyle = glow; ctx.fillRect(195, 82, 566, 566);

  for (const { layer, index, center } of ordered) {
    const selected = index === state.index;
    const presence = selected ? 1 : 1 - state.focus * .55;
    const ratio = energyRatio(data[layer.key]);
    const radius = layer.radius * center.scale * (.7 + .3 * state.assembly);
    const glass = ctx.createRadialGradient(center.x - radius * .34, center.y - radius * .4, 2,
      center.x, center.y, radius * 1.04);
    glass.addColorStop(0, signalColor(layer.heat, .018)); glass.addColorStop(.55, signalColor(layer.heat, .007));
    glass.addColorStop(.88, signalColor(layer.heat, .045 * presence)); glass.addColorStop(1, signalColor(layer.heat, 0));
    ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(center.x, center.y, radius * 1.04, 0, TAU); ctx.fill();

    // Meridian back halves remain visible through the shell at a lower intensity.
    for (let meridian = 0; meridian < 6; meridian++) {
      for (let half = 0; half < 2; half++) {
        ctx.beginPath();
        let depth = 0;
        for (let tick = 0; tick <= 36; tick++) {
          const latitude = -Math.PI / 2 + tick / 36 * Math.PI;
          const p = project(energyLayerPoint(index, state, time, latitude, meridian / 6 * Math.PI + half * Math.PI));
          depth += p.depth - center.depth;
          if (tick === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = signalColor(layer.heat, (depth > 0 ? .06 : .2) * presence);
        ctx.lineWidth = selected ? .95 : .7; ctx.stroke();
      }
    }
    for (const latitude of [-.52, 0, .52]) {
      ctx.beginPath();
      for (let tick = 0; tick <= 96; tick++) {
        const p = project(energyLayerPoint(index, state, time, latitude, tick / 96 * TAU));
        if (tick === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = signalColor(layer.heat, .14 * presence); ctx.lineWidth = .9; ctx.stroke();
    }
    // The equator is a transparent channel with a visible back edge and a data-sized charge.
    for (const zOffset of [5, 0]) {
      ctx.beginPath();
      const steps = Math.max(1, Math.ceil(120 * ratio * state.assembly));
      for (let tick = 0; tick <= steps; tick++) {
        const world = energyLayerPoint(index, state, time, 0, tick / steps * TAU * ratio * state.assembly);
        const p = project({ ...world, z: world.z + zOffset });
        if (tick === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = signalColor(layer.heat, (zOffset ? .2 : .86) * presence);
      ctx.lineWidth = zOffset ? 6 : selected ? 4 : 2.3;
      ctx.shadowColor = signalColor(layer.heat, .45); ctx.shadowBlur = zOffset ? 0 : 10; ctx.stroke(); ctx.shadowBlur = 0;
    }
    for (let tick = 0; tick < 40; tick++) {
      const point = energyLayerPoint(index, state, time, 0, tick / 40 * TAU);
      const a = project(point), c = energyLayerCenter(index, state);
      const b = project({ x: c.x + (point.x - c.x) * 1.035, y: c.y + (point.y - c.y) * 1.035, z: c.z + (point.z - c.z) * 1.035 });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = signalColor(layer.heat, .3 * presence); ctx.lineWidth = .8; ctx.stroke();
    }
  }
  const nucleus = project({ x: 0, y: 0, z: -35 });
  const light = ctx.createRadialGradient(nucleus.x, nucleus.y, 0, nucleus.x, nucleus.y, 46);
  light.addColorStop(0, signalColor(0, .72 * radiance)); light.addColorStop(.12, signalColor(0, .5 * radiance));
  light.addColorStop(.42, signalColor(0, .12 * radiance)); light.addColorStop(1, signalColor(0, 0));
  ctx.fillStyle = light; ctx.fillRect(nucleus.x - 46, nucleus.y - 46, 92, 92);
  for (let index = 0; index < 24; index++) {
    const phase = time * .45 + index * 2.39996;
    const p = project({ x: Math.cos(phase) * (18 + index), y: Math.sin(phase * .8) * 24,
      z: Math.sin(phase) * (18 + index) });
    ctx.fillStyle = signalColor(index % 3 ? 0 : .7, .2 + radiance * .6);
    ctx.beginPath(); ctx.arc(p.x, p.y, .8 + radiance, 0, TAU); ctx.fill();
  }
  ctx.restore();
  return project(energyLayerPoint(state.index, state, time, 0, .15));
}
