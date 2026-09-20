import type { FilmChartSettings } from './chartPresentation';
import type { FilmTextureSettings } from './filmTexture';
import type { FilmThemeId } from './filmThemes';
import type { MachineSubject } from './machinePresentation';
import type { FilmId } from './filmProgram';

const EXPENSIVE_SCENE_FPS: Partial<Record<FilmId, number>> = { product: 30 };

/** Heavy translucent 3D scenes may paint at a bounded cadence while the film clock stays exact. */
export function filmRenderTime(time: number, scene: FilmId) {
  const fps = EXPENSIVE_SCENE_FPS[scene];
  return fps && Number.isFinite(time) ? Math.floor(time * fps) / fps : time;
}
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
  /** 무대 카메라 포즈의 문자열 서명. 무대가 꺼져 있으면 null. 포즈 객체는 매 프레임 새로 만들어져 identity 비교가 통하지 않는다. */
  stagePose: string | null;
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
    || previous.data !== next.data || previous.provenance !== next.provenance
    || previous.stagePose !== next.stagePose;
}
