import { VOICE_CORE_VIEW as view, type VoiceCoreState } from '../jarvisVoiceCore';
import { projectReactor, reactorDiscPoint, reactorRimGlyphs, rotateReactorPoint, REACTOR_HALF,
  type ReactorGlyph, type ReactorPoint, type VoiceTeslaSpark } from '../voiceReactorGeometry';

const TAU = Math.PI * 2;

function path(ctx: CanvasRenderingContext2D, points: ReactorPoint[], close = true, pitch = .27) {
  ctx.beginPath();
  points.forEach((p, i) => { const q = projectReactor(p, pitch); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
  if (close) ctx.closePath();
}

function polygon(ctx: CanvasRenderingContext2D, points: ReactorPoint[], fill: string | CanvasGradient, pitch = .27) {
  path(ctx, points, true, pitch); ctx.fillStyle = fill; ctx.fill();
}

function strokeGlyphs(ctx: CanvasRenderingContext2D, glyphs: ReactorGlyph[], pitch: number) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const pass of [{ color: '#02080d', width: 3.1, alpha: .8 }, { color: '#9af7ff', width: 1.45, alpha: .95 }]) {
    ctx.strokeStyle = pass.color; ctx.lineWidth = pass.width; ctx.globalAlpha = pass.alpha;
    for (const glyph of glyphs) {
      for (const stroke of glyph.strokes) {
        path(ctx, stroke, false, pitch); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function ringPoints(outer: number, inner: number, z: number, rotation: number, yaw: number, start = 0, end = TAU) {
  const steps = Math.max(5, Math.ceil((end - start) / TAU * 64));
  const arc = (r: number) => Array.from({ length: steps + 1 }, (_, i) =>
    reactorDiscPoint(start + (end - start) * i / steps, r, z, rotation, yaw));
  return [...arc(outer), ...arc(inner).reverse()];
}

export function drawArcReactor(ctx: CanvasRenderingContext2D, state: VoiceCoreState) {
  const pitch = state.pitch, yaw = state.gazeYaw;
  const disc = (angle: number, radius: number, depth: number) => reactorDiscPoint(angle, radius, depth, state.rotation, yaw);
  const ring = (outer: number, inner: number, depth: number, start = 0, end = TAU) =>
    ringPoints(outer, inner, depth, state.rotation, yaw, start, end);
  const fill = (points: ReactorPoint[], color: string | CanvasGradient) => polygon(ctx, points, color, pitch);
  const backZ = REACTOR_HALF, frontZ = -REACTOR_HALF;
  const back = Array.from({ length: 65 }, (_, i) => disc(i / 64 * TAU, 106, backZ));
  ctx.globalAlpha = 1; fill(back, '#09131e');
  // Opaque, shaded side wall: this is the visible thickness of the reactor.
  const sides = Array.from({ length: 48 }, (_, i) => {
    const a = i / 48 * TAU, b = (i + 1) / 48 * TAU;
    const points = [disc(a, 106, backZ), disc(b, 106, backZ),
      disc(b, 106, frontZ), disc(a, 106, frontZ)];
    return { points, angle: a, depth: points.reduce((sum, p) => sum + projectReactor(p, pitch).z, 0) / 4 };
  }).sort((a, b) => b.depth - a.depth);
  for (const side of sides) {
    const light = .5 + .5 * Math.cos(side.angle + state.rotation + 2.2);
    fill(side.points, `rgb(${Math.round(13 + light * 38)} ${Math.round(23 + light * 49)} ${Math.round(32 + light * 58)})`);
  }
  const glyphs = reactorRimGlyphs(state);
  strokeGlyphs(ctx, glyphs, pitch);
  const metal = ctx.createLinearGradient(view.x - 100, view.y - 115, view.x + 95, view.y + 115);
  metal.addColorStop(0, '#c3dde4'); metal.addColorStop(.18, '#536d7b');
  metal.addColorStop(.48, '#182933'); metal.addColorStop(.8, '#809ba4'); metal.addColorStop(1, '#243b48');
  // When the eye turns away, the solid rear cap hides the front face and emitter.
  if (Math.cos(yaw) * Math.cos(pitch) < 0) {
    fill(back, '#11222e');
    fill(ring(107, 92, backZ + 1), metal);
    fill(ring(74, 62, backZ + 2), '#3c5360');
    fill(ring(33, 0, backZ + 3), '#203c4d');
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + .52;
      fill([disc(a - .09, 90, backZ + 2), disc(a + .09, 90, backZ + 2),
        disc(a + .2, 35, backZ + 3), disc(a - .2, 35, backZ + 3)], metal);
    }
    return;
  }
  fill(ring(107, 97, backZ - 1), metal);
  fill(ring(107, 97, frontZ - 1), metal);
  fill(ring(97, 64, frontZ - 2), '#0b1722');
  fill(ring(67, 55, frontZ - 4), metal);
  const coil = ctx.createLinearGradient(view.x - 90, view.y - 70, view.x + 90, view.y + 90);
  coil.addColorStop(0, '#edffff'); coil.addColorStop(.24, state.highlight);
  coil.addColorStop(.6, '#3298b8'); coil.addColorStop(1, '#c2f9ff');
  // Eight broad coils instead of dozens of hairline rings.
  for (let i = 0; i < 8; i++) {
    const start = i * TAU / 8 + .055, end = (i + 1) * TAU / 8 - .055;
    ctx.globalAlpha = .64 + state.energy * .32;
    fill(ring(91, 73, frontZ - 3, start, end), coil);
    ctx.globalAlpha = .28; fill(ring(93, 71, frontZ - 3, start, end), state.highlight);
  }
  ctx.globalAlpha = 1;
  const cavity = Array.from({ length: 65 }, (_, i) => disc(i / 64 * TAU, 54, frontZ - 1));
  fill(cavity, '#081923');
  const core = projectReactor(rotateReactorPoint({ x: 0, y: 0, z: frontZ - 6 }, 0, yaw), pitch);
  const open = 1 - state.blink * .94;
  const iris = (angle: number, radius: number, height: number, depth: number) => rotateReactorPoint({
    x: Math.cos(angle) * radius, y: Math.sin(angle) * height, z: depth,
  }, 0, yaw);
  const emitter = Array.from({ length: 65 }, (_, i) => iris(i / 64 * TAU, state.coreRadius, state.coreRadius * open, frontZ - 9));
  const aura = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 102 * open);
  const eyeColor = state.irisColor ?? state.highlight;
  aura.addColorStop(0, eyeColor + '70'); aura.addColorStop(.45, eyeColor + '24'); aura.addColorStop(1, eyeColor + '00');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = state.glow * (1 - state.blink * .55);
  path(ctx, emitter, true, pitch); ctx.clip();
  ctx.fillStyle = aura; ctx.fillRect(core.x - 102, core.y - 102, 204, 204); ctx.restore();
  const plasma = ctx.createRadialGradient(core.x - 12, core.y - 14 * open, 2, core.x, core.y, state.coreRadius * (.35 + .77 * open));
  plasma.addColorStop(0, '#ffffff'); plasma.addColorStop(.3, state.irisColor ?? '#e5fcff');
  plasma.addColorStop(.68, eyeColor); plasma.addColorStop(1, state.irisColor ? '#561727' : '#186280');
  ctx.globalAlpha = state.phase === 'error' ? .4 : 1;
  fill(emitter, plasma);
  ctx.globalAlpha = 1;
  if (state.blink > .02) {
    const lid = (sign: number) => {
      const innerY = 52 * sign * Math.max(.04, open);
      const aInner = Math.asin(Math.max(-1, Math.min(1, innerY / 52)));
      const from = sign > 0 ? Math.PI - aInner : -Math.PI - aInner;
      return Array.from({ length: 33 }, (_, i) => iris(from + (aInner - from) * i / 32, 52, 52, frontZ - 8));
    };
    fill(lid(1), '#07141c');
    fill(lid(-1), '#07141c');
  }
  // Three substantial radial braces emphasize a manufactured, recessed core.
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + .52;
    fill([disc(a - .055, 97, frontZ - 7), disc(a + .055, 97, frontZ - 7),
      disc(a + .12, 52, frontZ - 10), disc(a - .12, 52, frontZ - 10)], metal);
  }
}

export function drawTeslaDischarge(ctx: CanvasRenderingContext2D, spark: VoiceTeslaSpark, pitch = .27) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  path(ctx, spark.points, false, pitch);
  ctx.strokeStyle = '#65bfff'; ctx.globalAlpha = spark.intensity * .1; ctx.lineWidth = 12; ctx.stroke();
  ctx.strokeStyle = '#72daff'; ctx.globalAlpha = spark.intensity * .35; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = '#f0fdff'; ctx.globalAlpha = spark.intensity; ctx.lineWidth = 1.9; ctx.stroke();
  path(ctx, spark.branch, false, pitch); ctx.lineWidth = .95; ctx.globalAlpha = spark.intensity * .6; ctx.stroke();
  const target = projectReactor(spark.points[spark.points.length - 1], pitch);
  const light = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, 19);
  light.addColorStop(0, '#eaffffb0'); light.addColorStop(.2, '#68dfff50'); light.addColorStop(1, '#68dfff00');
  ctx.fillStyle = light; ctx.globalAlpha = spark.intensity;
  ctx.fillRect(target.x - 19, target.y - 19, 38, 38); ctx.restore();
}

export function drawReactorShadow(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = .3; ctx.fillStyle = '#020509';
  ctx.beginPath(); ctx.ellipse(view.x + 12, view.y + 148, 116, 11, 0, 0, TAU); ctx.fill();
  const glow = ctx.createRadialGradient(view.x, view.y + 145, 0, view.x, view.y + 145, 110);
  glow.addColorStop(0, '#5bdcff25'); glow.addColorStop(1, '#5bdcff00');
  ctx.globalAlpha = .7; ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(view.x, view.y + 145, 110, 10, 0, 0, TAU); ctx.fill();
}
