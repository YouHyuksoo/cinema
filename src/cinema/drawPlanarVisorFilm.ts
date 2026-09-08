import { drawInspectionPanorama } from './components/drawInspectionPanorama';
import { drawInfoPanel } from './components/drawInfoPanel';
import { drawTargetReticle } from './components/drawTargetReticle';
import { drawVisorOverlay } from './components/drawVisorOverlay';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { visorTelemetry } from './visorTelemetry';
import { beginVisorViewport, type FilmViewportInsets } from './visorViewport';
import { focusEnvelope } from './filmFocus';

/** An uninterrupted viewpoint: acquisition, object lock, closer inspection, then release. */
export function drawPlanarVisorFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view = beginVisorViewport(ctx, width, height, insets);
  const release = 1 - smooth(29.5, 32, t);
  const focus = focusEnvelope(t, { enter: [7, 11], exit: [26.7, 29.2] });
  const lock = smooth(4, 6.2, t) * (1 - smooth(29, 31, t));
  const telemetry = visorTelemetry(t);
  const { heat, temperature, recovering, stable } = telemetry;
  const reveal = smooth(.15, 1.6, t) * release;
  const { target, detail, driftX, driftY } = drawInspectionPanorama(ctx, fonts, t, focus, heat, view);

  // The scan is a light sweep over the same scene, then contracts into object tracking.
  const sweep = smooth(1.3, 5.5, t);
  const scanX = view.left + sweep * (view.right - view.left);
  const scanAlpha = smooth(.6, 1.7, t) * (1 - smooth(5.2, 6.2, t)) * release;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const scan = ctx.createLinearGradient(scanX - 125, 0, scanX + 2, 0);
  scan.addColorStop(0, signalColor(0, 0)); scan.addColorStop(.95, signalColor(0, scanAlpha * .06));
  scan.addColorStop(1, signalColor(0, scanAlpha * .26));
  ctx.fillStyle = scan; ctx.fillRect(scanX - 125, view.top, 127, view.bottom - view.top);
  ctx.restore();

  drawTargetReticle(ctx, fonts, {
    x: target.x, y: target.y, width: target.width,
    height: target.height, time: t,
    reveal: smooth(2.4, 4.2, t) * release, lock, heat,
    label: t < 6.2 ? 'ACQUIRING / REFLOW 06' : stable ? 'VERIFIED / REFLOW 06' : recovering ? 'COOLING / REFLOW 06' : 'TRACK / REFLOW 06',
  });

  // A short luminous contour identifies the measured feature within the machine.
  if (focus > .001) {
    ctx.save(); ctx.globalAlpha = focus * release;
    ctx.setLineDash([2, 5]); ctx.strokeStyle = signalColor(heat, .45); ctx.lineWidth = .8;
    ctx.beginPath(); ctx.arc(detail.x, detail.y, 40 * detail.scale, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  const analysis = smooth(10.5, 12, t) * (1 - smooth(26.7, 28.7, t));
  const panelX = Math.max(740, Math.min(782, target.x + target.width / 2 + 125));
  const panelY = Math.max(238, Math.min(278, target.y - 72));
  if (analysis > .001) {
    ctx.save(); ctx.globalAlpha = analysis * release;
    const anchorX = detail.x + 14 * detail.scale;
    ctx.beginPath(); ctx.moveTo(anchorX, detail.y);
    ctx.lineTo(target.x + target.width / 2 + 28, target.y - 38); ctx.lineTo(panelX - 24, panelY + 24); ctx.lineTo(panelX, panelY + 24);
    ctx.strokeStyle = signalColor(heat, .6); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(anchorX, detail.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = signalColor(heat, .95); ctx.fill(); ctx.restore();
    filmText(ctx, fonts, stable ? 'SIGNAL STABLE' : recovering ? 'COOLING ACTIVE' : 'THERMAL ALERT', panelX, panelY - 43,
      28, analysis * release, true, 'left', signalColor(heat, 1));
    filmText(ctx, fonts, stable ? '냉각 확인 · 기준 온도로 복귀' : recovering ? '팬 출력 상승 · 냉각 반응 관찰' : '열원 위치 확인 · 냉각 계통 분석',
      panelX + 1, panelY - 19, 13, analysis * release * .75);
    drawInfoPanel(ctx, fonts, {
      x: panelX, y: panelY, width: 285, height: 249, time: t - 10.8, frameVariant: 'telemetry',
      title: 'REFLOW / COOLING 06', charsPerSecond: 48, opacity: analysis * release,
      lines: [
        { label: '냉각부 온도', value: `${temperature.toFixed(1)} °C`, warning: telemetry.warning },
        { label: '기준 대비', value: `+${(temperature - telemetry.baseline).toFixed(1)} °C`, warning: telemetry.warning },
        { label: '팬 출력', value: `${telemetry.fan.toFixed(0)} %` },
        { label: '양품률', value: `${telemetry.yieldRate.toFixed(1)} %` },
      ],
    });
    // This trace and its label remain attached to the same moving annotation.
    ctx.save(); ctx.beginPath();
    for (let sample = 0; sample <= 90; sample++) {
      const u = sample / 90;
      const historical = visorTelemetry(t - 60 * (1 - u));
      const y = panelY + 281 - (historical.temperature - historical.baseline) * 1.6;
      if (sample === 0) ctx.moveTo(panelX + u * 285, y); else ctx.lineTo(panelX + u * 285, y);
    }
    ctx.strokeStyle = signalColor(heat, analysis * release * .6); ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
    filmText(ctx, fonts, 'THERMAL HISTORY / 60s', panelX, panelY + 302, 10, analysis * release * .5, true);
  }

  // The visor is a quieter, near-eye layer; the target and the room move together behind it.
  drawVisorOverlay(ctx, fonts, { time: t, reveal, focus, heat, temperature, driftX, driftY, targetId: 6, contactCount: 8, annotationOpacity: analysis });
  const radius = Math.hypot(view.right - view.left, view.bottom - view.top) * .65;
  const vignette = ctx.createRadialGradient(640, 345, 250, 640, 350, radius);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(.68, 'rgba(0,0,0,.025)'); vignette.addColorStop(1, 'rgba(0,3,7,.22)');
  ctx.fillStyle = vignette; ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  ctx.fillStyle = 'rgba(74,151,173,.025)';
  for (let y = Math.floor(view.top / 4) * 4; y < view.bottom; y += 4) ctx.fillRect(view.left, y, view.right - view.left, .5);
  filmText(ctx, fonts, 'VISOR / PANORAMIC SWEEP', 72, 76, 14, .68 * reveal, true);
  filmText(ctx, fonts, 'LINE 01 · OPTICAL TELEMETRY', 72, 99, 10, .35 * reveal, true);
  filmText(ctx, fonts, 'SIMULATION', 72, 689, 10, .5, true);
}
