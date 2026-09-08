import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_HEATMAP_BOUNDS, environmentHeatmap } from '@/cinema/environmentHeatmap';
import { environmentHeatmapLabels, environmentHeatmapProjection } from '@/cinema/environmentHeatmapProjection';
import { factoryCamera, factoryProject, SMT_FACTORY_DEPTH, SMT_FACTORY_LINES, SMT_FACTORY_PITCH, SMT_FACTORY_STATIONS } from '@/cinema/smtFactory';
import { SMT_LINE_WIDTH } from '@/cinema/smtLine';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_FILM_SECONDS, ENVIRONMENT_TIMING } from '@/cinema/zoneEnvironment';

const bounds = ENVIRONMENT_HEATMAP_BOUNDS;
const corners = [
  { x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y },
  { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, { x: bounds.x, y: bounds.y + bounds.height },
];

describe('overhead heatmap descending into the VISOR factory space', () => {
  it('starts with the complete overhead floor and all ten sensors in front of the camera', () => {
    const pins = environmentHeatmap(DEFAULT_ENVIRONMENT_DATA.zones).rooms.map(room => room.pin);
    for (const elapsed of [35, 36, 37, 38]) {
      const projection = environmentHeatmapProjection(elapsed);
      expect(projection.phase).toBe('상공 평면');
      expect(projection.camera.pitch).toBe(Math.PI / 2);
      for (const source of [...corners, ...pins]) {
        const point = projection.point(source.x, source.y);
        expect(point.visible).toBe(true);
        expect(point.depth).toBeGreaterThan(projection.camera.near);
        expect(point.x).toBeGreaterThan(72); expect(point.x).toBeLessThan(1208);
        expect(point.y + 48).toBeGreaterThan(176); expect(point.y + 48).toBeLessThan(622);
      }
    }
  });

  it('aims the overhead camera at the actual five-line factory center', () => {
    const factoryCenter = ((SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH - SMT_FACTORY_DEPTH) / 2;
    const logicalX = bounds.x + (factoryCenter + 240) / ((SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH + 420) * bounds.width;
    const projection = environmentHeatmapProjection(35);
    const center = projection.point(logicalX, bounds.y + bounds.height / 2);
    expect(projection.camera).toMatchObject({ x: factoryCenter, y: 3500, z: SMT_LINE_WIDTH / 2, yaw: 0 });
    expect(center.x).toBeCloseTo(640, 10); expect(center.y).toBeCloseTo(360, 10);
  });

  it('uses the exact same VISOR projection for the heat field, raised geometry and sensor pins', () => {
    const pins = environmentHeatmap(DEFAULT_ENVIRONMENT_DATA.zones).rooms.map(room => room.pin);
    for (const elapsed of [35, 38, 42, 46, 50, 52]) {
      const projection = environmentHeatmapProjection(elapsed);
      expect(factoryCamera(projection.factoryState)).toBe(projection.camera);
      expect(projection.factoryState).toMatchObject({ time: elapsed, presence: 1, focus: 0,
        readout: 0, manualSelection: null, cameraX: projection.camera.z, cameraZ: projection.camera.x });
      for (const source of [...corners, ...pins]) {
        for (const height of [0, 70, 195]) {
          const direct = factoryProject({
            x: -100 + (source.y - bounds.y) / bounds.height * (SMT_LINE_WIDTH + 200),
            y: height,
            z: -240 + (source.x - bounds.x) / bounds.width * ((SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH + 420),
          }, projection.factoryState);
          expect(projection.point(source.x, source.y, height)).toEqual(direct);
        }
      }
    }
  });

  it('descends from the plan, flies along the equipment, then banks across the lines and rises', () => {
    expect([36, 40, 44, 48, 51].map(elapsed => environmentHeatmapProjection(elapsed).phase)).toEqual([
      '상공 평면', '라인 입구로 하강', '설비 사이 전진', '라인 선회', '상공 복귀',
    ]);
    const entry = environmentHeatmapProjection(42).camera;
    const forward = environmentHeatmapProjection(46).camera;
    const turn = environmentHeatmapProjection(50).camera;
    const exit = environmentHeatmapProjection(52).camera;
    expect(entry).toMatchObject({ x: 300, y: 540, z: -320 });
    expect(forward).toMatchObject({ x: 300, y: 380, z: 850 });
    expect(turn).toMatchObject({ x: 1370, y: 620, z: 1670 });
    expect(exit).toMatchObject({ x: 1750, y: 780, z: 1300 });
    expect(entry.pitch).toBeLessThan(Math.PI / 3);
    expect(forward.z).toBeGreaterThan(entry.z);
    expect(turn.yaw).toBeLessThan(-Math.PI / 2);
    expect(exit.y).toBeGreaterThan(turn.y);
  });

  it('keeps the camera above every equipment body and tower throughout a finite continuous flight', () => {
    const maximumHeight = Math.max(...SMT_FACTORY_STATIONS.map(station => station.height + 45));
    for (let elapsed = ENVIRONMENT_TIMING.heatmapStart; elapsed <= ENVIRONMENT_FILM_SECONDS; elapsed += .05) {
      const projection = environmentHeatmapProjection(elapsed);
      expect(projection.camera.y).toBeGreaterThan(maximumHeight);
      expect(Object.values(projection.camera).every(Number.isFinite)).toBe(true);
      expect(projection.camera.pitch).toBeGreaterThan(0);
      expect(projection.camera.pitch).toBeLessThanOrEqual(Math.PI / 2);
      for (const source of corners) {
        const point = projection.point(source.x, source.y);
        expect([point.x, point.y, point.scale, point.depth].every(Number.isFinite)).toBe(true);
      }
    }
    for (const boundary of [38, 42, 46, 50]) {
      const before = environmentHeatmapProjection(boundary - .00001).camera;
      const after = environmentHeatmapProjection(boundary + .00001).camera;
      for (const field of ['x', 'y', 'z', 'yaw', 'pitch'] as const) {
        expect(Math.abs(after[field] - before[field])).toBeLessThan(.00001);
      }
    }
  });

  it('banks by rotating the view without collapsing into a vertical look-down or changing the flight position', () => {
    let previous = environmentHeatmapProjection(42).camera;
    for (let elapsed = 42; elapsed <= 52; elapsed += .05) {
      const camera = environmentHeatmapProjection(elapsed).camera;
      expect(camera.pitch).toBeLessThan(.9);
      expect(Math.abs(camera.yaw - previous.yaw)).toBeLessThan(.07);
      previous = camera;
    }
    const before = environmentHeatmapProjection(46).camera;
    const midway = environmentHeatmapProjection(48).camera;
    const after = environmentHeatmapProjection(50).camera;
    expect(midway).toMatchObject({ x: 835, y: 500, z: 1260 });
    expect(midway.yaw).toBeCloseTo((before.yaw + after.yaw) / 2, 10);
    expect(midway.pitch).toBeCloseTo((before.pitch + after.pitch) / 2, 10);
    expect(midway.pitch).toBeGreaterThan(.5);
    expect(midway.pitch).toBeLessThan(.6);
  });

  it('reproduces the same flight after reverse seeking and clamps unavailable scene times', () => {
    const reference = environmentHeatmapProjection(44);
    for (const elapsed of [52, 37, 44, 50, 35, 44]) {
      const current = environmentHeatmapProjection(elapsed);
      if (elapsed === 44) {
        expect(current.camera).toEqual(reference.camera);
        expect(current.factoryState).toEqual(reference.factoryState);
        expect(current.point(166, 210, 70)).toEqual(reference.point(166, 210, 70));
      }
    }
    for (const elapsed of [NaN, Infinity, -Infinity, -1, 0, 34]) {
      expect(environmentHeatmapProjection(elapsed).camera).toEqual(environmentHeatmapProjection(35).camera);
    }
    expect(environmentHeatmapProjection(100).camera).toEqual(environmentHeatmapProjection(52).camera);
  });
});

describe('sensor labels in the rotating installation', () => {
  const separated = (a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }) =>
    a.x + a.width + 4 <= b.x || b.x + b.width + 4 <= a.x
      || a.y + a.height + 4 <= b.y || b.y + b.height + 4 <= a.y;

  it('keeps visible sensor billboards in the viewport with at least four pixels between them throughout the flight', () => {
    const rooms = environmentHeatmap(DEFAULT_ENVIRONMENT_DATA.zones).rooms;
    for (let elapsed = 35; elapsed <= 52; elapsed += .05) {
      const projection = environmentHeatmapProjection(elapsed);
      const visible = rooms.map(room => {
        const point = projection.point(room.pin.x, room.pin.y);
        return { ...point, y: point.y + 48 };
      }).filter(point => point.visible && point.x > 155 && point.x < 1125 && point.y > 210 && point.y < 596);
      const labels = environmentHeatmapLabels(visible);
      expect(labels).toHaveLength(visible.length);
      if (elapsed <= 38) expect(labels).toHaveLength(10);
      for (const [index, label] of labels.entries()) {
        expect(label.width).toBe(88); expect(label.height).toBe(38);
        expect(label.x).toBeGreaterThanOrEqual(145);
        expect(label.x + label.width).toBeLessThanOrEqual(1135);
        expect(label.y).toBeGreaterThanOrEqual(190);
        expect(label.y + label.height).toBeLessThanOrEqual(610);
        for (const other of labels.slice(index + 1)) expect(separated(label, other)).toBe(true);
      }
    }
  });

  it('uses the preferred position above each sensor when it is free and preserves input ordering', () => {
    const points = [{ x: 700, y: 400 }, { x: 300, y: 500 }, { x: 900, y: 300 }];
    const labels = environmentHeatmapLabels(points);
    expect(labels).toEqual(points.map(point => ({ x: point.x - 44, y: point.y - 52, width: 88, height: 38 })));
    expect(environmentHeatmapLabels([])).toEqual([]);
  });

  it('separates coincident sensor projections and clamps labels near every viewport edge', () => {
    const points = Array.from({ length: 10 }, () => ({ x: 640, y: 418 }));
    const labels = environmentHeatmapLabels(points);
    expect(labels[0]).toEqual({ x: 596, y: 366, width: 88, height: 38 });
    for (const [index, label] of labels.entries()) {
      for (const other of labels.slice(index + 1)) expect(separated(label, other)).toBe(true);
    }
    expect(environmentHeatmapLabels([{ x: 0, y: 0 }])[0]).toEqual({ x: 145, y: 190, width: 88, height: 38 });
    expect(environmentHeatmapLabels([{ x: 1280, y: 720 }])[0]).toEqual({ x: 1047, y: 572, width: 88, height: 38 });
  });

  it('restores the same label placements after a reverse seek', () => {
    const rooms = environmentHeatmap(DEFAULT_ENVIRONMENT_DATA.zones).rooms;
    const layout = (elapsed: number) => {
      const projection = environmentHeatmapProjection(elapsed);
      const visible = rooms.map(room => {
        const point = projection.point(room.pin.x, room.pin.y);
        return { ...point, y: point.y + 48 };
      }).filter(point => point.visible && point.x > 155 && point.x < 1125 && point.y > 210 && point.y < 596);
      return environmentHeatmapLabels(visible);
    };
    const first = layout(42);
    layout(50); layout(35);
    expect(layout(42)).toEqual(first);
  });
});
