import type { VoiceCoreState } from '../jarvisVoiceCore';
import { projectReactor, REACTOR_HALF, rotateReactorPoint } from '../voiceReactorGeometry';

/** Five broad molten tongues, confined to the existing iris by the caller's clip. */
export function reactorEyeHeat(state: VoiceCoreState) {
  const heat = Math.max(0, Math.min(1, state.irisHeat ?? 0));
  if (!heat || state.reduced) return [];
  const height = state.coreRadius * (1 - state.blink * .94);
  return Array.from({ length: 5 }, (_, i) => {
    const rise = (state.time * .65 + i * .217) % 1;
    const x = (-.72 + i * .36) * state.coreRadius;
    const y = (.85 - rise * 1.45) * height;
    const width = state.coreRadius * (.12 + Math.sin(rise * Math.PI) * .035);
    const sway = Math.sin(state.time * 4 + i * 1.9) * width * .65;
    const points = [[x - width, y + height * .6], [x - width * .7, y],
      [x + sway, y - height * .75], [x + width * .25 + sway, y - height * .2],
      [x + width, y + height * .2], [x + width * .8, y + height * .6]].map(([px, py]) =>
      rotateReactorPoint({ x: px, y: py, z: -REACTOR_HALF - 10 }, 0, state.gazeYaw));
    return { points, color: i % 2 ? '#ff8a32' : '#ffd066', alpha: heat * (.32 + Math.sin(rise * Math.PI) * .3) };
  });
}

export function drawReactorEyeHeat(ctx: CanvasRenderingContext2D, state: VoiceCoreState) {
  const tongues = reactorEyeHeat(state);
  if (!tongues.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const tongue of tongues) {
    ctx.beginPath();
    tongue.points.forEach((point, i) => {
      const p = projectReactor(point, state.pitch);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath(); ctx.fillStyle = tongue.color; ctx.globalAlpha = tongue.alpha; ctx.fill();
  }
  ctx.restore();
}
