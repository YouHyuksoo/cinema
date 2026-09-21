import { drawSmtFactory } from './components/drawSmtFactory';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { filmText, signalColor, type FilmFonts } from './filmDrawing';
import { factoryWorld, SMT_FACTORY_DEPTH, SMT_FACTORY_STATIONS, smtFactoryState, type FactoryState } from './smtFactory';
import { interactionCamera, type FactoryInteraction } from './smtFactoryInteraction';
import { strokeSpatialPath } from './inspectionSpace';
import { pad2 } from './filmMath';

/** Manual view uses the same equipment and perspective as the automatic tour. */
export function drawSmtExploreFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts, insets: FilmViewportInsets | undefined, interaction: FactoryInteraction) {
  const view = beginFilmViewport(ctx, width, height, insets);
  const camera = interactionCamera(interaction.orbit);
  const selected = SMT_FACTORY_STATIONS.find(station => station.key === interaction.selectedKey);
  const base = smtFactoryState(time);
  const state: FactoryState = { ...base, cameraOverride: camera, cameraX: camera.z, cameraZ: camera.x,
    manualSelection: selected?.key ?? null, station: selected ?? base.station,
    presence: 1, focus: selected ? .45 : 0, readout: 0 };
  const wash = ctx.createRadialGradient(620, 350, 40, 640, 350, 950);
  wash.addColorStop(0, '#16313d'); wash.addColorStop(.6, '#071720'); wash.addColorStop(1, '#02080e');
  ctx.fillStyle = wash; ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  drawSmtFactory(ctx, fonts, state);
  if (selected) {
    const { x, z, width: w, height: h } = selected;
    const corners = [z - SMT_FACTORY_DEPTH - 3, z + 3].map(depth => [
      { x: x - w / 2 - 3, y: 0, z: depth }, { x: x + w / 2 + 3, y: 0, z: depth },
      { x: x + w / 2 + 3, y: h + 3, z: depth }, { x: x - w / 2 - 3, y: h + 3, z: depth },
    ]);
    for (const face of corners) strokeSpatialPath(ctx, camera, [...face, face[0]].map(factoryWorld), signalColor(0, .95), 1.8);
    for (let index = 0; index < 4; index++) strokeSpatialPath(ctx, camera,
      [factoryWorld(corners[0][index]), factoryWorld(corners[1][index])], signalColor(0, .95), 1.8);
  }
  filmText(ctx, fonts, 'VISOR / SMT FACTORY', 65, 72, 17, .9, true);
  filmText(ctx, fonts, '05 LINES / 40 MACHINES / EXPLORE', 65, 95, 10, .6, true);
  filmText(ctx, fonts, selected ? `LINE ${pad2(selected.line)} / ${selected.label} · 선택됨`
    : '설비를 클릭하면 선택됩니다.', 640, 620, 13, .9, false, 'center');
  filmText(ctx, fonts, '드래그 회전 · Shift + 드래그 이동 · 휠 확대/축소', 640, 692, 11, .6, false, 'center');
}
