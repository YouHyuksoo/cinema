import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';
import {
  CCTV_CAMERAS, CCTV_CONSOLE, CCTV_FILM_SECONDS, CCTV_PANEL_HEIGHT, CCTV_PANEL_WIDTH, cctvCentred, cctvGridCorners, cctvPanelPoses, cctvRail,
  cctvTimestamp, cctvTourAt, type CctvFrameInput, type CctvKind, type CctvPanelPose,
} from './cctvScene';
import { clamp, mix, pad2 } from './filmMath';

export { CCTV_FILM_SECONDS };

const W = CCTV_PANEL_WIDTH, H = CCTV_PANEL_HEIGHT;
const TAU = Math.PI * 2;
/** Deterministic noise so every frame at a given time draws the same feed (fingerprint tests rely on it). */
const noise = (seed: number, step: number) => { const v = Math.sin(seed * 12.9898 + step * 78.233) * 43758.5453; return v - Math.floor(v); };

/**
 * CCTV surveillance: nine synthetic camera feeds hang on a concave wall around the viewer. The patrol
 * turns the wall to centre each camera and pulls it forward for reading; in manual mode the heading and
 * selection come from the explorer while the feeds keep running on the live clock.
 */
export function drawCctvFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, fonts: FilmFonts = DEFAULT_FONTS,
  insets?: FilmViewportInsets, interaction: CctvFrameInput | null = null) {
  const view = beginFilmViewport(ctx, width, height, insets);
  ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  const tour = cctvTourAt(t);
  const manual = interaction !== null;
  const turn = manual ? interaction.turn : tour.turn;
  const live = manual ? interaction.live : t;
  const centred = cctvCentred(turn);
  const focusCamera = manual ? interaction.selected ?? centred.camera : tour.camera;
  const focusOf = (index: number) => index === focusCamera ? (manual ? centred.amount : tour.focus) : 0;
  const presence = manual ? 1 : tour.intro * tour.outro;
  const wall = manual ? 0 : tour.wall;

  drawRoom(ctx, view, turn, presence * (1 - wall));
  if (wall > 0) drawConsole(ctx, fonts, wall * presence, live);
  // Concave wall: far panels first. Folding: every panel flies to its grid cell; ones that were behind the viewer simply fade in there.
  const poses = cctvPanelPoses(turn, focusOf).filter(pose => pose.visible || wall > 0).sort((a, b) => b.depth - a.depth);
  for (const pose of poses) {
    const reveal = manual ? 1 : smooth(pose.index * .12, .8 + pose.index * .12, t) * tour.outro * (pose.visible ? 1 : smooth(.45, .8, wall));
    const grid = cctvGridCorners(pose.index);
    const corners = wall > 0 ? pose.corners.map((c, i) => ({ x: mix(pose.visible ? c.x : grid[i].x, grid[i].x, wall), y: mix(pose.visible ? c.y : grid[i].y, grid[i].y, wall) })) : pose.corners;
    drawPanel(ctx, fonts, pose, corners, live, reveal, wall);
  }
  drawHeader(ctx, fonts, manual, focusCamera, focusOf(focusCamera), presence, live, wall);
}

