import { describe, expect, it } from 'vitest';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import type { InspectionCamera } from '@/cinema/inspectionSpace';
import { SMT_STATIONS } from '@/cinema/smtLine';
import {
  SMT_FACTORY_DEPTH, SMT_FACTORY_SECONDS, SMT_FACTORY_STATIONS,
  smtFactoryState, factoryProject, factoryTarget, factoryCamera,
} from '@/cinema/smtFactory';

describe('navigable five-line SMT factory', () => {
  it('retains 40 unique machines in the same eight-process order', () => {
    expect(new Set(SMT_FACTORY_STATIONS.map(item => item.key)).size).toBe(40);
    for (let line = 1; line <= 5; line++) {
      expect(SMT_FACTORY_STATIONS.filter(s => s.line === line).map(s => s.id))
        .toEqual(SMT_STATIONS.map(s => s.id));
    }
  });

  it('opens the menu preview upstream of the loader, looking down the production line', () => {
    const preview = FILM_CHAPTERS.find(chapter => chapter.id === 'visor')!;
    const state = smtFactoryState(preview.previewAt), camera = factoryCamera(state);
    const loader = SMT_FACTORY_STATIONS.find(station => station.line === state.station.line && station.id === 'loader')!;
    expect(state.presence).toBeGreaterThan(0);
    expect(state.focus).toBe(0);
    expect(camera.z).toBeLessThan(loader.x - loader.width / 2);
    expect(Math.cos(camera.yaw)).toBeGreaterThan(.95);
    expect(Math.abs(camera.pitch)).toBeLessThan(Math.PI / 6);
  });

  it.each([1.5, 17.5, 33.5])('shows machines receding from the entrance at %ss', time => {
    const state = smtFactoryState(time);
    const line = SMT_FACTORY_STATIONS.filter(station => station.line === state.station.line);
    const centers = line.map(station => factoryProject({
      x: station.x, y: 80, z: station.z - SMT_FACTORY_DEPTH / 2,
    }, state));
    centers.forEach((point, index) => {
      expect(point.visible).toBe(true);
      if (index) expect(point.depth).toBeGreaterThan(centers[index - 1].depth);
    });

    const projectedHeight = (station: typeof line[number]) => {
      const point = { x: station.x, z: station.z - SMT_FACTORY_DEPTH / 2 };
      return factoryProject({ ...point, y: 0 }, state).y
        - factoryProject({ ...point, y: station.height }, state).y;
    };
    // Equal physical heights make this a check of downstream perspective.
    expect(line[0].height).toBe(line[7].height);
    expect(projectedHeight(line[0])).toBeGreaterThan(projectedHeight(line[7]) * 2);

    const loaders = SMT_FACTORY_STATIONS.filter(station => station.id === 'loader');
    const lateralPositions = loaders.map(station => factoryProject({
      x: station.x, y: 80, z: station.z - SMT_FACTORY_DEPTH / 2,
    }, state).x);
    for (let index = 1; index < lateralPositions.length; index++) {
      expect(lateralPositions[index]).toBeGreaterThan(lateralPositions[index - 1]);
    }
  });

  it('stays in clear aisles and crosses between lines only upstream of the machines', () => {
    for (let tick = 0; tick <= SMT_FACTORY_SECONDS * 20; tick++) {
      const time = tick / 20, camera = factoryCamera(smtFactoryState(time));
      expect(Object.values(camera).every(Number.isFinite), 'camera at ' + time + 's').toBe(true);
      for (const station of SMT_FACTORY_STATIONS) {
        const lateralDistance = Math.max(station.z - SMT_FACTORY_DEPTH - camera.x, 0, camera.x - station.z);
        const downstreamDistance = Math.max(station.x - station.width / 2 - camera.z, 0,
          camera.z - (station.x + station.width / 2));
        expect(Math.hypot(lateralDistance, downstreamDistance), station.key + ' clearance at ' + time + 's')
          .toBeGreaterThan(35);
      }
    }
  });

  it('visits the selected lines without jumping at route or visit boundaries', () => {
    expect([8, 24, 40].map(time => smtFactoryState(time).station.key))
      .toEqual(['L1-reflow', 'L3-maoi', 'L5-mounter']);
    expect(factoryCamera(smtFactoryState(24)).x).toBeGreaterThan(factoryCamera(smtFactoryState(8)).x + 900);
    const axes: (keyof InspectionCamera)[] = ['x', 'y', 'z', 'yaw', 'pitch', 'focal', 'near'];
    for (const start of [0, 16, 32]) {
      for (const boundary of [3, 4, 6, 12, 14, 14.7, 16]) {
        const time = start + boundary;
        const before = factoryCamera(smtFactoryState(time - .00001));
        const at = factoryCamera(smtFactoryState(time));
        const after = factoryCamera(smtFactoryState(time + .00001));
        for (const axis of axes) {
          expect(Math.abs(before[axis] - at[axis]), axis + ' before ' + time + 's').toBeLessThan(.001);
          expect(Math.abs(after[axis] - at[axis]), axis + ' after ' + time + 's').toBeLessThan(.001);
        }
      }
    }
  });

  it('keeps the diagnostic target and its measured feature visible beside the readout', () => {
    for (let tick = 0; tick <= SMT_FACTORY_SECONDS * 10; tick++) {
      const time = tick / 10, state = smtFactoryState(time);
      if (state.readout <= .001) continue;
      const station = state.station, bounds = factoryTarget(state);
      const left = bounds.x - bounds.width / 2, right = bounds.x + bounds.width / 2;
      const top = bounds.y - bounds.height / 2, bottom = bounds.y + bounds.height / 2;
      expect(Object.values(bounds).every(Number.isFinite), 'bounds at ' + time + 's').toBe(true);
      expect(bounds.width).toBeGreaterThan(180);
      expect(left).toBeGreaterThan(0);
      expect(right).toBeLessThan(790);
      expect(top).toBeGreaterThan(0);
      expect(bottom).toBeLessThan(600);

      const points = [
        { x: station.x, y: station.height / 2, z: station.z },
        { x: station.x + (station.id === 'reflow' ? station.width * .34 : 0),
          y: station.id === 'reflow' ? 105 : 110, z: station.z },
      ];
      for (const source of points) {
        const projected = factoryProject(source, state);
        expect(projected.visible, 'tracked point at ' + time + 's').toBe(true);
        expect(projected.x).toBeGreaterThanOrEqual(left);
        expect(projected.x).toBeLessThanOrEqual(right);
        expect(projected.y).toBeGreaterThanOrEqual(top);
        expect(projected.y).toBeLessThanOrEqual(bottom);
      }
    }
  });
});
