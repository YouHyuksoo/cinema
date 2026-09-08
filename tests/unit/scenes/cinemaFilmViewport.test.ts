import { describe, expect, it } from 'vitest';
import { beginFilmViewport, fillFilmViewport, filmViewportPoint } from '@/cinema/filmViewport';

const VIEWPORTS = [
  { name: 'sixteen scene mobile menu', width: 390, height: 844, inset: 390 },
  { name: 'four-row menu just above the short-height breakpoint', width: 680, height: 501, inset: 390 },
  { name: 'portrait menu', width: 320, height: 740, inset: 390 },
  { name: 'desktop menu', width: 1280, height: 720, inset: 156 },
  { name: 'short-height scrolling menu', width: 600, height: 400, inset: 116 },
  { name: 'ultrawide menu', width: 2560, height: 1080, inset: 156 },
  { name: 'large desktop menu', width: 1932, height: 1264, inset: 156 },
];

function projectionFor(width: number, height: number, inset: number) {
  let matrix = [1, 0, 0, 1, 0, 0];
  const painted: { x: number; y: number }[][] = [];
  const point = (x: number, y: number) => ({
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  });
  const ctx = {
    setTransform(...values: number[]) { matrix = values; },
    fillRect(x: number, y: number, rectWidth: number, rectHeight: number) {
      painted.push([point(x, y), point(x + rectWidth, y),
        point(x + rectWidth, y + rectHeight), point(x, y + rectHeight)]);
    },
  } as unknown as CanvasRenderingContext2D;
  const view = beginFilmViewport(ctx, width, height, { bottomInset: inset });
  fillFilmViewport(ctx, view);
  return { matrix, view, point, painted };
}

describe('shared cinema viewport with a persistent scene menu', () => {
  it.each(VIEWPORTS)('keeps the HUD above the $name while the world fills every edge', ({ width, height, inset }) => {
    const logicalScreens: ReturnType<typeof projectionFor>[] = [];
    for (const dpr of [1, 2]) {
      const projection = projectionFor(width * dpr, height * dpr, inset * dpr);
      const { matrix, view, point, painted } = projection;
      logicalScreens.push(projection);

      expect(matrix.every(Number.isFinite)).toBe(true);
      expect(matrix[0]).toBeGreaterThan(0);
      expect(matrix[0]).toBe(matrix[3]);
      expect(matrix[1]).toBe(0);
      expect(matrix[2]).toBe(0);

      // Projecting a circle preserves equal radii in both directions on any screen shape.
      const center = point(640, 360), right = point(704, 360), lower = point(640, 424);
      expect(Math.hypot(right.x - center.x, right.y - center.y))
        .toBeCloseTo(Math.hypot(lower.x - center.x, lower.y - center.y), 8);
      // Input reverses the actual draw transform even at the physical edges and at retina DPR.
      for (const source of [{ x: 640, y: 360 }, { x: view.left, y: 150 }, { x: view.right, y: 550 }]) {
        const physical = point(source.x, source.y);
        const picked = filmViewportPoint(physical.x, physical.y, width * dpr, height * dpr, { bottomInset: inset * dpr });
        expect(picked.x).toBeCloseTo(source.x, 8);
        expect(picked.y).toBeCloseTo(source.y, 8);
      }

      // The room receives inverse viewport bounds, so its surface can continue behind the menu.
      const topLeft = point(view.left, view.top);
      const bottomRight = point(view.right, view.bottom);
      expect(topLeft.x).toBeCloseTo(0, 8);
      expect(topLeft.y).toBeCloseTo(0, 8);
      expect(bottomRight.x).toBeCloseTo(width * dpr, 8);
      expect(bottomRight.y).toBeCloseTo(height * dpr, 8);

      // The actual material fill covers the whole physical canvas, including outside 1280x720.
      expect(painted).toHaveLength(1);
      const expected = [[0, 0], [width * dpr, 0], [width * dpr, height * dpr], [0, height * dpr]];
      painted[0].forEach((corner, index) => {
        expect(corner.x).toBeCloseTo(expected[index][0], 8);
        expect(corner.y).toBeCloseTo(expected[index][1], 8);
      });
      expect(view.bottom).toBeGreaterThan(720);
      if (width / height > 1280 / 720) {
        expect(view.left).toBeLessThan(0);
        expect(view.right).toBeGreaterThan(1280);
      }

      // Even the lowest HUD baseline and its text descent stay clear of the reserved dock.
      expect(point(640, 0).y).toBeGreaterThanOrEqual(0);
      expect(point(640, 689 + 10).y).toBeLessThan((height - inset) * dpr);
      expect(point(640, 720).y).toBeLessThanOrEqual((height - inset) * dpr);
      expect(point(0, 360).x).toBeGreaterThanOrEqual(0);
      expect(point(1280, 360).x).toBeLessThanOrEqual(width * dpr);
    }

    // A retina canvas changes pixel density, not the position or size seen by the user.
    for (const [x, y] of [[0, 0], [640, 360], [1280, 720]]) {
      const normal = logicalScreens[0].point(x, y);
      const retina = logicalScreens[1].point(x, y);
      expect(retina.x / 2).toBeCloseTo(normal.x, 8);
      expect(retina.y / 2).toBeCloseTo(normal.y, 8);
    }
  });
});