/** The console around the multi-view: top tabs, camera search sidebar, bottom timeline — HUD lines, no pictures. */
function drawConsole(ctx: CanvasRenderingContext2D, fonts: FilmFonts, alpha: number, live: number) {
  const { top, side, grid, bottom } = CCTV_CONSOLE;
  const line = (a: number) => signalColor(0, a * alpha);
  const frame = (x: number, y: number, w: number, h: number, cut = 10) => {
    ctx.beginPath(); ctx.moveTo(x + cut, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - cut); ctx.lineTo(x + w - cut, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + cut); ctx.closePath();
  };
  ctx.save();
  // Top bar with tabs.
  frame(side.x, top.y, grid.x + grid.width - side.x, top.height, 8); ctx.fillStyle = `rgba(6,12,18,${.7 * alpha})`; ctx.fill(); ctx.strokeStyle = line(.5); ctx.lineWidth = 1; ctx.stroke();
  ['MONITORING', 'EVENTS', 'BACKUPS', 'CAMERAS'].forEach((tab, i) => {
    const x = side.x + 16 + i * 118, active = i === 0;
    if (active) { ctx.fillStyle = line(.14); ctx.fillRect(x - 8, top.y + 6, 106, top.height - 12); }
    filmText(ctx, fonts, tab, x, top.y + 24, 10, (active ? .95 : .5) * alpha, true);
  });
  filmText(ctx, fonts, `G45 · LIVE · ${cctvTimestamp(live)}`, grid.x + grid.width - 16, top.y + 24, 10, .7 * alpha, true, 'right');
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = line(.6); ctx.strokeRect(grid.x + grid.width - 300 + i * 26, top.y + 12, 14, 14); }
  // Sidebar: camera search, list, keypad, signal bars.
  frame(side.x, side.y, side.width, side.height); ctx.fillStyle = `rgba(6,12,18,${.78 * alpha})`; ctx.fill(); ctx.strokeStyle = line(.55); ctx.stroke();
  filmText(ctx, fonts, 'CAMERA SEARCH', side.x + 16, side.y + 24, 10, .9 * alpha, true);
  ctx.strokeStyle = line(.6); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(side.x + side.width / 2, side.y + 70, 26, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(side.x + side.width / 2, side.y + 70, 18, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  const sweep = Math.PI * (1.1 + .8 * ((live * .4) % 1));
  ctx.beginPath(); ctx.moveTo(side.x + side.width / 2, side.y + 70); ctx.lineTo(side.x + side.width / 2 + Math.cos(sweep) * 26, side.y + 70 + Math.sin(sweep) * 26); ctx.strokeStyle = line(.9); ctx.stroke();
  filmText(ctx, fonts, 'FS', side.x + 22, side.y + 78, 8, .6 * alpha, true); filmText(ctx, fonts, 'DA', side.x + side.width - 22, side.y + 78, 8, .6 * alpha, true, 'right');
  const active = Math.floor(live / 2) % CCTV_CAMERAS.length;
  CCTV_CAMERAS.forEach((camera, i) => {
    const y = side.y + 96 + i * 26;
    if (i === active) { ctx.fillStyle = line(.14); ctx.fillRect(side.x + 10, y - 12, side.width - 20, 20); }
    ctx.strokeStyle = line(i === active ? .9 : .35); ctx.lineWidth = 1; ctx.strokeRect(side.x + 12, y - 10, 22, 16);
    filmText(ctx, fonts, pad2(i + 1), side.x + 23, y + 2, 8, .9 * alpha, true, 'center');
    filmText(ctx, fonts, camera.code, side.x + 42, y + 2, 8, (i === active ? .95 : .6) * alpha, true);
    ctx.fillStyle = (live % 1) < .55 ? `rgba(255,97,97,${alpha})` : `rgba(255,97,97,${.25 * alpha})`; ctx.fillRect(side.x + side.width - 40, y - 5, 4, 4);
    filmText(ctx, fonts, 'REC', side.x + side.width - 32, y + 2, 7, .6 * alpha, true);
  });
  // Keypad and level bars.
  const keyY = side.y + 344;
  for (let i = 0; i < 9; i++) {
    const x = side.x + 22 + (i % 3) * 30, y = keyY + Math.floor(i / 3) * 26;
    ctx.strokeStyle = line(i === active ? .9 : .4); ctx.strokeRect(x, y, 24, 20);
    filmText(ctx, fonts, String(i + 1), x + 12, y + 14, 8, .8 * alpha, true, 'center');
  }
  for (let i = 0; i < 8; i++) {
    const h = 6 + Math.abs(Math.sin(live * 1.3 + i * .9)) * 22;
    ctx.fillStyle = line(.7); ctx.fillRect(side.x + 126 + i * 9, keyY + 70 - h, 5, h);
  }
  filmText(ctx, fonts, 'LEVELS', side.x + 126, keyY + 82, 7, .5 * alpha, true);
  // Bottom timeline: controls, ruler, playhead, storage readout.
  frame(side.x, bottom.y, grid.x + grid.width - side.x, bottom.height, 8); ctx.fillStyle = `rgba(6,12,18,${.7 * alpha})`; ctx.fill(); ctx.strokeStyle = line(.5); ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.strokeStyle = line(.6); ctx.strokeRect(side.x + 14 + i * 24, bottom.y + 10, 16, 16); }
  const rulerX = side.x + 190, rulerW = grid.x + grid.width - 260 - rulerX;
  ctx.strokeStyle = line(.5); ctx.beginPath(); ctx.moveTo(rulerX, bottom.y + 26); ctx.lineTo(rulerX + rulerW, bottom.y + 26); ctx.stroke();
  for (let x = 0; x <= rulerW; x += 12) { const tall = (x / 12) % 5 === 0; ctx.fillStyle = line(tall ? .8 : .35); ctx.fillRect(rulerX + x, bottom.y + (tall ? 14 : 20), 1, tall ? 12 : 6); }
  const head = rulerX + rulerW * ((live % 60) / 60);
  ctx.fillStyle = line(1); ctx.beginPath(); ctx.moveTo(head - 5, bottom.y + 6); ctx.lineTo(head + 5, bottom.y + 6); ctx.lineTo(head, bottom.y + 14); ctx.closePath(); ctx.fill(); ctx.fillRect(head, bottom.y + 12, 1, 18);
  filmText(ctx, fonts, `REC 09/09 · STORAGE ${71 + Math.floor((live / 30) % 4)}% · ${cctvTimestamp(live).slice(11)}`, grid.x + grid.width - 16, bottom.y + 24, 9, .75 * alpha, true, 'right');
  ctx.restore();
}

