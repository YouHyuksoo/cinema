import { CAMERA_PORTRAIT, cameraPortraitCrop } from '../cameraPortrait';
import type { FilmCameraFrame } from '../filmCameraSession';

type PortraitCrop = NonNullable<ReturnType<typeof cameraPortraitCrop>>;
const BUFFER_WIDTH = 800;
const BUFFER_HEIGHT = Math.round(BUFFER_WIDTH * CAMERA_PORTRAIT.height / CAMERA_PORTRAIT.width);
const surfaces = new WeakMap<CanvasRenderingContext2D, {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; crop: PortraitCrop; updated: number;
}>();

/** Soft oval edges merge the live portrait into the optical field without a video rectangle. */
export function drawCameraPortrait(ctx: CanvasRenderingContext2D, camera: FilmCameraFrame, time: number) {
  const video = camera.video;
  if (camera.status !== 'on' || !video) {
    const previous = surfaces.get(ctx);
    if (previous) {
      previous.ctx.clearRect(0, 0, previous.canvas.width, previous.canvas.height);
      surfaces.delete(ctx);
    }
    return false;
  }
  if (video.readyState < 2) return false;
  const wanted = cameraPortraitCrop(video.videoWidth, video.videoHeight, camera.zoom, camera.face);
  if (!wanted) return false;
  const now = performance.now();
  let surface = surfaces.get(ctx);
  if (!surface) {
    const canvas = document.createElement('canvas'); canvas.width = BUFFER_WIDTH; canvas.height = BUFFER_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) return false;
    surface = { canvas, ctx: context, crop: wanted, updated: now }; surfaces.set(ctx, surface);
  }
  // The portrait follows wall time, independently of HUD speed and pause.
  const follow = 1 - Math.exp(-Math.min(100, now - surface.updated) / 130);
  for (const key of ['x', 'y', 'width', 'height'] as const) surface.crop[key] += (wanted[key] - surface.crop[key]) * follow;
  surface.updated = now;
  const crop = surface.crop;
  const target = surface.ctx;
  target.setTransform(1, 0, 0, 1, 0, 0); target.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
  target.save();
  if (camera.mirror) { target.translate(BUFFER_WIDTH, 0); target.scale(-1, 1); }
  target.filter = `blur(${camera.blur * .055}px) saturate(.42) contrast(1.14) brightness(.77)`;
  target.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
  target.restore();
  target.save(); target.translate(BUFFER_WIDTH / 2, BUFFER_HEIGHT / 2); target.scale(BUFFER_WIDTH / 2, BUFFER_HEIGHT / 2);
  target.globalCompositeOperation = 'destination-in';
  const mask = target.createRadialGradient(0, -.08, .12, 0, 0, 1);
  mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(.32, 'rgba(0,0,0,.97)');
  mask.addColorStop(.62, 'rgba(0,0,0,.69)'); mask.addColorStop(.84, 'rgba(0,0,0,.24)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  target.fillStyle = mask; target.fillRect(-1, -1, 2, 2); target.restore();
  ctx.save(); ctx.translate(CAMERA_PORTRAIT.x, CAMERA_PORTRAIT.y);
  const approach = 1 + Math.sin(time * .28) * .012;
  ctx.scale(approach, approach); ctx.globalAlpha = .94;
  ctx.drawImage(surface.canvas, -CAMERA_PORTRAIT.width / 2, -CAMERA_PORTRAIT.height / 2,
    CAMERA_PORTRAIT.width, CAMERA_PORTRAIT.height); ctx.restore();
  return true;
}
