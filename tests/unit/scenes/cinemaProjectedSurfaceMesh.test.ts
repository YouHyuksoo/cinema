import { describe, expect, it } from 'vitest';
import { projectedSurfaceMesh } from '../../../src/cinema/components/projectedSurfaceMesh';

describe('projected surface detail', () => {
  it('uses two triangles for an affine face regardless of its size', () => {
    expect(projectedSurfaceMesh((u, v) => ({ x: u * 1800 + v * 300, y: v * 1000 - u * 200 })))
      .toEqual({ columns: 1, rows: 1 });
  });
  it('allocates more detail to a nearby perspective face than the same distant face', () => {
    const select = (scale: number) => projectedSurfaceMesh((u, v) => ({ x: scale * u / (1 + u), y: scale * v / (1 + u) }));
    const near = select(900), far = select(9);
    expect(near.columns * near.rows).toBeGreaterThan(far.columns * far.rows);
    expect(near.columns).toBeLessThanOrEqual(12);
    expect(near.rows).toBeLessThanOrEqual(8);
  });
});
