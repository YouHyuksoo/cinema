import type { FilmChartSettings } from './chartPresentation';
import type { FilmTextureSettings } from './filmTexture';
import type { FilmThemeId } from './filmThemes';
import type { MachineSubject } from './machinePresentation';

/**
 * Everything that can change what the film canvas paints. The render loop compares consecutive
 * keys and skips the draw (scene + texture) when nothing moved: a paused scene, a paused main
 * backdrop, or a preview frozen on its chapter still. Object-valued inputs are compared by
 * identity, which the stores and interaction hooks already guarantee by replacing on change.
 */
export interface FilmFrameKey {
  camera: boolean; time: number; width: number; height: number; inset: number;
  theme: FilmThemeId; texture: FilmTextureSettings; charts: FilmChartSettings; subject: MachineSubject;
  factory: unknown; cctvManual: boolean; selectedZone: string | null; data: unknown; provenance: unknown;
}

/** True when the next frame must be painted; manual CCTV browsing runs feeds on the wall clock, so it always paints. */
export function filmFrameChanged(previous: FilmFrameKey | null, next: FilmFrameKey) {
  if (!previous || next.cctvManual) return true;
  return previous.camera !== next.camera || !Object.is(previous.time, next.time)
    || previous.width !== next.width || previous.height !== next.height || !Object.is(previous.inset, next.inset)
    || previous.theme !== next.theme
    || previous.texture.style !== next.texture.style || !Object.is(previous.texture.intensity, next.texture.intensity)
    || previous.charts !== next.charts || previous.subject !== next.subject
    || previous.factory !== next.factory || previous.selectedZone !== next.selectedZone
    || previous.data !== next.data || previous.provenance !== next.provenance;
}
