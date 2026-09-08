import { describe, expect, it } from 'vitest';
import { projectInspectionPoint, type InspectionCamera } from '@/cinema/inspectionSpace';
import { filmViewportTransform } from '@/cinema/filmViewport';
import { factoryCamera, factoryWorld, SMT_FACTORY_DEPTH, SMT_FACTORY_STATIONS, smtFactoryState } from '@/cinema/smtFactory';
import {
  createFactoryInteraction, focusFactoryStation, interactionCamera, orbitFactory, panFactory,
  pickFactoryStation, zoomFactory, type FactoryOrbit,
} from '@/cinema/smtFactoryInteraction';

const center = (station: typeof SMT_FACTORY_STATIONS[number]) => factoryWorld({
  x: station.x, y: station.height / 2, z: station.z - SMT_FACTORY_DEPTH / 2,
});
const baseOrbit: FactoryOrbit = { target: { x: -65, y: 100, z: 500 }, yaw: 0, pitch: .4, distance: 600 };

describe('manual SMT factory camera', () => {
  it.each([0, 1.5, 3.5, 5, 8, 14, 15.5, 17.5, 24, 33.5, 40, 48])
  ('takes over the running camera without moving the scene at %ss', time => {
    const interaction = createFactoryInteraction(time);
    const manual = interactionCamera(interaction.orbit), automatic = factoryCamera(smtFactoryState(time));
    expect(interaction.selectedKey).toBeNull();
    for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'focal', 'near'] as const) {
      expect(manual[key]).toBeCloseTo(automatic[key], 9);
    }
  });

  it('completes a full orbit and limits tilt without changing the pivot', () => {
    const camera = interactionCamera(baseOrbit);
    const rotated = orbitFactory(baseOrbit, 2 * Math.PI / .006, 0);
    const returned = interactionCamera(rotated);
    for (const axis of ['x', 'y', 'z'] as const) expect(returned[axis]).toBeCloseTo(camera[axis], 8);
    expect(rotated.target).toEqual(baseOrbit.target);
    expect(orbitFactory(baseOrbit, 0, 10000).pitch).toBe(1.35);
    expect(orbitFactory(baseOrbit, 0, -10000).pitch).toBe(.06);
    expect(interactionCamera(orbitFactory(baseOrbit, 120, 0)).x).not.toBe(camera.x);
  });

  it('zooms smoothly, reversibly and within near and far limits', () => {
    const closer = zoomFactory(baseOrbit, -120);
    expect(closer.distance).toBeLessThan(baseOrbit.distance);
    expect(zoomFactory(closer, 120).distance).toBeCloseTo(baseOrbit.distance, 9);
    let near = baseOrbit, far = baseOrbit;
    for (let count = 0; count < 20; count++) { near = zoomFactory(near, -2000); far = zoomFactory(far, 2000); }
    expect(near.distance).toBe(180);
    expect(far.distance).toBe(3500);
  });

  it('pans on the ground relative to the current heading and preserves height', () => {
    const rightDrag = panFactory(baseOrbit, 120, 0);
    expect(rightDrag.target.x).toBeLessThan(baseOrbit.target.x);
    expect(rightDrag.target.z).toBe(baseOrbit.target.z);
    const downDrag = panFactory(baseOrbit, 0, 100);
    expect(downDrag.target.z).toBeGreaterThan(baseOrbit.target.z);
    const turned = panFactory({ ...baseOrbit, yaw: Math.PI / 2 }, 120, 0);
    expect(turned.target.z).toBeGreaterThan(baseOrbit.target.z);
    for (const orbit of [rightDrag, downDrag, turned, panFactory(baseOrbit, 1e100, -1e100)]) {
      expect(orbit.target.y).toBe(baseOrbit.target.y);
      expect(orbit.target.x).toBeGreaterThanOrEqual(-700);
      expect(orbit.target.z).toBeGreaterThanOrEqual(-850);
      expect(Object.values(interactionCamera(orbit)).every(Number.isFinite)).toBe(true);
    }
  });

  it('centers every selected machine and keeps its complete cabinet inside the viewport', () => {
    for (const station of SMT_FACTORY_STATIONS) {
      for (const yaw of [0, .8, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const focused = focusFactoryStation(station, { ...baseOrbit, yaw });
        const camera = interactionCamera(focused), projected = projectInspectionPoint(camera, center(station));
        expect(projected.x).toBeCloseTo(640, 8);
        expect(projected.y).toBeCloseTo(360, 8);
        expect(focused.yaw).toBeCloseTo(yaw === Math.PI ? -Math.PI : yaw, 8);
        expect(focused.pitch).toBeGreaterThanOrEqual(baseOrbit.pitch);
        expect(focused.pitch).toBeLessThanOrEqual(1.35);
        for (const x of [station.x - station.width / 2, station.x + station.width / 2]) {
          for (const y of [0, station.height + 45]) {
            for (const z of [station.z - SMT_FACTORY_DEPTH, station.z]) {
              const corner = projectInspectionPoint(camera, factoryWorld({ x, y, z }));
              expect(corner.visible).toBe(true);
              expect(corner.x).toBeGreaterThan(0);
              expect(corner.x).toBeLessThan(1280);
              expect(corner.y).toBeGreaterThan(0);
              expect(corner.y).toBeLessThan(720);
            }
          }
        }
      }
    }
  });

  it.each([0, Math.PI, .8, -.65, Math.PI / 2, -Math.PI / 2])
  ('reveals all forty selected machines from a low camera heading of %s radians', yaw => {
    for (const station of SMT_FACTORY_STATIONS) {
      const focused = focusFactoryStation(station, { ...baseOrbit, yaw, pitch: .14 });
      const camera = interactionCamera(focused);
      expect(pickFactoryStation({ x: 640, y: 360 }, camera)?.key, station.key).toBe(station.key);
      expect(Math.sin(focused.yaw)).toBeCloseTo(Math.sin(yaw), 9);
      expect(Math.cos(focused.yaw)).toBeCloseTo(Math.cos(yaw), 9);
      expect(focused.pitch).toBeGreaterThanOrEqual(.14);
      expect(focused.pitch).toBeLessThanOrEqual(1.35);
    }
  });

  it.each(['L1-reflow', 'L1-unloader'])('raises the camera above earlier machines hiding %s', key => {
    const station = SMT_FACTORY_STATIONS.find(item => item.key === key)!;
    const focused = focusFactoryStation(station, { ...baseOrbit, yaw: 0, pitch: .14 });
    const lowCamera = interactionCamera({ ...focused, pitch: .14 });
    expect(pickFactoryStation({ x: 640, y: 360 }, lowCamera)?.key).not.toBe(station.key);
    expect(focused.pitch).toBeGreaterThan(.14);
    expect(pickFactoryStation({ x: 640, y: 360 }, interactionCamera(focused))?.key).toBe(station.key);
  });

  it.each([
    { key: 'L1-loader', yaw: 0, pitch: .14 },
    { key: 'L1-unloader', yaw: Math.PI, pitch: .14 },
    { key: 'L3-maoi', yaw: .65, pitch: 1.1 },
  ])('preserves the tilt when $key is already visible at heading $yaw', ({ key, yaw, pitch }) => {
    const station = SMT_FACTORY_STATIONS.find(item => item.key === key)!;
    const focused = focusFactoryStation(station, { ...baseOrbit, yaw, pitch });
    expect(focused.pitch).toBe(pitch);
    expect(pickFactoryStation({ x: 640, y: 360 }, interactionCamera(focused))?.key).toBe(key);
  });

  it('does not propagate invalid pointer deltas or non-finite camera input', () => {
    const broken: FactoryOrbit = { target: { x: NaN, y: Infinity, z: -Infinity }, yaw: Infinity,
      pitch: NaN, distance: NaN };
    for (const orbit of [orbitFactory(broken, NaN, Infinity), zoomFactory(broken, Infinity),
      panFactory(broken, NaN, Infinity), createFactoryInteraction(NaN).orbit]) {
      expect(Object.values(interactionCamera(orbit)).every(Number.isFinite)).toBe(true);
    }
    expect(orbitFactory(baseOrbit, NaN, Infinity).target).toEqual(baseOrbit.target);
    expect(zoomFactory(baseOrbit, NaN).distance).toBe(baseOrbit.distance);
  });
});

