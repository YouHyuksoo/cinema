import { drawPcbAssembly } from './components/drawPcbAssembly';
import { drawPcbEntrance } from './components/drawPcbEntrance';
import { drawPcbInspectionReadout } from './components/drawPcbInspectionReadout';
import { drawTargetReticle } from './components/drawTargetReticle';
import { DEFAULT_FONTS, filmText, fitText, signalColor, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { pcbInspectionState } from './pcbInspection';
import { pcbEntranceState } from './pcbEntrance';
import { DEFAULT_PCB_INSPECTION_DATA, type PcbInspectionData } from './pcbInspectionData';
import { applyPcbInspectionLayout, createPcbInspectionProjection, pcbInspectionFocus, pcbInspectionLayout } from './pcbInspectionLayout';
import type { SceneDataProvenance } from './sceneDataStore';

const oneLine = fitText;

/** Data-driven SMT board inspection. All geometry and readout state come from the PCB document. */
export function drawPcbInspectionFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: PcbInspectionData = DEFAULT_PCB_INSPECTION_DATA,
  provenance?: SceneDataProvenance) {
  const layout = pcbInspectionLayout(width, height, insets), state = pcbInspectionState(time, data), entrance = pcbEntranceState(time);
  ctx.save();
  applyPcbInspectionLayout(ctx, layout);
  const worldLeft = -layout.offsetX / layout.scale, worldTop = -layout.offsetY / layout.scale;
  ctx.fillStyle = '#02070b'; ctx.fillRect(worldLeft, worldTop, width / layout.scale, height / layout.scale);
  const halo = ctx.createRadialGradient(layout.board.x + layout.board.width * .5, layout.board.y + layout.board.height * .5,
    12, layout.board.x + layout.board.width * .5, layout.board.y + layout.board.height * .5, Math.max(layout.board.width, layout.board.height) * .7);
  halo.addColorStop(0, '#12313a'); halo.addColorStop(.62, '#071820'); halo.addColorStop(1, '#02070b');
  ctx.fillStyle = halo; ctx.fillRect(worldLeft, worldTop, width / layout.scale, height / layout.scale);

  const titleSize = layout.portrait ? 18 : 21;
  filmText(ctx, fonts, 'SMT PCB 검사 시연', layout.header.x, layout.header.y + titleSize, titleSize, state.presence * entrance.ground, false);
  const source = provenance ? `${provenance.source.toUpperCase()} · ${provenance.at}` : '시연 도형 · CAD/검사 영상 아님';
  ctx.save(); ctx.font = `${layout.portrait ? 14 : 10}px ${fonts.mono}`;
  const sourceLine = oneLine(ctx, source, layout.portrait ? layout.header.width : 470); ctx.restore();
  filmText(ctx, fonts, sourceLine, layout.header.x, layout.header.y + titleSize + (layout.portrait ? 20 : 18), layout.portrait ? 14 : 10,
    state.presence * entrance.outline * .58, true);
  if (state.validation.valid) {
    ctx.save(); ctx.font = `${layout.portrait ? 14 : 13}px ${fonts.mono}`;
    const identity = oneLine(ctx, `${data.name}  /  ${data.serial}`, layout.portrait ? layout.header.width : 480);
    ctx.restore();
    filmText(ctx, fonts, identity, layout.portrait ? layout.header.x : layout.header.x + layout.header.width,
      layout.portrait ? layout.header.y + titleSize + 40 : layout.header.y + titleSize,
      layout.portrait ? 14 : 13, state.presence * entrance.circuits * .74, true, layout.portrait ? 'left' : 'right');
  }

  if (state.validation.valid) {
    const projection = createPcbInspectionProjection(layout, state, data);
    const focus = pcbInspectionFocus(layout, state, data);
    ctx.save(); ctx.beginPath(); ctx.rect(layout.board.x, layout.board.y, layout.board.width, layout.board.height); ctx.clip();
    drawPcbEntrance(ctx, layout, projection, data, entrance);
    drawPcbAssembly(ctx, projection.project, fonts, data, state, projection.boardTop, entrance);
    if (state.phase === 'scan') {
      const y = layout.board.y + state.scan * layout.board.height;
      const scan = ctx.createLinearGradient(layout.board.x, y, layout.board.x + layout.board.width, y);
      scan.addColorStop(0, 'rgba(95,227,255,0)'); scan.addColorStop(.5, signalColor(0, .78)); scan.addColorStop(1, 'rgba(95,227,255,0)');
      ctx.fillStyle = scan; ctx.fillRect(layout.board.x, y - 1.5, layout.board.width, 3);
    }
    if (focus) drawTargetReticle(ctx, fonts, {
      x: focus.point.x, y: focus.point.y, width: focus.size.width, height: focus.size.height,
      time: state.time, reveal: Math.max(.2, state.focus), lock: state.focus, heat: 1, label: state.selectedComponent?.id,
    });
    ctx.restore();
    if (focus) {
      const edgeX = layout.portrait ? layout.readout.x + layout.readout.width * .5 : layout.readout.x;
      const edgeY = layout.portrait ? layout.readout.y : layout.readout.y + 52;
      ctx.save(); ctx.globalAlpha = state.focus * state.presence;
      ctx.beginPath(); ctx.moveTo(focus.point.x, focus.point.y);
      ctx.lineTo(layout.portrait ? focus.point.x : edgeX - 18, layout.portrait ? edgeY - 12 : edgeY);
      ctx.lineTo(edgeX, edgeY); ctx.strokeStyle = signalColor(1, .56); ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
  }
  drawPcbInspectionReadout(ctx, fonts, layout, { ...state, presence: state.presence * entrance.outline });
  ctx.restore();

  // drawSignalFilm paints its shared footer after the renderer and expects this standard logical transform.
  beginFilmViewport(ctx, width, height, insets);
}
