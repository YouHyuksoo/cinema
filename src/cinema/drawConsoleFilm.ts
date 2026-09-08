import { drawGear } from './components/drawGear';
import { drawInfoPanel, infoPanelFocusProjection, type InfoPanelLine } from './components/drawInfoPanel';
import { drawRotor } from './components/drawRotor';
import { DEFAULT_FONTS, filmText, signalColor, smooth, windowAt, type FilmFonts } from './filmDrawing';
import { drivenGear, type Gear } from './gearGeometry';
import { applyFocusProjection, focusEnvelope, focusProjection, projectFocusPoint } from './filmFocus';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';

const PROCESS_LINES: readonly InfoPanelLine[] = [
  { label: '설비 식별', value: 'SMT-03 / LINE 01' },
  { label: '공정 온도', value: '94.6 °C', warning: true },
  { label: '생산 수량', value: '1,267 EA' },
  { label: '양품률', value: '96.4 %', warning: true },
  { label: '설비 상태', value: 'RUNNING' },
  { label: '수신 지연', value: '24 ms' },
];

const ANALYSIS_LINES: readonly InfoPanelLine[] = [
  { label: '변화 감지', value: 'TEMP +16.4 °C', warning: true },
  { label: '분석 결과', value: 'CHECK COOLING', warning: true },
];

/** Reusable components share one local clock and connect through a common signal path. */
export function drawConsoleFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  const reveal = smooth(.4, 2, t);
  const heat = smooth(8, 11, t) * (1 - smooth(22, 26, t));
  const release = 1 - smooth(25, 28, t);
  const core: Gear = { x: 345, y: 300, teeth: 38, radius: 114, angle: t * .24 };
  const follower = drivenGear(core, 24, .8);
  const coreFocus = focusEnvelope(t, { enter: [2, 4.5], exit: [8, 10.5] });
  const coreProjection = focusProjection({ x: core.x, y: core.y, focus: coreFocus, depth: 170, lift: 15 });
  const processPanel = { x: 660, y: 170, width: 490, height: 365,
    focus: focusEnvelope(t, { enter: [8, 10.5], exit: [15.5, 18] }) };

  const aura = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 350);
  aura.addColorStop(0, signalColor(heat, .045)); aura.addColorStop(1, signalColor(heat, 0));
  ctx.fillStyle = aura; fillFilmViewport(ctx, view);
  const fieldWidth = view.right - view.left, fieldHeight = view.bottom - view.top;
  const particles = Math.min(240, Math.ceil(65 * fieldWidth * fieldHeight / (1280 * 720)));
  for (let i = 0; i < particles; i++) {
    const x = view.left + ((i * 97 + t * 14) % fieldWidth);
    const y = view.top + (i * 71) % fieldHeight;
    ctx.fillStyle = signalColor(0, .1); ctx.fillRect(x, y, 3, .7);
  }
  drawRotor(ctx, { x: core.x, y: core.y, radius: 164, time: t, speed: .55, reveal: reveal * release, heat, variant: 'segments' });
  ctx.save(); applyFocusProjection(ctx, coreProjection);
  drawGear(ctx, core, smooth(1, 3, t) * release, heat, true, coreFocus * 11);
  drawGear(ctx, follower, smooth(2, 4, t) * release, 0, false, coreFocus * 11);

  const text = (value: string, x: number, y: number, size: number, opacity: number, mono = false, align: CanvasTextAlign = 'left') =>
    filmText(ctx, fonts, value, x, y, size, opacity * release, mono, align);
  const coreRead = smooth(3, 4, t);
  text('SMT / 03', core.x, core.y - 27, 12, coreRead * .65, true, 'center');
  text('94.6°', core.x, core.y + 18, 39, coreRead, true, 'center');
  text('THERMAL CORE', core.x, core.y + 41, 9, coreRead * .5, true, 'center');
  text('SYNC', follower.x, follower.y + 5, 13, smooth(4, 5, t) * .7, true, 'center');
  ctx.restore();

  // A rotating scan establishes the link, which becomes the first edge of the information window.
  drawRotor(ctx, { x: 565, y: 140, radius: 33, time: t, speed: 1, reveal: smooth(1, 2.4, t) * release, variant: 'sweep' });
  text('LINK SCAN', 565, 189, 9, .5 * reveal, true, 'center');
  const connection = smooth(2.8, 4, t) * release;
  const source = projectFocusPoint(coreProjection, { x: 446, y: 249 });
  const destination = projectFocusPoint(infoPanelFocusProjection(processPanel), { x: 660, y: 212 });
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, source.x + (destination.x - source.x + 2) * connection, 720); ctx.clip();
  ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(534, destination.y); ctx.lineTo(destination.x, destination.y);
  ctx.strokeStyle = signalColor(heat, connection * .6); ctx.lineWidth = .8; ctx.stroke(); ctx.restore();
  drawInfoPanel(ctx, fonts, {
    ...processPanel, time: t - 3.8, frameVariant: 'command',
    title: 'PROCESS TELEMETRY / 설비 정보', lines: PROCESS_LINES, charsPerSecond: 30, opacity: release,
  });

  // A second instance demonstrates the same typed panel with different content and dimensions.
  drawInfoPanel(ctx, fonts, {
    x: 128, y: 507, width: 424, height: 137, time: t - 12, frameVariant: 'analysis',
    focus: focusEnvelope(t, { enter: [16, 18.5], exit: [22, 24.5] }),
    title: 'ANALYSIS / 상태 판독', lines: ANALYSIS_LINES, charsPerSecond: 28, opacity: release,
  });
  const syncProjection = focusProjection({ x: 1048, y: 602,
    focus: focusEnvelope(t, { enter: [21.5, 23], exit: [24, 25] }), depth: 180, lift: 8 });
  ctx.save(); applyFocusProjection(ctx, syncProjection);
  drawRotor(ctx, { x: 1048, y: 602, radius: 36, time: t, speed: .85, reveal: smooth(10, 12, t) * release, heat: .2, variant: 'orbit' });
  text('STREAM SYNC', 988, 606, 10, smooth(12, 13, t) * .55, true, 'right');
  ctx.restore();
  text('회전이 신호를 모으고, 문장이 정보를 완성합니다.', 638, 585, 14, windowAt(15, 25, t) * .7);
  filmText(ctx, fonts, 'J / 03', 72, 76, 14, .6, true);
  filmText(ctx, fonts, 'INFORMATION CONSOLE', 72, 99, 10, .4, true);
  const phase = t < 4 ? '01 / CONNECT' : t < 12 ? '02 / DECODE' : t < 25 ? '03 / INTERPRET' : '04 / RELEASE';
  filmText(ctx, fonts, phase, 72, 689, 10, .5, true);
}
