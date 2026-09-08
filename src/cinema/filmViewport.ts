export interface FilmViewportInsets { bottomInset: number }
export interface FilmViewportBounds { left: number; top: number; right: number; bottom: number }

/** Shared by drawing and pointer picking, including DPR, centering, and dock space. */
export function filmViewportTransform(width: number, height: number, insets?: FilmViewportInsets) {
  const availableHeight = Math.max(1, height - (insets?.bottomInset ?? height * .23) - height * .04);
  const scale = Math.max(.001, Math.min(width / 1280, availableHeight / 720));
  const offsetX = (width - 1280 * scale) / 2;
  const offsetY = (availableHeight - 720 * scale) / 2 + height * .02;
  return { scale, offsetX, offsetY };
}

export function filmViewportPoint(x: number, y: number, width: number, height: number, insets?: FilmViewportInsets) {
  const { scale, offsetX, offsetY } = filmViewportTransform(width, height, insets);
  return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
}

/** Keep information in proportion above the dock; the world continues to every physical edge. */
export function beginFilmViewport(ctx: CanvasRenderingContext2D, width: number, height: number,
  insets?: FilmViewportInsets): FilmViewportBounds {
  const { scale, offsetX, offsetY } = filmViewportTransform(width, height, insets);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  return {
    left: -offsetX / scale, top: -offsetY / scale,
    right: (width - offsetX) / scale, bottom: (height - offsetY) / scale,
  };
}

/** Fill with the current material across the actual viewport, beyond the logical composition. */
export function fillFilmViewport(ctx: CanvasRenderingContext2D, view: FilmViewportBounds) {
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
}
