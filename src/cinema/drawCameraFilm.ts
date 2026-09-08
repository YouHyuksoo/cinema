import { CORNER_CARD_SIZE, CORNER_ITEMS } from './cornerSequence';
import { cornerReadingProjection } from './cornerProjection';
import { drawCornerField } from './components/drawCornerField';
import { drawCornerReadout, cornerReadoutEdge } from './components/drawCornerReadout';
import { drawProjectedFilmSurface } from './components/drawProjectedFilmSurface';
import { drawCameraPortrait } from './components/drawCameraPortrait';
import { drawPortraitOverlay } from './components/drawPortraitOverlay';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import type { FilmCameraFrame } from './filmCameraSession';

const TAU = Math.PI * 2;

function portraitGuide(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.strokeStyle = signalColor(0, .16); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(640, 303, 77, 103, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(607, 396); ctx.lineTo(603, 428);
  ctx.bezierCurveTo(535, 444, 510, 465, 510, 504);
  ctx.moveTo(674, 396); ctx.lineTo(677, 428); ctx.bezierCurveTo(745, 444, 770, 465, 770, 504); ctx.stroke();
  ctx.restore();
}

/** The portrait and translucent telemetry share one optical field. */
export function drawCameraFilm(ctx: CanvasRenderingContext2D, width: number, height: number,
  time: number, fonts: FilmFonts, camera: FilmCameraFrame, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  drawCornerField(ctx, view, time, .7);
  const glow = ctx.createRadialGradient(640, 350, 120, 640, 350, 410);
  glow.addColorStop(0, signalColor(0, .065)); glow.addColorStop(1, signalColor(0, 0));
  ctx.fillStyle = glow; ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);

  // Rotating rails sit on a tilted plane around the portrait, with an open viewing area.
  ctx.save(); ctx.translate(640, 350); ctx.scale(.96, 1.18);
  for (let layer = 0; layer < 3; layer++) {
    const phase = time * (layer % 2 ? -.07 : .09) + layer * 1.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 215 + layer * 12, 207 + layer * 8, 0, phase, phase + 1.25);
    ctx.strokeStyle = signalColor(0, .07 + layer * .025); ctx.lineWidth = layer === 1 ? 2 : .7; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 215 + layer * 12, 207 + layer * 8, 0, phase + Math.PI, phase + Math.PI + .78); ctx.stroke();
  }
  ctx.restore();

  const live = drawCameraPortrait(ctx, camera, time);
  if (!live) portraitGuide(ctx);

  for (let index = 0; index < CORNER_ITEMS.length; index++) {
    const item = CORNER_ITEMS[index];
    const right = item.corner.x > 640, lower = item.corner.y > 350;
    const reveal = smooth(.3 + index * .3, 1.7 + index * .3, time);
    const reading = {
      item, index, x: right ? 946 : 334, y: lower ? 496 : 292, scale: .8,
      opacity: reveal * .72, reveal, parkProgress: 1, localTime: time + 6.5,
    };
    const projection = cornerReadingProjection(reading);
    const localAnchor = cornerReadoutEdge('reading', right ? -1 : 1);
    const anchor = projection.point(localAnchor.x, localAnchor.y);
    const attachment = { x: 640 + (right ? 205 : -205), y: lower ? 455 : 220 };
    ctx.save(); ctx.globalAlpha = reveal;
    ctx.beginPath(); ctx.moveTo(attachment.x, attachment.y);
    ctx.bezierCurveTo(attachment.x + (right ? 28 : -28), attachment.y,
      anchor.x + (right ? -35 : 35), anchor.y, anchor.x, anchor.y);
    ctx.strokeStyle = signalColor(0, .16); ctx.lineWidth = .8; ctx.stroke();
    ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 2, 0, TAU); ctx.fillStyle = signalColor(0, .75); ctx.fill();
    ctx.restore();
    drawProjectedFilmSurface(ctx, {
      ...CORNER_CARD_SIZE, project: projection.point,
      draw: surface => drawCornerReadout(surface, fonts, {
        item, time: time + 2, reveal, opacity: reading.opacity, parkProgress: 1,
      }),
    });
  }

  drawPortraitOverlay(ctx, fonts, time);
  const state = camera.status === 'on' ? camera.tracking === 'tracking' ? 'FACE LOCK / LIVE'
    : camera.tracking === 'error' ? 'TRACKING UNAVAILABLE' : 'ACQUIRING FACE'
    : camera.status === 'requesting' ? 'CONNECTING' : camera.status === 'error' ? 'CAMERA UNAVAILABLE' : 'CAMERA STANDBY';
  filmText(ctx, fonts, 'VISOR / PERSONAL HUD', 72, 76, 14, .75, true);
  filmText(ctx, fonts, '실시간 얼굴 영상 · 주변 지표는 시뮬레이션', 72, 100, 11, .52);
  filmText(ctx, fonts, state, 1208, 76, 12, .8, true, 'right', signalColor(0, 1));
  filmText(ctx, fonts, live ? camera.tracking === 'error' ? '얼굴 추적 연결 실패 · 연출 설정에서 확인해 주세요'
    : camera.tracking === 'tracking' ? 'FACE CENTERED / LOCAL VIDEO / MIC OFF' : '얼굴을 찾고 있어요 · 카메라를 바라봐 주세요'
    : camera.status === 'requesting' ? '브라우저에서 카메라 권한을 허용해 주세요'
      : camera.status === 'error' ? '카메라 설정에서 연결 상태를 확인해 주세요' : '카메라를 켜면 얼굴을 찾아 중앙에 맞춥니다',
  640, 648, live && camera.tracking === 'tracking' ? 11 : 14, .7, live && camera.tracking === 'tracking', 'center');
}
