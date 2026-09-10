import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sphereSpinAngle, SPHERE_SPIN_STEPS } from '@/cinema/filmMenuGlobe';

const TAU = Math.PI * 2;

describe('folded globe idle cost', () => {
  it('quantizes the raster spin to half-degree steps so most frames reuse the last raster', () => {
    expect(SPHERE_SPIN_STEPS).toBe(720);
    const step = TAU / SPHERE_SPIN_STEPS;
    expect(sphereSpinAngle(0)).toBe(0);
    expect(sphereSpinAngle(step * .4)).toBe(0);
    expect(sphereSpinAngle(step * .6)).toBeCloseTo(step, 12);
    expect(sphereSpinAngle(step * 10.49)).toBe(sphereSpinAngle(step * 9.51));
    // A 30 s revolution at 60 fps advances 0.2° per frame: at most one raster every two frames.
    const perFrame = TAU / 30000 * 16.7;
    const rasters = new Set(Array.from({ length: 600 }, (_, i) => sphereSpinAngle(perFrame * i))).size;
    expect(rasters).toBeLessThanOrEqual(300);
    expect(rasters).toBeGreaterThan(200);
    expect(sphereSpinAngle(Number.NaN)).toBe(0);
  });
  it('reads layout only while morphing, publishes orbit variables only when they change, and rasters only on a new spin', () => {
    const source = readFileSync('src/cinema/useFilmMenuGlobe.ts', 'utf8');
    expect(source).toContain("if (currentPhase === 'morphing') rect = element.getBoundingClientRect();");
    expect(source).not.toMatch(/previousTime = time;\s*rect = element\.getBoundingClientRect\(\);/);
    expect(source).toContain('if (nav && orbitVars !== publishedOrbitVars) {');
    expect(source).toContain('const spin = sphereSpinAngle(angle);');
    expect(source).toContain('if (spin !== rasterSpin || diameter !== rasterSize) {');
    expect(source).toContain('drawSoccerSphere(ball.current, diameter, spin);');
  });
});
