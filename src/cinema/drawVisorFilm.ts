import { DEFAULT_FONTS, type FilmFonts } from './filmDrawing';
import type { FilmViewportInsets } from './filmViewport';
import { drawPlanarVisorFilm } from './drawPlanarVisorFilm';
import { drawVisorTourFilm } from './drawVisorTourFilm';
import { drawSmtExploreFilm } from './drawSmtExploreFilm';
import type { FactoryInteraction } from './smtFactoryInteraction';

export { drawPlanarVisorFilm } from './drawPlanarVisorFilm';

/** Keep the two visor menu entries independent while retaining the renderer API. */
export function drawVisorFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, viewMode: 'space' | 'pan' = 'space', insets?: FilmViewportInsets,
  interaction?: FactoryInteraction | null) {
  if (viewMode === 'pan') drawPlanarVisorFilm(ctx, width, height, time, fonts, insets);
  else if (interaction) drawSmtExploreFilm(ctx, width, height, time, fonts, insets, interaction);
  else drawVisorTourFilm(ctx, width, height, time, fonts, insets);
}
