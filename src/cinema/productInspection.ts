import { smooth } from './filmDrawing';
import type { HoloPoint } from './holoSpace';

export const PRODUCT_INSPECTION_SECONDS = 36;
export type ProductZone = 'shaft' | 'bearing' | 'winding';
export interface ProductMeasurement {
  zone: ProductZone;
  label: string;
  nominal: number;
  actual: number;
  tolerance: number;
  unit: string;
  decimals: number;
}
export interface ProductInspectionData {
  name: string;
  serial: string;
  measurements: readonly ProductMeasurement[];
}
export const PRODUCT_ZONES = ['shaft', 'bearing', 'winding'] as const;
export const DEFAULT_PRODUCT_DATA: ProductInspectionData = {
  name: '리니어 액추에이터', serial: 'LA-240 / SN 00872',
  measurements: [
    { zone: 'shaft', label: '구동축 직경', nominal: 24, actual: 24.018, tolerance: .025, unit: 'mm', decimals: 3 },
    { zone: 'bearing', label: '베어링 간극', nominal: .05, actual: .067, tolerance: .01, unit: 'mm', decimals: 3 },
    { zone: 'winding', label: '권선 저항', nominal: 4.2, actual: 4.18, tolerance: .15, unit: 'Ω', decimals: 2 },
  ],
};

/** Inclusive engineering tolerance, with only floating-point representation error ignored. */
export function inspectProductMeasurement(measurement: ProductMeasurement) {
  const { nominal, actual, tolerance } = measurement;
  if (![nominal, actual, tolerance].every(Number.isFinite) || tolerance < 0) {
    return { verdict: 'unavailable' as const, deviation: null, excess: null };
  }
  const deviation = actual - nominal;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(nominal), Math.abs(actual)) * 8;
  const excess = Math.max(0, Math.abs(deviation) - tolerance);
  return { verdict: excess <= epsilon ? 'pass' as const : 'fail' as const, deviation, excess };
}

export function productInspectionResult(data: ProductInspectionData) {
  const results = PRODUCT_ZONES.map(zone => {
    const measurement = data.measurements.find(item => item.zone === zone);
    return measurement ? inspectProductMeasurement(measurement).verdict : 'unavailable';
  });
  return { passed: results.filter(value => value === 'pass').length,
    failed: results.filter(value => value === 'fail').length,
    unavailable: results.filter(value => value === 'unavailable').length, total: PRODUCT_ZONES.length };
}

export function productInspectionState(time: number) {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(PRODUCT_INSPECTION_SECONDS, time)) : 0;
  const release = 1 - smooth(33.8, PRODUCT_INSPECTION_SECONDS, elapsed);
  const inspection = elapsed < 7 || elapsed >= 28 ? null : Math.min(2, Math.floor((elapsed - 7) / 7));
  const localTime = inspection === null ? 0 : elapsed - 7 - inspection * 7;
  const focus = smooth(0, 1.7, localTime) * (1 - smooth(5.4, 7, localTime));
  const activeZone = inspection === null ? null : PRODUCT_ZONES[inspection];
  const explode = smooth(2.5, 6.8, elapsed);
  const yaw = .47 + Math.sin(elapsed * .145) * .19;
  const pitch = -.19 + Math.sin(elapsed * .11) * .055;
  const focusPoint = activeZone ? productZoneAnchor(activeZone, explode) : { x: 0, y: 0, z: 0 };
  // Pan toward the selected physical point while moving the complete object toward the viewer.
  const rotatedX = focusPoint.x * Math.cos(yaw) + focusPoint.z * Math.sin(yaw);
  const rotatedZ = -focusPoint.x * Math.sin(yaw) + focusPoint.z * Math.cos(yaw);
  const rotatedY = focusPoint.y * Math.cos(pitch) - rotatedZ * Math.sin(pitch);
  return { elapsed, release, inspection, activeZone, localTime, focus, explode, yaw, pitch,
    scale: (.86 + smooth(0, 2.3, elapsed) * .18 + focus * .2) * (.84 + release * .16),
    panX: rotatedX * focus * .5, panY: rotatedY * focus * .25,
    reveal: smooth(0, 1.3, elapsed) * release, detailReveal: smooth(1.1, 2.2, localTime) * release,
    finale: smooth(28, 29.5, elapsed) * release,
  };
}
export type ProductInspectionState = ReturnType<typeof productInspectionState>;

/** Anchors share the same local space and separation offsets as the physical model. */
export function productZoneAnchor(zone: ProductZone, explode: number): HoloPoint {
  if (zone === 'shaft') return { x: 220, y: -12, z: 0 };
  if (zone === 'bearing') return { x: 115 + explode * 14, y: -48, z: 0 };
  return { x: -80 - explode * 10, y: -55, z: 0 };
}

export function productCylinderPoint(x: number, radius: number, angle: number, lift = 0): HoloPoint {
  return { x, y: Math.cos(angle) * radius + lift, z: Math.sin(angle) * radius };
}