function drawRoom(ctx: CanvasRenderingContext2D, view: { left: number; top: number; right: number; bottom: number }, turn: number, presence: number) {
  // Control-room ambience: a vanishing-point floor grid and a soft wall glow behind the panels.
  const glow = ctx.createRadialGradient(640, 360, 40, 640, 360, 760);
  glow.addColorStop(0, signalColor(0, .07 * presence)); glow.addColorStop(.6, signalColor(0, .025 * presence)); glow.addColorStop(1, 'rgba(4,11,16,0)');
  ctx.fillStyle = glow; fillFilmViewport(ctx, view);
  ctx.strokeStyle = signalColor(0, .07 * presence); ctx.lineWidth = .8;
  for (let i = -9; i <= 9; i++) {
    ctx.beginPath(); ctx.moveTo(640 + i * 24, 470); ctx.lineTo(640 + i * 210, view.bottom); ctx.stroke();
  }
  for (let k = 0; k < 7; k++) {
    const y = 470 + Math.pow(k / 6, 1.7) * (view.bottom - 470);
    ctx.beginPath(); ctx.moveTo(view.left, y); ctx.lineTo(view.right, y); ctx.stroke();
  }
  // The curved wall itself: two guide rails that follow the cylinder, so the concavity reads even between panels.
  for (const level of [-H * .68, H * .68]) {
    const rail = cctvRail(turn, level);
    ctx.beginPath();
    rail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = signalColor(0, .16 * presence); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    rail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y + Math.sign(level) * 9) : ctx.moveTo(p.x, p.y + Math.sign(level) * 9));
    ctx.strokeStyle = signalColor(0, .09 * presence); ctx.lineWidth = .8; ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, fonts: FilmFonts, manual: boolean, camera: number, focus: number, presence: number, live: number, wall = 0) {
  const cam = CCTV_CAMERAS[camera];
  const open = presence * (1 - wall);
  filmText(ctx, fonts, 'CCTV / 감시 · 9 CAMERAS', 72, 76, 12, .7 * open, true);
  filmText(ctx, fonts, manual ? '직접 감시 · 좌우로 밀어 카메라 이동 · 클릭으로 선택' : '자동 순찰 · 카메라 순차 확인', 72, 96, 11, .5 * open);
  if (wall > 0) filmText(ctx, fonts, '다중 화면 감시 · 9 CAM LIVE · 고정 모니터링', 640, 656, 10, .65 * presence * wall, true, 'center');
  const alpha = open * (.35 + focus * .65);
  filmText(ctx, fonts, `${cam.id} · ${cam.code} · ${cam.zone}`, 640, 618, 15, alpha, false, 'center');
  filmText(ctx, fonts, `${cam.note} · ${cctvTimestamp(live)}`, 640, 640, 10, alpha * .8, true, 'center');
  // Camera index ticks: which of the nine is centred.
  for (let i = 0; i < CCTV_CAMERAS.length; i++) {
    ctx.fillStyle = signalColor(0, (i === camera ? .85 : .25) * open);
    ctx.fillRect(576 + i * 16, 650, 10, i === camera ? 3 : 1.5);
  }
}

function drawPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, pose: CctvPanelPose, corners: { x: number; y: number }[], live: number, reveal: number, wall = 0) {
  if (reveal <= 0) return;
  const [c0, c1, , c3] = corners;
  const cam = CCTV_CAMERAS[pose.index];
  // On the concave wall the side feeds dim with angle; on the console every cell is equally lit.
  const dim = mix(clamp(.42 + .58 * pose.focus - Math.abs(pose.angle) * .35, .18, 1), .95, wall) * reveal;
  ctx.save();
  // Map the panel's local W×H frame onto its projected quad (the wall faces the viewer, so a parallelogram is enough).
  ctx.transform((c1.x - c0.x) / W, (c1.y - c0.y) / W, (c3.x - c0.x) / H, (c3.y - c0.y) / H, c0.x, c0.y);
  // Bezel and glass.
  ctx.fillStyle = `rgba(6,12,18,${.92 * reveal})`; ctx.fillRect(-8, -8, W + 16, H + 16);
  ctx.strokeStyle = signalColor(0, .22 + pose.focus * .5 + wall * .4); ctx.lineWidth = 1.2; ctx.strokeRect(-8, -8, W + 16, H + 16);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.globalAlpha = dim;
  const feed = ctx.createLinearGradient(0, 0, 0, H);
  feed.addColorStop(0, '#111c25'); feed.addColorStop(1, '#070d12');
  ctx.fillStyle = feed; ctx.fillRect(0, 0, W, H);
  const tracks = FEEDS[cam.kind](ctx, live, pose.index);
  // Console feeds go monochrome like a real multi-view: one saturation-blend fill drains the colour, then the HUD chrome and tracking draw in colour on top.
  if (wall > .02) {
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${(wall * .92).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawOverlay(ctx, fonts, pose, cam.id, cam.code, live, tracks);
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, fonts: FilmFonts, pose: CctvPanelPose, id: string, code: string, live: number, tracks: Track[]) {
  // Camera colour cast, scanlines, vignette, glitch band.
  ctx.fillStyle = 'rgba(70,90,105,.10)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath();
  for (let y = 0; y < H; y += 4) ctx.rect(0, y, W, 1);
  ctx.fill();
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  const glitchStep = Math.floor(live / 2.5);
  if (noise(pose.index + 11, glitchStep) < .18 && (live % 2.5) < .25) {
    const gy = noise(pose.index + 3, glitchStep) * (H - 20);
    ctx.fillStyle = 'rgba(190,230,240,.16)'; ctx.fillRect(0, gy, W, 6);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, gy + 6, W, 3);
  }
  // Object tracking, the way surveillance analytics draw it: a box with corner ticks, a class id and a confidence.
  tracks.forEach((track, k) => {
    const x = clamp(track.x - 4, 2, W - 10), y = clamp(track.y - 4, 2, H - 10);
    const w = Math.max(6, Math.min(track.w + 8, W - x - 2)), h = Math.max(6, Math.min(track.h + 8, H - y - 2));
    const color = track.label.startsWith('PERSON') ? '#8dffb2' : '#ffd15f';
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y - 1, 5, 1.5); ctx.fillRect(x - 1, y - 1, 1.5, 5); ctx.fillRect(x + w - 4, y + h - .5, 5, 1.5); ctx.fillRect(x + w - .5, y + h - 4, 1.5, 5);
    const ly = y > 30 ? y - 4 : y + h + 10;
    ctx.fillStyle = 'rgba(4,11,16,.75)'; ctx.fillRect(x, ly - 8, 66, 10);
    filmText(ctx, fonts, `${track.label} ${Math.round(70 + noise(k + pose.index * 7, Math.floor(live)) * 29)}%`, x + 2, ly, 7, .95, true, 'left', color);
  });
  // Reticle on the centred feed: crosshair, centre ring and a zoom/track readout.
  if (pose.focus > .4) {
    ctx.strokeStyle = signalColor(0, .35 * pose.focus); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2, 30); ctx.lineTo(W / 2, H - 30); ctx.moveTo(40, H / 2); ctx.lineTo(W - 40, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 22, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, TAU); ctx.stroke();
    filmText(ctx, fonts, `ZOOM ${(1 + pose.focus * .6).toFixed(1)}x · TRACK ${pad2(tracks.length)}`, W / 2, H - 24, 8, .8 * pose.focus, true, 'center');
  }
  // Corner brackets, camera id, REC, clock, signal bars.
  ctx.strokeStyle = signalColor(0, .75); ctx.lineWidth = 1.2;
  for (const [x, y, sx, sy] of [[6, 6, 1, 1], [W - 6, 6, -1, 1], [6, H - 6, 1, -1], [W - 6, H - 6, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(x, y + 12 * sy); ctx.lineTo(x, y); ctx.lineTo(x + 12 * sx, y); ctx.stroke();
  }
  filmText(ctx, fonts, `${id} · ${code}`, 14, 22, 11, .9, true);
  const rec = (live % 1) < .55;
  ctx.fillStyle = rec ? '#ff6161' : 'rgba(255,97,97,.25)';
  ctx.beginPath(); ctx.arc(W - 50, 17, 3.5, 0, TAU); ctx.fill();
  filmText(ctx, fonts, 'REC', W - 42, 21, 10, .9, true, 'left', '#ffb4b4');
  filmText(ctx, fonts, cctvTimestamp(live), 14, H - 12, 9, .85, true);
  const bars = 3 + Math.round(noise(pose.index, Math.floor(live * .7)) * 1.4);
  for (let b = 0; b < 4; b++) {
    ctx.fillStyle = signalColor(0, b < bars ? .9 : .2);
    ctx.fillRect(W - 40 + b * 7, H - 12 - b * 3, 4, 4 + b * 3);
  }
  filmText(ctx, fonts, `${pad2(pose.index + 1)}/09`, W - 78, H - 12, 9, .6, true);
}

// ---- Synthetic feeds (panel-local coordinates, 330×186): the factory campus seen from outdoor cameras — gate,
// parking, crossroad, office facade, night skyline, logistics yard, walkway, lobby, perimeter fence. Each returns the
// tracked objects for the detection overlay. Everything is procedural: no bitmap or video assets.
type Track = { x: number; y: number; w: number; h: number; label: string };
type Feed = (ctx: CanvasRenderingContext2D, live: number, seed: number) => Track[];
const FEEDS: Record<CctvKind, Feed> = {
  gate(ctx, live) {
    sky(ctx, .35); ground(ctx, 96, '#2a3238');
    road(ctx, live, 96, 165, 98, 232);
    // Fence and guard house.
    fence(ctx, 0, 100, 118, 8, 1); fence(ctx, 212, 100, 330, 8, 1);
    ctx.fillStyle = '#26323a'; ctx.fillRect(214, 66, 52, 36); ctx.fillStyle = '#3a4a54'; ctx.fillRect(210, 60, 60, 8);
    window_(ctx, 224, 74, 14, 10, .9); window_(ctx, 244, 74, 14, 10, noise(3, Math.floor(live / 7)) > .4 ? .8 : .2);
    sign(ctx, 118, 44, 'HATCHERY', 18);
    // Barrier arm cycles: down, lift while the car passes, down again.
    const cycle = (live % 11) / 11;
    const lift = smooth(.28, .4, cycle) * (1 - smooth(.72, .84, cycle));
    ctx.fillStyle = '#c8d3da'; ctx.fillRect(196, 84, 6, 18);
    ctx.save(); ctx.translate(199, 86); ctx.rotate(-lift * 1.35);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#e6ecef' : '#ff6a5b'; ctx.fillRect(-70 + i * 12, -2, 12, 4); }
    ctx.restore();
    // Approaching car: scale up along the road, pause at the barrier, then pass.
    const approach = smooth(0, .3, cycle), passed = smooth(.4, .72, cycle);
    const y = 178 - approach * 74 - passed * 28, s = 1.15 - approach * .55 - passed * .2;
    const tracks: Track[] = [];
    if (cycle < .9) { car(ctx, 165 - 22 * s, y - 18 * s, 44 * s, 18 * s, '#9fb4c0', true); tracks.push({ x: 165 - 22 * s, y: y - 18 * s, w: 44 * s, h: 18 * s, label: 'VEHICLE 14' }); }
    const guard = 236 + Math.sin(live * .6) * 3;
    person(ctx, guard, 100, .55, live * 2); tracks.push({ x: guard - 5, y: 84, w: 10, h: 18, label: 'PERSON 02' });
    lamp(ctx, 296, 40, 100);
    return tracks;
  },
  parking(ctx, live) {
    sky(ctx, .25); ground(ctx, 60, '#262e34');
    // Bays in two rows with perspective.
    ctx.strokeStyle = 'rgba(220,230,235,.35)'; ctx.lineWidth = 1;
    for (const row of [0, 1]) for (let i = 0; i <= 8; i++) {
      const x0 = 20 + i * 36 + row * 6, x1 = 12 + i * 38 + row * 6;
      ctx.beginPath(); ctx.moveTo(x0, 70 + row * 58); ctx.lineTo(x1, 96 + row * 66); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(W, 130); ctx.stroke();
    const tracks: Track[] = [];
    for (const row of [0, 1]) for (let i = 0; i < 8; i++) {
      if (noise(i * 3 + row, 1) < .3) continue;
      const shade = ['#8fa3ad', '#5c6d76', '#b9c6cd', '#3c4a52', '#a4463f'][Math.floor(noise(i + row * 9, 2) * 5)];
      car(ctx, 26 + i * 36 + row * 5, 74 + row * 60, 26 + row * 3, 16 + row * 3, shade, false);
    }
    const mx = ((live * 18) % (W + 60)) - 30;
    car(ctx, mx, 136, 40, 18, '#dfe6ea', true); tracks.push({ x: mx, y: 136, w: 40, h: 18, label: 'VEHICLE 07' });
    const px = W - ((live * 9) % (W + 30)) + 15;
    person(ctx, px, 128, .6, live * 2.4); tracks.push({ x: px - 5, y: 110, w: 10, h: 20, label: 'PERSON 05' });
    lamp(ctx, 40, 20, 70); lamp(ctx, 300, 20, 70);
    return tracks;
  },
  crossroad(ctx, live) {
    // Oblique view over an intersection: two roads, zebra crossings, a signal cycle and traffic obeying it.
    ctx.fillStyle = '#1b2228'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b3439'; ctx.fillRect(0, 62, W, 62); ctx.fillRect(132, 0, 66, H);
    ctx.fillStyle = 'rgba(230,236,240,.55)';
    for (let x = 6; x < W; x += 22) if (x < 120 || x > 210) ctx.fillRect(x, 92, 12, 2);
    for (let y = 6; y < H; y += 22) if (y < 50 || y > 136) ctx.fillRect(164, y, 2, 12);
    for (let i = 0; i < 7; i++) { ctx.fillRect(126 - 10, 66 + i * 8, 6, 5); ctx.fillRect(202, 66 + i * 8, 6, 5); ctx.fillRect(136 + i * 8, 54, 5, 6); ctx.fillRect(136 + i * 8, 126, 5, 6); }
    // Corner buildings.
    building(ctx, 0, 0, 122, 52, 4, 5, live, 1); building(ctx, 208, 0, 122, 52, 4, 5, live, 2);
    building(ctx, 0, 134, 122, 52, 4, 3, live, 3); building(ctx, 208, 134, 122, 52, 4, 3, live, 4);
    const phase = (live % 14) / 14, ew = phase < .45, walk = phase > .5 && phase < .9;
    signal(ctx, 122, 56, ew); signal(ctx, 204, 128, !ew);
    const tracks: Track[] = [];
    if (ew) { const x = ((live * 34) % (W + 80)) - 40; car(ctx, x, 70, 34, 15, '#c9d4da', true); tracks.push({ x, y: 70, w: 34, h: 15, label: 'VEHICLE 21' }); }
    else { const y = ((live * 30) % (H + 60)) - 30; car(ctx, 168, y, 16, 32, '#8fa3ad', false); tracks.push({ x: 168, y, w: 16, h: 32, label: 'VEHICLE 22' }); }
    if (walk) for (let k = 0; k < 3; k++) { const x = 126 + ((live * 12 + k * 26) % 84); person(ctx, x, 60, .45, live * 2.6 + k); tracks.push({ x: x - 4, y: 46, w: 8, h: 16, label: `PERSON 1${k}` }); }
    return tracks;
  },
  facade(ctx, live) {
    sky(ctx, .3);
    building(ctx, 22, 8, 286, 138, 9, 6, live, 7);
    ctx.fillStyle = '#3a4852'; ctx.fillRect(118, 118, 94, 10); ctx.fillStyle = 'rgba(120,200,230,.35)'; ctx.fillRect(126, 128, 78, 18);
    ctx.fillStyle = '#26323a'; ctx.fillRect(0, 146, W, H - 146); ctx.fillStyle = '#31404a'; ctx.fillRect(0, 146, W, 5);
    const tracks: Track[] = [];
    const walkers = [[live * 11, 1], [live * 8 + 140, -1]] as const;
    for (const [d, dir] of walkers) {
      const x = dir > 0 ? (d % (W + 40)) - 20 : W - ((d % (W + 40)) - 20);
      person(ctx, x, 168, .7, live * 2.2 + d); tracks.push({ x: x - 6, y: 146, w: 12, h: 24, label: dir > 0 ? 'PERSON 31' : 'PERSON 32' });
    }
    lamp(ctx, 30, 96, 60); lamp(ctx, 300, 96, 60);
    return tracks;
  },
  skyline(ctx, live) {
    // Night rooftop view: haze, a plane crossing, towers with lit windows and blinking beacons, the plant roof in front.
    const night = ctx.createLinearGradient(0, 0, 0, H); night.addColorStop(0, '#05080d'); night.addColorStop(1, '#141c26');
    ctx.fillStyle = night; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(200,220,235,.35)'; for (let i = 0; i < 24; i++) ctx.fillRect(noise(i, 5) * W, noise(i, 6) * 60, 1, 1);
    const px = ((live * 9) % (W + 40)) - 20; ctx.fillStyle = (live % .9) < .45 ? '#ffd7c8' : 'rgba(255,215,200,.25)'; ctx.fillRect(px, 22, 2, 2);
    const towers = [[0, 60, 40], [48, 40, 52], [108, 78, 30], [146, 30, 58], [212, 54, 44], [262, 46, 36], [304, 70, 26]];
    towers.forEach(([x, top, w], i) => building(ctx, x, top, w, 150 - top, Math.max(2, Math.round(w / 9)), Math.max(3, Math.round((150 - top) / 11)), live, 20 + i, true));
    for (const [x, y] of [[172, 28], [66, 38]]) { ctx.fillStyle = (live + x) % 1.6 < .3 ? '#ff5b5b' : 'rgba(255,91,91,.15)'; ctx.fillRect(x, y, 2, 2); }
    ctx.fillStyle = '#0a1116'; ctx.fillRect(0, 150, W, H - 150);
    ctx.fillStyle = '#1b262e'; for (let i = 0; i < 6; i++) ctx.fillRect(10 + i * 56, 142, 30, 10);
    ctx.fillStyle = '#b8e4f2'; ctx.fillRect(300, 138, 3, 12); ctx.fillStyle = (live % 2) < 1 ? '#ff5b5b' : 'rgba(255,91,91,.2)'; ctx.fillRect(300, 134, 3, 3);
    return [];
  },
  yard(ctx, live) {
    sky(ctx, .2); ground(ctx, 84, '#2a3238');
    // Container stacks, a gantry and a slow truck.
    const shades = ['#7a4a3a', '#3a5a72', '#6d7f3c', '#8a8a8a', '#a4463f'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
      if (noise(i * 2 + r, 4) < .25) continue;
      ctx.fillStyle = shades[Math.floor(noise(i + r * 5, 5) * shades.length)]; ctx.fillRect(14 + i * 62, 60 - r * 22, 54, 22);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; for (let s = 1; s < 5; s++) { ctx.beginPath(); ctx.moveTo(14 + i * 62 + s * 11, 60 - r * 22); ctx.lineTo(14 + i * 62 + s * 11, 82 - r * 22); ctx.stroke(); }
    }
    ctx.strokeStyle = '#8fa3ad'; ctx.lineWidth = 2; ctx.strokeRect(40, 14, 250, 4); ctx.beginPath(); ctx.moveTo(44, 18); ctx.lineTo(44, 84); ctx.moveTo(286, 18); ctx.lineTo(286, 84); ctx.stroke();
    const hx = 165 + Math.sin(live * .5) * 90; ctx.fillStyle = '#c8d3da'; ctx.fillRect(hx - 8, 18, 16, 6); ctx.fillRect(hx - 1, 24, 2, 20 + Math.abs(Math.sin(live * .5)) * 14);
    const tx = ((live * 12) % (W + 120)) - 90;
    truck(ctx, tx, 108); lamp(ctx, 310, 30, 90);
    return [{ x: tx, y: 96, w: 82, h: 30, label: 'VEHICLE 03' }];
  },
  walkway(ctx, live) {
    sky(ctx, .4);
    building(ctx, 0, 10, 96, 120, 3, 5, live, 12); building(ctx, 240, 22, 90, 108, 3, 4, live, 13);
    ctx.fillStyle = '#2b353c'; ctx.beginPath(); ctx.moveTo(60, H); ctx.lineTo(130, 96); ctx.lineTo(200, 96); ctx.lineTo(270, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(220,230,235,.2)'; ctx.lineWidth = 1; for (let i = 1; i < 6; i++) { const y = 96 + i * 18; const t = (y - 96) / 90; ctx.beginPath(); ctx.moveTo(130 - 70 * t, y); ctx.lineTo(200 + 70 * t, y); ctx.stroke(); }
    for (const [x, s] of [[104, .5], [226, .5], [86, .8], [246, .8]] as const) tree(ctx, x, 128 + s * 40, s);
    const tracks: Track[] = [];
    for (let k = 0; k < 3; k++) {
      const p = ((live * .05 + k * .37) % 1), toward = k % 2 === 0, tt = toward ? p : 1 - p;
      const y = 100 + tt * 82, s = .35 + tt * .55, x = 165 + (k - 1) * 22 * (1 + tt);
      person(ctx, x, y, s, live * 2.4 + k * 2); tracks.push({ x: x - 7 * s, y: y - 30 * s, w: 14 * s, h: 32 * s, label: `PERSON 4${k}` });
    }
    lamp(ctx, 120, 70, 60);
    return tracks;
  },
  lobby(ctx, live) {
    // Glass entrance: lit interior, revolving door, reception desk, people coming and going.
    ctx.fillStyle = '#1a232b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b3a45'; ctx.fillRect(30, 10, 270, 150);
    const glow = ctx.createLinearGradient(0, 20, 0, 160); glow.addColorStop(0, 'rgba(255,236,200,.55)'); glow.addColorStop(1, 'rgba(255,236,200,.12)');
    ctx.fillStyle = glow; ctx.fillRect(40, 20, 250, 136);
    ctx.strokeStyle = '#9fb4c0'; ctx.lineWidth = 2; for (let i = 0; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(40 + i * 50, 20); ctx.lineTo(40 + i * 50, 156); ctx.stroke(); }
    ctx.fillStyle = '#3a4852'; ctx.fillRect(96, 92, 138, 26); ctx.fillStyle = '#c8d3da'; ctx.fillRect(96, 90, 138, 3);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 6; i++) ctx.fillRect(60 + i * 40, 30, 8, 4);
    ctx.save(); ctx.translate(165, 60); ctx.rotate(live * 1.1); ctx.strokeStyle = 'rgba(200,220,230,.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,220,230,.5)'; ctx.beginPath(); ctx.ellipse(165, 60, 20, 8, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#26323a'; ctx.fillRect(0, 156, W, H - 156);
    const tracks: Track[] = [];
    const inP = (live * .08) % 1, outP = (live * .06 + .5) % 1;
    for (const [p, dir, id] of [[inP, 1, 'PERSON 51'], [outP, -1, 'PERSON 52']] as const) {
      const t = dir > 0 ? 1 - p : p, y = 70 + t * 100, s = .35 + t * .6, x = 165 + dir * 28 * (1 - t) + dir * 40 * t;
      person(ctx, x, y, s, live * 2.4 + p * 5); tracks.push({ x: x - 7 * s, y: y - 30 * s, w: 14 * s, h: 32 * s, label: id });
    }
    return tracks;
  },
  perimeter(ctx, live) {
    // Infrared night view along the fence: mono green, a sweeping patrol light and a figure that appears now and then.
    ctx.fillStyle = '#0a1a12'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#132a1c'; ctx.fillRect(0, 100, W, H - 100);
    ctx.strokeStyle = 'rgba(160,230,180,.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const t = i / 11, x = 20 + t * t * 300, top = 30 + t * 50; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, 100 + t * 60); ctx.stroke(); }
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(20, 36 + k * 16); ctx.lineTo(320, 86 + k * 20); ctx.stroke(); }
    ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(320, 80); ctx.stroke(); ctx.setLineDash([]);
    const sweep = 40 + ((live * 40) % 300);
    const cone = ctx.createLinearGradient(sweep - 40, 0, sweep + 40, 0); cone.addColorStop(0, 'rgba(180,255,200,0)'); cone.addColorStop(.5, 'rgba(180,255,200,.18)'); cone.addColorStop(1, 'rgba(180,255,200,0)');
    ctx.fillStyle = cone; ctx.fillRect(sweep - 40, 0, 80, H);
    ctx.fillStyle = 'rgba(200,255,220,.06)'; for (let i = 0; i < 40; i++) ctx.fillRect(noise(i, Math.floor(live * 8)) * W, noise(i + 40, Math.floor(live * 8)) * H, 1, 1);
    const tracks: Track[] = [];
    if ((live % 13) < 5) { const x = 250 - ((live % 13) * 22); ctx.save(); ctx.globalAlpha = .9; person(ctx, x, 150, .7, live * 2.4, '#d6ffe4'); ctx.restore(); tracks.push({ x: x - 6, y: 128, w: 12, h: 24, label: 'PERSON ??' }); }
    return tracks;
  },
};

// ---- Scenery helpers.
function sky(ctx: CanvasRenderingContext2D, light: number) {
  const g = ctx.createLinearGradient(0, 0, 0, 110);
  g.addColorStop(0, `rgba(${Math.round(40 + 60 * light)},${Math.round(56 + 70 * light)},${Math.round(70 + 80 * light)},1)`); g.addColorStop(1, '#1b2228');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 110);
}
function ground(ctx: CanvasRenderingContext2D, top: number, color: string) {
  ctx.fillStyle = color; ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let y = top + 8; y < H; y += 12) ctx.fillRect(0, y, W, 1);
}
function road(ctx: CanvasRenderingContext2D, live: number, topX: number, topW: number, topY: number, bottomW: number) {
  ctx.fillStyle = '#20282e'; ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(topX + topW, topY); ctx.lineTo(165 + bottomW / 2, H); ctx.lineTo(165 - bottomW / 2, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(230,236,240,.5)';
  const shift = (live * 30) % 24;
  for (let d = shift; d < H - topY; d += 24) { const t = d / (H - topY); ctx.fillRect(165 - 1 - t, topY + d, 2 + t * 2, 10 + t * 6); }
}
function fence(ctx: CanvasRenderingContext2D, x0: number, y: number, x1: number, height: number, dir: number) {
  ctx.strokeStyle = 'rgba(200,215,225,.5)'; ctx.lineWidth = 1;
  for (let x = x0; x <= x1; x += 14) { ctx.beginPath(); ctx.moveTo(x, y - height * 2); ctx.lineTo(x, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x0, y - height * 2); ctx.lineTo(x1, y - height * 2 - dir); ctx.moveTo(x0, y - height); ctx.lineTo(x1, y - height); ctx.stroke();
}
function window_(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: number) {
  ctx.fillStyle = `rgba(255,232,190,${.12 + lit * .7})`; ctx.fillRect(x, y, w, h);
}
function building(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cols: number, rows: number, live: number, seed: number, night = false) {
  ctx.fillStyle = night ? '#0f161d' : '#33414b'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = night ? '#141d25' : '#3d4d58'; ctx.fillRect(x, y, w, 4);
  const cw = (w - 8) / cols, ch = (h - 10) / rows, step = Math.floor(live / 6);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lit = noise(seed * 31 + r * cols + c, step) > (night ? .45 : .62) ? .9 : night ? .05 : .25;
    window_(ctx, x + 4 + c * cw + 1, y + 6 + r * ch + 1, Math.max(2, cw - 3), Math.max(2, ch - 3), lit);
  }
}
function person(ctx: CanvasRenderingContext2D, x: number, footY: number, s: number, phase: number, color = '#e3ebef') {
  const swing = Math.sin(phase) * 5 * s;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, 2.2 * s); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, footY - 14 * s); ctx.lineTo(x - swing, footY); ctx.moveTo(x, footY - 14 * s); ctx.lineTo(x + swing, footY); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, 4.5 * s); ctx.beginPath(); ctx.moveTo(x, footY - 14 * s); ctx.lineTo(x, footY - 26 * s); ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, footY - 29 * s, 3.2 * s, 0, TAU); ctx.fill();
}
function car(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, moving: boolean) {
  ctx.fillStyle = color; ctx.fillRect(x, y + h * .35, w, h * .65);
  ctx.fillStyle = 'rgba(30,40,48,.9)'; ctx.fillRect(x + w * .2, y, w * .58, h * .4);
  ctx.fillStyle = '#0c1115'; ctx.fillRect(x + w * .12, y + h * .85, w * .16, h * .3); ctx.fillRect(x + w * .72, y + h * .85, w * .16, h * .3);
  if (moving) { ctx.fillStyle = '#fff4c8'; ctx.fillRect(x + w - 3, y + h * .55, 3, 3); ctx.fillStyle = '#ff6a5b'; ctx.fillRect(x, y + h * .55, 3, 3); }
}
function truck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#5c6d76'; ctx.fillRect(x, y - 12, 58, 22); ctx.fillStyle = '#c9d4da'; ctx.fillRect(x + 58, y - 6, 24, 16);
  ctx.fillStyle = 'rgba(120,200,230,.5)'; ctx.fillRect(x + 66, y - 3, 12, 6);
  ctx.fillStyle = '#0c1115'; for (const wx of [6, 20, 44, 66]) ctx.fillRect(x + wx, y + 8, 8, 6);
}
function lamp(ctx: CanvasRenderingContext2D, x: number, top: number, height: number) {
  ctx.fillStyle = '#6f8290'; ctx.fillRect(x, top, 2, height);
  ctx.fillStyle = '#fff1c4'; ctx.fillRect(x - 4, top, 10, 3);
  const cone = ctx.createLinearGradient(0, top, 0, top + height); cone.addColorStop(0, 'rgba(255,241,196,.22)'); cone.addColorStop(1, 'rgba(255,241,196,0)');
  ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(x - 3, top + 3); ctx.lineTo(x + 5, top + 3); ctx.lineTo(x + 26, top + height); ctx.lineTo(x - 24, top + height); ctx.closePath(); ctx.fill();
}
function tree(ctx: CanvasRenderingContext2D, x: number, footY: number, s: number) {
  ctx.fillStyle = '#3a2f24'; ctx.fillRect(x - 2 * s, footY - 22 * s, 4 * s, 22 * s);
  ctx.fillStyle = '#26423a'; ctx.beginPath(); ctx.arc(x, footY - 30 * s, 14 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = '#31564a'; ctx.beginPath(); ctx.arc(x - 5 * s, footY - 34 * s, 9 * s, 0, TAU); ctx.fill();
}
function sign(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, width: number) {
  ctx.fillStyle = '#0f161d'; ctx.fillRect(x, y, width * 4.6, 14); ctx.strokeStyle = signalColor(0, .8); ctx.lineWidth = 1; ctx.strokeRect(x, y, width * 4.6, 14);
  filmText(ctx, DEFAULT_FONTS, text, x + width * 2.3, y + 10, 8, .9, true, 'center');
}
function signal(ctx: CanvasRenderingContext2D, x: number, y: number, green: boolean) {
  ctx.fillStyle = '#0c1115'; ctx.fillRect(x, y, 6, 14);
  ctx.fillStyle = green ? 'rgba(255,80,80,.2)' : '#ff5050'; ctx.fillRect(x + 1, y + 1, 4, 4);
  ctx.fillStyle = green ? '#5fffb4' : 'rgba(95,255,180,.2)'; ctx.fillRect(x + 1, y + 9, 4, 4);
}

/** Exposed for tests: the reveal curve of one panel during the intro. */
export const cctvPanelReveal = (index: number, time: number) => smooth(index * .12, .8 + index * .12, time);
