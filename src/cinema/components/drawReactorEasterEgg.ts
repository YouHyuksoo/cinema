import { REACTOR_EGG_TARGET, reactorLaserOrigin, type ReactorEasterEggFrame } from '../reactorEasterEgg';
import type { VoiceCoreState } from '../jarvisVoiceCore';
import { projectReactor, type ReactorPoint } from '../voiceReactorGeometry';

const TAU = Math.PI * 2;
const hash = (n: number) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

function outline(ctx: CanvasRenderingContext2D, points: ReactorPoint[]) {
  ctx.beginPath();
  points.forEach((p, i) => { const q = projectReactor(p, 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
}

/** Small shaded arrowhead fighter, two wings, glass cockpit and an engine plume. */
export function drawReactorShip(ctx: CanvasRenderingContext2D, egg: ReactorEasterEggFrame) {
  if (!egg.shipVisible) return;
  const c = Math.cos(egg.heading), s = Math.sin(egg.heading);
  const point = (x: number, y: number, z = 0): ReactorPoint => {
    const bankY = y * Math.cos(egg.bank), bankZ = y * Math.sin(egg.bank) + z;
    return { x: egg.position.x + x * c - bankY * s, y: egg.position.y + x * s + bankY * c, z: egg.position.z + bankZ };
  };
  ctx.save();
  const plume = egg.perched ? 0 : egg.reduced ? 7 : 11 + Math.sin(egg.time * 28) * 3 + (egg.behind ? 11 : 0);
  for (const y of [-5, 5]) {
    if (egg.perched) continue;
    outline(ctx, [point(-11, y - 2), point(-13 - plume, y), point(-11, y + 2)]);
    ctx.closePath(); ctx.globalAlpha = .7; ctx.fillStyle = '#ffad5a'; ctx.fill();
    outline(ctx, [point(-10, y - 1), point(-18, y), point(-10, y + 1)]);
    ctx.closePath(); ctx.fillStyle = '#fff3c4'; ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (egg.perched) {
    for (const x of [-7, 7]) {
      outline(ctx, [point(x - 1, 6, 2), point(x + 2, 6, 2), point(x + 3, 15, 2), point(x - 2, 15, 2)]);
      ctx.closePath(); ctx.fillStyle = '#a2acb5'; ctx.fill();
    }
  }
  const facets = [
    { vertices: [point(5, 0), point(-13, -15, 1), point(-10, -3, -2)], color: '#5d788d' },
    { vertices: [point(5, 0), point(-13, 15, 1), point(-10, 3, -2)], color: '#e4edf5' },
    { vertices: [point(18, 0, -1), point(-10, -5), point(-10, 5), point(-2, 0, -5)], color: '#a5c4d6' },
    { vertices: [point(18, 0, -1), point(-2, 0, -5), point(-10, 5)], color: '#45667e' },
    { vertices: [point(8, 0, -3), point(1, -3, -4), point(-3, 0, -5), point(1, 3, -4)], color: '#8af2ff' },
  ];
  for (const face of facets) { outline(ctx, face.vertices); ctx.closePath(); ctx.fillStyle = face.color; ctx.fill(); }
  const tip = projectReactor(point(-12, -14, -1), 0);
  ctx.fillStyle = '#ff79c6'; ctx.beginPath(); ctx.arc(tip.x, tip.y, egg.behind ? .65 : 1.1, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Draw behind the opaque reactor so the beam emerges from its turned-away emitter. */
export function drawReactorLaser(ctx: CanvasRenderingContext2D, state: VoiceCoreState, egg: ReactorEasterEggFrame) {
  if (!egg.firing || !egg.laserAlpha) return;
  const source = reactorLaserOrigin(state);
  const end = { x: source.x + (REACTOR_EGG_TARGET.x - source.x) * egg.laserReach,
    y: source.y + (REACTOR_EGG_TARGET.y - source.y) * egg.laserReach,
    z: source.z + (REACTOR_EGG_TARGET.z - source.z) * egg.laserReach };
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  outline(ctx, [source, end]);
  for (const pass of [{ color: '#439fff', width: 12, alpha: .12 }, { color: '#55dfff', width: 4, alpha: .7 }, { color: '#f4ffff', width: 1.6, alpha: 1 }]) {
    ctx.strokeStyle = pass.color; ctx.lineWidth = pass.width; ctx.globalAlpha = pass.alpha * egg.laserAlpha; ctx.stroke();
  }
  ctx.restore();
}

export function drawReactorImpact(ctx: CanvasRenderingContext2D, egg: ReactorEasterEggFrame) {
  if (egg.impactAge === null) return;
  const age = egg.impactAge, p = projectReactor(REACTOR_EGG_TARGET, 0), fade = Math.max(0, 1 - age / 1.18);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const radius = 4 + Math.sqrt(age) * 24;
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
  glow.addColorStop(0, '#fff5d8'); glow.addColorStop(.2, '#ffd489'); glow.addColorStop(.5, '#ff79464a'); glow.addColorStop(1, '#ff794600');
  ctx.fillStyle = glow; ctx.globalAlpha = fade * .85; ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, radius * 1.15, radius * .4, -.25, 0, TAU);
  ctx.strokeStyle = '#ffbc77'; ctx.lineWidth = 1.2; ctx.globalAlpha = fade * .55; ctx.stroke();
  for (let i = 0; i < 19; i++) {
    const a = i * 2.39996, distance = (12 + hash(i + 1) * 17) * Math.sqrt(age);
    const x = p.x + Math.cos(a) * distance, y = p.y + Math.sin(a) * distance * .7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * (2 + fade * 3), y - Math.sin(a) * 2);
    ctx.strokeStyle = i % 4 ? '#ffc978' : '#dbf8ff'; ctx.lineWidth = i % 3 ? 1.1 : 1.8;
    ctx.globalAlpha = fade * (.45 + hash(i + 8) * .4); ctx.stroke();
  }
  ctx.restore();
}
