import type { JarvisAudioFrame } from './jarvisAudio';

interface VoiceFieldInput { time: number; phase: JarvisAudioFrame['phase']; level: number; samples: Uint8Array; accent: string }

/** Transparent ribbons react to microphone input and Realtime audio output. */
export function drawJarvisVoiceField(ctx: CanvasRenderingContext2D, input: VoiceFieldInput) {
  const { time, phase, level, samples, accent } = input;
  const listening = phase === 'listening', speaking = phase === 'speaking';
  const amplitude = speaking ? 32 + level * 65 : listening ? 28 + level * 65 : 42;
  const project = (x: number, y: number, z: number) => {
    const pitch = .42 + Math.sin(time * .19) * .08;
    const ry = y * Math.cos(pitch) - z * Math.sin(pitch);
    const rz = y * Math.sin(pitch) + z * Math.cos(pitch);
    const scale = 800 / (800 + rz);
    return { x: 400 + x * scale, y: 142 + ry * scale };
  };
  ctx.save();
  const halo = ctx.createRadialGradient(400, 150, 0, 400, 150, 190);
  halo.addColorStop(0, '#7688ff1a'); halo.addColorStop(.55, '#347b9610'); halo.addColorStop(1, '#00000000');
  ctx.fillStyle = halo; ctx.fillRect(210, -40, 380, 380);
  ctx.strokeStyle = accent;
  for (let ring = 0; ring < 3; ring++) {
    ctx.globalAlpha = .12 - ring * .025; ctx.lineWidth = ring ? .65 : 1.2;
    ctx.beginPath(); ctx.ellipse(400, 220 + ring * 5, 224 + ring * 25, 25 + ring * 4, 0, .15 + ring, 5.7 + ring); ctx.stroke();
  }
  const ribbons = Array.from({ length: 13 }, (_, layer) => {
    const offset = layer - 6;
    return Array.from({ length: 141 }, (_, i) => {
      const u = i / 140, x = (u - .5) * 670;
      const envelope = Math.sin(u * Math.PI) ** 1.6;
      const raw = listening || speaking ? ((samples[Math.floor(u * (samples.length - 1))] ?? 128) - 128) / 128 : 0;
      const wave = Math.sin(u * Math.PI * 4.5 - time * (speaking ? 2.7 : .8) + offset * .22);
      const y = envelope * (wave * amplitude + raw * 50 + Math.sin(offset * .5 + time * .35) * 9);
      const z = offset * 14 * envelope + Math.cos(u * 7 - time * .6) * envelope * 30;
      return project(x, y, z);
    });
  });
  const sheen = ctx.createLinearGradient(80, 60, 720, 225);
  sheen.addColorStop(0, accent); sheen.addColorStop(.5, '#a298ff'); sheen.addColorStop(1, '#f1b48f');
  ctx.globalCompositeOperation = 'lighter';
  for (let layer = 0; layer < ribbons.length - 1; layer++) {
    const a = ribbons[layer], b = ribbons[layer + 1];
    ctx.beginPath(); a.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    [...b].reverse().forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath();
    ctx.globalAlpha = .035 + level * .035; ctx.fillStyle = sheen; ctx.fill();
  }
  for (const [layer, points] of ribbons.entries()) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.globalAlpha = layer === 0 || layer === 12 ? .85 : .3;
    ctx.strokeStyle = sheen; ctx.lineWidth = layer % 4 === 0 ? 1.5 : .65;
    ctx.shadowColor = layer < 6 ? accent : '#aa9aff'; ctx.shadowBlur = layer % 4 === 0 ? 9 : 0; ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // Sparse cross-sections make the ribbon's volume readable without a background coordinate grid.
  for (let i = 10; i < 140; i += 10) {
    const a = ribbons[0][i], b = ribbons[12][i];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.globalAlpha = .12; ctx.strokeStyle = accent; ctx.lineWidth = .6; ctx.stroke();
  }
  for (let dot = 0; dot < 24; dot++) {
    const u = ((dot / 24 + time * .035) % 1 + 1) % 1;
    const p = ribbons[dot % 13][Math.min(140, Math.floor(u * 140))];
    ctx.globalAlpha = Math.sin(u * Math.PI) * .8;
    ctx.fillStyle = dot % 3 ? accent : '#e8d8ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, dot % 4 === 0 ? 1.8 : .8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 56; i++) {
    const sample = Math.abs(((samples[Math.floor(i / 56 * samples.length)] ?? 128) - 128) / 128);
    const height = listening ? 2 + sample * 38 : speaking ? 2 + Math.abs(Math.sin(i * .42 + time * 5)) * 9 : 2;
    ctx.globalAlpha = .38; ctx.fillStyle = accent; ctx.fillRect(180 + i * 8, 267 - height, 2, height);
  }
  ctx.restore();
}
