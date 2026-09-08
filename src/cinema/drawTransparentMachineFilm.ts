import { drawPcbInspectionFilm } from './drawPcbInspectionFilm';
import { drawRaceCarFilm } from './drawRaceCarFilm';
import { DEFAULT_FONTS, type FilmFonts } from './filmDrawing';
import type { FilmViewportInsets } from './filmViewport';
import { DEFAULT_MACHINE_SUBJECT, type MachineSubject } from './machinePresentation';
import { DEFAULT_PCB_INSPECTION_DATA, type PcbInspectionData } from './pcbInspectionData';
import type { SceneDataProvenance } from './sceneDataStore';

/** Stable machine-scene entry point. Only an explicit car subject selects the preserved car film. */
export function drawTransparentMachineFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, subject: MachineSubject = DEFAULT_MACHINE_SUBJECT,
  data: PcbInspectionData = DEFAULT_PCB_INSPECTION_DATA, provenance?: SceneDataProvenance) {
  if (subject === 'car') return drawRaceCarFilm(ctx, width, height, time, fonts, insets);
  return drawPcbInspectionFilm(ctx, width, height, time, fonts, insets, data, provenance);
}