describe('SMT cabinet picking', () => {
  it('selects the loader when downstream equipment is occluded by its cabinet', () => {
    const camera: InspectionCamera = { x: -65, y: 80, z: -440, yaw: 0, pitch: 0, focal: 720, near: 35 };
    const downstream = SMT_FACTORY_STATIONS.find(station => station.key === 'L1-unloader')!;
    const projected = projectInspectionPoint(camera, { ...center(downstream), y: 80 });
    expect(pickFactoryStation(projected, camera)?.key).toBe('L1-loader');
  });

  it('selects the actual cabinet through its projection after rotating and changing lines', () => {
    for (const station of SMT_FACTORY_STATIONS) {
      const orbit = focusFactoryStation(station, { ...baseOrbit, yaw: .65, pitch: 1.1 });
      const camera = interactionCamera(orbit);
      expect(pickFactoryStation(projectInspectionPoint(camera, center(station)), camera)?.key).toBe(station.key);
    }
  });

  it.each([{ eyeX: 415, key: 'L1-loader', side: 'left' }, { eyeX: -65, key: 'L2-loader', side: 'right' }])
  ('selects equipment beyond the logical $side edge of an ultrawide viewport', ({ eyeX, key, side }) => {
    const station = SMT_FACTORY_STATIONS.find(item => item.key === key)!;
    const camera: InspectionCamera = { x: eyeX, y: 80, z: -440, yaw: 0, pitch: 0, focal: 720, near: 35 };
    const projected = projectInspectionPoint(camera, center(station));
    expect(projected.visible).toBe(true);
    if (side === 'left') expect(projected.x).toBeLessThan(0);
    else expect(projected.x).toBeGreaterThan(1280);
    const viewport = filmViewportTransform(2560, 1080, { bottomInset: 180 });
    const physicalX = viewport.offsetX + projected.x * viewport.scale;
    expect(physicalX).toBeGreaterThan(0);
    expect(physicalX).toBeLessThan(2560);
    expect(pickFactoryStation(projected, camera)?.key).toBe(key);
  });

  it('does not select machines through clear aisles, above cabinets, or behind the eye', () => {
    const camera: InspectionCamera = { x: 200, y: 80, z: -440, yaw: 0, pitch: 0, focal: 720, near: 35 };
    expect(pickFactoryStation({ x: 640, y: 360 }, camera)).toBeNull();
    expect(pickFactoryStation({ x: 640, y: 360 }, { ...camera, x: -65, y: 400 })).toBeNull();
    expect(pickFactoryStation({ x: 640, y: 360 }, { ...camera, x: -65, yaw: Math.PI })).toBeNull();
  });

  it('rejects geometry entirely clipped by the near plane and invalid screen inputs', () => {
    const camera: InspectionCamera = { x: -65, y: 80, z: -10, yaw: 0, pitch: 0, focal: 720, near: 5000 };
    expect(pickFactoryStation({ x: 640, y: 360 }, camera)).toBeNull();
    for (const point of [{ x: NaN, y: 360 }, { x: 640, y: Infinity }]) {
      expect(pickFactoryStation(point, { ...camera, near: 35 })).toBeNull();
    }
    expect(pickFactoryStation({ x: 640, y: 360 }, { ...camera, focal: NaN })).toBeNull();
  });
});
