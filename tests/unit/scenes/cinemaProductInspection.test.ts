import { describe, expect, it } from 'vitest';
import { createHoloProjection } from '@/cinema/holoSpace';
import { DEFAULT_PRODUCT_DATA, inspectProductMeasurement, productCylinderPoint, productInspectionResult,
  productInspectionState, productZoneAnchor } from '@/cinema/productInspection';

describe('product inspection tolerance', () => {
  it('accepts both inclusive tolerance boundaries despite decimal representation', () => {
    const sample = DEFAULT_PRODUCT_DATA.measurements[0];
    expect(inspectProductMeasurement({ ...sample, actual: 24.025 }).verdict).toBe('pass');
    expect(inspectProductMeasurement({ ...sample, actual: 23.975 }).verdict).toBe('pass');
    expect(inspectProductMeasurement({ ...sample, actual: 24.025001 }).verdict).toBe('fail');
    expect(inspectProductMeasurement({ ...sample, actual: 23.974999 }).verdict).toBe('fail');
  });

  it('derives the failed bearing and complete verdict from actual sample values', () => {
    const bearing = DEFAULT_PRODUCT_DATA.measurements[1];
    const result = inspectProductMeasurement(bearing);
    expect(result.verdict).toBe('fail');
    expect(result.deviation).toBeCloseTo(.017);
    expect(result.excess).toBeCloseTo(.007);
    expect(productInspectionResult(DEFAULT_PRODUCT_DATA)).toEqual({ passed: 2, failed: 1, unavailable: 0, total: 3 });
    const corrected = { ...DEFAULT_PRODUCT_DATA, measurements: DEFAULT_PRODUCT_DATA.measurements.map(item =>
      ({ ...item, actual: item.nominal })) };
    expect(productInspectionResult(corrected)).toEqual({ passed: 3, failed: 0, unavailable: 0, total: 3 });
  });

  it('does not present absent or invalid measurements as passed', () => {
    const sample = DEFAULT_PRODUCT_DATA.measurements[0];
    for (const value of [{ actual: NaN }, { nominal: Infinity }, { tolerance: -.1 }]) {
      expect(inspectProductMeasurement({ ...sample, ...value }).verdict).toBe('unavailable');
    }
    expect(productInspectionResult({ ...DEFAULT_PRODUCT_DATA, measurements: [] }).unavailable).toBe(3);
    expect(inspectProductMeasurement({ ...sample, actual: 24, tolerance: 0 }).verdict).toBe('pass');
    expect(inspectProductMeasurement({ ...sample, actual: 24.0001, tolerance: 0 }).verdict).toBe('fail');
  });
});

describe('product inspection choreography', () => {
  it('opens the shell before inspecting three different locations with a zoom in and out for each', () => {
    expect(productInspectionState(0).explode).toBe(0);
    expect(productInspectionState(7).explode).toBe(1);
    for (const [index, zone] of ['shaft', 'bearing', 'winding'].entries()) {
      const start = productInspectionState(7 + index * 7);
      const focus = productInspectionState(10 + index * 7);
      const finish = productInspectionState(13.999 + index * 7);
      expect(focus.activeZone).toBe(zone);
      expect(focus.focus).toBe(1);
      expect(focus.scale).toBeGreaterThan(start.scale);
      expect(focus.scale).toBeGreaterThan(finish.scale);
    }
    expect(productInspectionState(30).activeZone).toBeNull();
    expect(productInspectionState(30).finale).toBe(1);
    expect(productInspectionState(36).reveal).toBe(0);
  });

  it('reconstructs an identical pose after seeking and clamps invalid times', () => {
    const pose = productInspectionState(18.4);
    productInspectionState(32);
    expect(productInspectionState(18.4)).toEqual(pose);
    expect(productInspectionState(-1)).toEqual(productInspectionState(0));
    expect(productInspectionState(NaN)).toEqual(productInspectionState(0));
    expect(productInspectionState(100)).toEqual(productInspectionState(36));
  });

  it('keeps physical anchors attached while the bearing and winding separate', () => {
    expect(productZoneAnchor('bearing', 1).x - productZoneAnchor('bearing', 0).x).toBe(14);
    expect(productZoneAnchor('winding', 1).x - productZoneAnchor('winding', 0).x).toBe(-10);
    expect(productZoneAnchor('shaft', 0)).toEqual(productZoneAnchor('shaft', 1));
    const point = productCylinderPoint(40, 15, Math.PI / 2, -100);
    expect(point.x).toBe(40);
    expect(point.y).toBeCloseTo(-100);
    expect(point.z).toBeCloseTo(15);
  });

  it('keeps product projection finite and within its usable cinematic area across the tour', () => {
    for (let time = 0; time <= 36; time += .2) {
      const state = productInspectionState(time);
      const project = createHoloProjection({ x: 610, y: 367, yaw: state.yaw, pitch: state.pitch,
        scale: state.scale, panX: state.panX, panY: state.panY });
      const surfaces = [
        { ends: [-169, 170], radius: 99, lift: -state.explode * 106 },
        { ends: [-173 - state.explode * 49 - 13, 173 + state.explode * 49 + 13], radius: 100, lift: 0 },
        { ends: [-242, 247], radius: 21, lift: 0 },
      ];
      for (const surface of surfaces) for (const x of surface.ends) for (let a = 0; a < Math.PI * 2; a += .4) {
        const point = project(productCylinderPoint(x, surface.radius, a, surface.lift));
        expect(Number.isFinite(point.x + point.y + point.depth)).toBe(true);
        expect(point.x).toBeGreaterThan(120);
        expect(point.x).toBeLessThan(1050);
        expect(point.y).toBeGreaterThan(70);
        expect(point.y).toBeLessThan(570);
      }
    }
  });
});
