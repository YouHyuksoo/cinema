import type { FilmFonts } from '../filmDrawing';
import type { environmentHeatmap } from '../environmentHeatmap';
import type { environmentHeatmapProjection } from '../environmentHeatmapProjection';
import { drawSmtFactory } from './drawSmtFactory';
import { drawEnvironmentThermalGround } from './drawEnvironmentThermalGround';

type Heatmap = ReturnType<typeof environmentHeatmap>;
type Projection = ReturnType<typeof environmentHeatmapProjection>;

/** The visor's actual factory and camera share the same projected thermal floor. */
export function drawEnvironmentSpace(ctx: CanvasRenderingContext2D, fonts: FilmFonts, model: Heatmap,
  projection: Projection, alpha: number, reveal: number) {
  drawEnvironmentThermalGround(ctx, model, projection, alpha, reveal);
  drawSmtFactory(ctx, fonts, { ...projection.factoryState, presence: alpha }, { ground: false });
}
