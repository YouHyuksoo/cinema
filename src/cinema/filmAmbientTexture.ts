/** Cached environmental layers; no downloaded images or per-frame particle allocation. */
export type AmbientTextureStyle = 'underwater' | 'space';
const WIDTH = 1280, HEIGHT = 720;

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function layer(paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx);
  return canvas;
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, color); light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = light; ctx.fillRect(0, 0, 640, 360);
}

function waterLight() {
  return layer(ctx => {
    glow(ctx, 180, -30, 510, 'rgba(20,153,186,.35)');
    for (let i = 0; i < 7; i++) {
      const x = 35 + i * 91;
      const ray = ctx.createLinearGradient(x, 0, x + 90, 360);
      ray.addColorStop(0, 'rgba(125,240,235,.17)');
      ray.addColorStop(1, 'rgba(38,128,189,0)');
      ctx.fillStyle = ray; ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 12, 0);
      ctx.lineTo(x + 175, 360); ctx.lineTo(x + 100, 360); ctx.closePath(); ctx.fill();
    }
  });
}

function waterRipples() {
  return layer(ctx => {
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(141,244,241,.23)';
    for (let row = -1; row < 7; row++) for (let col = -1; col < 10; col++) {
      const x = col * 76 + (row % 2) * 36, y = row * 65;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = i / 24 * Math.PI * 2;
        const radius = 28 + 5 * Math.sin(a * 3 + row + col * 1.7);
        const px = x + Math.cos(a) * radius * 1.4, py = y + Math.sin(a) * radius * .72;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
  });
}

function starField(seed: number, count: number) {
  return layer(ctx => {
    const random = seeded(seed);
    for (let i = 0; i < count; i++) {
      const x = random() * 640, y = random() * 360;
      const size = .3 + random() * .65;
      ctx.globalAlpha = .25 + random() * .65;
      ctx.fillStyle = i % 7 === 0 ? '#b7d8ff' : '#eef5ff';
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
      if (i % 29 === 0) {
        ctx.globalAlpha *= .45;
        ctx.fillRect(x - 2.5, y - .2, 5, .4); ctx.fillRect(x - .2, y - 2.5, .4, 5);
      }
    }
  });
}

/** All drawing uses the existing 1280×720 texture coordinate system. */
export function createAmbientTextureRenderer() {
  let water: { light: HTMLCanvasElement; ripples: HTMLCanvasElement } | undefined;
  let space: { nebula: HTMLCanvasElement; far: HTMLCanvasElement; near: HTMLCanvasElement } | undefined;
  const random = seeded(8723);
  const bubbles = Array.from({ length: 16 }, () => ({ x: random() * WIDTH, y: random() * HEIGHT, r: 1 + random() * 2.2, speed: 5 + random() * 8 }));
  return (ctx: CanvasRenderingContext2D, style: AmbientTextureStyle, time: number, strength: number) => {
    const intensity = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0;
    if (!intensity) return;
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    if (style === 'underwater') {
      water ??= { light: waterLight(), ripples: waterRipples() };
      ctx.globalAlpha = intensity * .8;
      ctx.drawImage(water.light, -30 + Math.sin(t * .13) * 22, 0, WIDTH + 60, HEIGHT);
      ctx.globalAlpha = intensity * (.24 + Math.sin(t * .4) * .04);
      ctx.drawImage(water.ripples, -45 + Math.sin(t * .19) * 24, -30 + Math.cos(t * .16) * 18, WIDTH + 90, HEIGHT + 60);
      ctx.globalAlpha = intensity * .35; ctx.lineWidth = .8; ctx.strokeStyle = '#a1eaf2';
      for (const bubble of bubbles) {
        const y = ((bubble.y - t * bubble.speed) % (HEIGHT + 16) + HEIGHT + 16) % (HEIGHT + 16) - 8;
        ctx.beginPath(); ctx.arc(bubble.x + Math.sin(t * .25 + bubble.x) * 12, y, bubble.r, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      space ??= {
        nebula: layer(c => {
          glow(c, 70, 80, 300, 'rgba(58,93,184,.25)');
          glow(c, 580, 300, 250, 'rgba(115,59,157,.2)');
        }),
        far: starField(1931, 150), near: starField(7482, 55),
      };
      ctx.globalAlpha = intensity * .8;
      ctx.drawImage(space.nebula, -20 + Math.sin(t * .04) * 15, -12, WIDTH + 40, HEIGHT + 24);
      for (const [index, stars] of [space.far, space.near].entries()) {
        const x = (t * (index ? 3 : .8)) % WIDTH;
        const y = (t * (index ? .7 : .2)) % HEIGHT;
        ctx.globalAlpha = intensity * (index ? .55 + Math.sin(t * .5) * .06 : .45);
        for (const dx of [-WIDTH, 0]) for (const dy of [-HEIGHT, 0]) ctx.drawImage(stars, x + dx, y + dy, WIDTH, HEIGHT);
      }
    }
    ctx.restore();
  };
}
