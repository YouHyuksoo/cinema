import { describe, expect, it } from 'vitest';
import { DEFAULT_MACHINE_DATA, MACHINE_FILM_SECONDS, MACHINE_PART_IDS, PHONE_FOCUS_ORDER, PHONE_PART_SIZE,
  PHONE_CLOSED_CENTRES, PHONE_CPU_ANCHOR, machineDrawOrder, machineLayerCentre, machineLayerPoint, machineLayerScale,
  machineMetricValid, machinePartCentre, machineProjection, machineReadingWarning, transparentMachineState,
  type MachinePartId, type MachineMetric, type MachineReading, type TransparentMachineState } from '@/cinema/transparentMachine';

const SETTLED_TIMES = [5, 9, 13, 17, 21, 25, 28];
function projectedCorners(id: MachinePartId, state: TransparentMachineState) {
  const size = PHONE_PART_SIZE[id], project = machineProjection(state);
  return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
    project(machineLayerPoint(id, { x: x * size.width / 2, y: y * size.height / 2, z: z * size.depth / 2 }, state)))));
}
function componentBounds(time: number) {
  const state = transparentMachineState(time);
  return MACHINE_PART_IDS.map(id => {
    const corners = projectedCorners(id, state);
    return { id, left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)),
      top: Math.min(...corners.map(point => point.y)), bottom: Math.max(...corners.map(point => point.y)) };
  });
}

describe('solid handset exploded assembly', () => {
  it('keeps internal parts behind the display until their projected silhouettes separate during opening and closing', () => {
    for (let tick = 0; tick <= 3600; tick++) {
      const time = tick / 100;
      const state = transparentMachineState(time), bounds = componentBounds(time);
      const display = bounds.find(item => item.id === 'display')!;
      for (const id of ['camera', 'battery', 'board', 'shell'] as const) {
        const part = bounds.find(item => item.id === id)!;
        const overlapX = Math.min(part.right, display.right) - Math.max(part.left, display.left);
        const overlapY = Math.min(part.bottom, display.bottom) - Math.max(part.top, display.top);
        if (overlapX > 0 && overlapY > 0) {
          const order = machineDrawOrder(state);
          expect(order.indexOf(id), `${id} crosses display at ${time}s`).toBeLessThan(order.indexOf('display'));
          // Check the entire conservative part volume, not just its centre plane.
          const partFront = machineLayerCentre(id, state).z - PHONE_PART_SIZE[id].depth / 2;
          const displayBack = machineLayerCentre('display', state).z + PHONE_PART_SIZE.display.depth / 2;
          expect(partFront, `${id} intersects display at ${time}s`).toBeGreaterThan(displayBack);
        }
      }
    }
  });
  it('quickly separates five components, focuses them in order and closes within the original 36 seconds', () => {
    expect(MACHINE_FILM_SECONDS).toBe(36);
    expect(MACHINE_PART_IDS).toEqual(['shell', 'camera', 'board', 'battery', 'display']);
    expect([9, 13, 17, 21, 25].map(time => transparentMachineState(time).selected)).toEqual(PHONE_FOCUS_ORDER);
    for (const time of [9, 13, 17, 21, 25]) {
      const state = transparentMachineState(time);
      expect(state.focus).toBe(1); expect(state.readout).toBe(1);
      expect(Object.values(state.openings).every(value => value === 1)).toBe(true);
    }
    expect(transparentMachineState(2.4).assemblyOpen).toBe(0);
    const departing = transparentMachineState(3.4);
    expect(departing.openings.shell).toBeGreaterThan(.8);
    for (let index = 1; index < MACHINE_PART_IDS.length; index++) {
      expect(departing.openings[MACHINE_PART_IDS[index - 1]]).toBeGreaterThan(departing.openings[MACHINE_PART_IDS[index]]);
    }
    expect(Object.values(transparentMachineState(4.76).openings).every(value => value === 1)).toBe(true);
    expect(transparentMachineState(29).assemblyOpen).toBe(1);
    expect(transparentMachineState(31).assemblyOpen).toBeGreaterThan(0);
    expect(transparentMachineState(31).assemblyOpen).toBeLessThan(1);
    expect(transparentMachineState(33).assemblyOpen).toBe(0);
    expect(transparentMachineState(27).selected).toBeNull();
    expect(transparentMachineState(36).presence).toBe(0);
  });

  it('restores the exact local stack at closure despite the continuously changing viewing angle', () => {
    const closed = transparentMachineState(0), restored = transparentMachineState(34);
    for (const id of MACHINE_PART_IDS) {
      const initial = machineLayerCentre(id, closed), final = machineLayerCentre(id, restored);
      expect(initial).toEqual(PHONE_CLOSED_CENTRES[id]); expect(final).toEqual(initial);
      expect(machineLayerScale(id, closed)).toBe(1); expect(machineLayerScale(id, restored)).toBe(1);
      const size = PHONE_PART_SIZE[id];
      for (const point of [{ x: 0, y: 0, z: 0 }, { x: size.width / 2, y: -size.height / 2, z: size.depth / 2 }]) {
        expect(machineLayerPoint(id, point, restored)).toEqual(machineLayerPoint(id, point, closed));
      }
    }
    expect(machineLayerCentre('camera', closed)).not.toEqual(machineLayerCentre('board', closed));
    expect(machineLayerCentre('battery', closed)).not.toEqual(machineLayerCentre('board', closed));
  });

  it('paints closed components behind the full display and respects physical plane order during focus', () => {
    for (const time of [0, 1.8, 34]) {
      expect(machineDrawOrder(transparentMachineState(time))).toEqual(['shell', 'camera', 'board', 'battery', 'display']);
    }
    for (const time of [3, 5, 9, 13, 17, 21, 25, 28, 31, 34]) {
      const state = transparentMachineState(time), order = machineDrawOrder(state);
      expect(new Set(order).size).toBe(MACHINE_PART_IDS.length);
      for (let index = 1; index < order.length; index++) {
        expect(machineLayerCentre(order[index - 1], state).z).toBeGreaterThanOrEqual(machineLayerCentre(order[index], state).z);
      }
      const lastPlane = machineLayerCentre(order[order.length - 1], state).z;
      expect(lastPlane).toBe(Math.min(...MACHINE_PART_IDS.map(id => machineLayerCentre(id, state).z)));
    }
    expect(machineDrawOrder(transparentMachineState(5)).at(-1)).toBe('display');
    expect(machineDrawOrder(transparentMachineState(9)).at(-1)).toBe('camera');
  });

  it('keeps camera and battery independent while the CPU anchor follows the actual scaled PCB transform', () => {
    expect(PHONE_PART_SIZE.camera).toMatchObject({ width: 48, height: 92 });
    expect(PHONE_PART_SIZE.board).toMatchObject({ width: 210, height: 378 });
    expect(PHONE_PART_SIZE.battery).toMatchObject({ width: 150, height: 212 });
    expect(PHONE_PART_SIZE.display).toMatchObject({ width: 240, height: 420 });
    for (const time of [0, 3.5, 5, 9, 13, 17, 21, 25, 31, 34]) {
      const state = transparentMachineState(time);
      expect(machinePartCentre('board', state)).toEqual(machineLayerPoint('board', PHONE_CPU_ANCHOR, state));
      for (const id of ['shell', 'camera', 'battery', 'display'] as const) {
        expect(machinePartCentre(id, state)).toEqual(machineLayerPoint(id, { x: 0, y: 0, z: 0 }, state));
      }
    }
    const pcbFocused = transparentMachineState(13), pcbRest = { ...pcbFocused, focus: 0 };
    for (const id of ['camera', 'battery'] as const) {
      expect(machineLayerCentre(id, pcbFocused)).toEqual(machineLayerCentre(id, pcbRest));
      expect(machineLayerPoint(id, { x: 10, y: -20, z: 4 }, pcbFocused))
        .toEqual(machineLayerPoint(id, { x: 10, y: -20, z: 4 }, pcbRest));
    }
  });

  it('makes each selected component at least ten percent larger through its real projected geometry', () => {
    for (const time of [9, 13, 17, 21, 25]) {
      const focused = transparentMachineState(time), neutral = { ...focused, focus: 0 };
      const selected = focused.selected!, project = machineProjection(focused);
      const front = project(machinePartCentre(selected, focused));
      const original = project(machinePartCentre(selected, neutral));
      expect(front.scale * machineLayerScale(selected, focused))
        .toBeGreaterThanOrEqual(original.scale * machineLayerScale(selected, neutral) * 1.10);
      expect(front.depth).toBeLessThan(original.depth);
      const width = PHONE_PART_SIZE[selected].width;
      const span = (state: TransparentMachineState) => {
        const left = project(machineLayerPoint(selected, { x: -width / 2, y: 0, z: 0 }, state));
        const right = project(machineLayerPoint(selected, { x: width / 2, y: 0, z: 0 }, state));
        return Math.hypot(right.x - left.x, right.y - left.y);
      };
      expect(span(focused)).toBeGreaterThanOrEqual(span(neutral) * 1.10);
      for (const id of MACHINE_PART_IDS.filter(id => id !== selected)) {
        expect(machineLayerCentre(id, focused)).toEqual(machineLayerCentre(id, neutral));
        expect(machineLayerScale(id, focused)).toBe(1);
      }
    }
  });

  it('keeps all eight actual component corners inside the fixed scene bounds throughout the animation', () => {
    for (let tick = 0; tick <= 720; tick++) {
      const time = tick * .05, state = transparentMachineState(time), project = machineProjection(state);
      for (const id of MACHINE_PART_IDS) {
        const points = [...projectedCorners(id, state), project(machinePartCentre(id, state))];
        for (const point of points) {
          const context = id + ' at ' + time + 's: ' + JSON.stringify(point);
          expect(Object.values(point).every(Number.isFinite), context).toBe(true);
          expect(point.x, context).toBeGreaterThanOrEqual(60);
          expect(point.x, context).toBeLessThanOrEqual(1220);
          expect(point.y, context).toBeGreaterThanOrEqual(120);
          expect(point.y, context).toBeLessThanOrEqual(610);
        }
      }
    }
  });

  it('keeps conservative component boxes separate at the settled open and focus poses', () => {
    for (const time of SETTLED_TIMES) {
      const boxes = componentBounds(time);
      for (let index = 0; index < boxes.length; index++) {
        for (const other of boxes.slice(index + 1)) {
          const box = boxes[index];
          const overlapX = Math.min(box.right, other.right) - Math.max(box.left, other.left);
          const overlapY = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
          expect(overlapX <= 0 || overlapY <= 0,
            'Conservative AABB overlap at ' + time + 's: ' + JSON.stringify({ box, other, overlapX, overlapY })).toBe(true);
        }
      }
    }
  });

  it('accepts structural parts without telemetry and derives metric warnings only from configured thresholds', () => {
    expect(DEFAULT_MACHINE_DATA.name).toBe('AURORA / EXPLODED HANDSET');
    expect(DEFAULT_MACHINE_DATA.parts.board.metrics.map(metric => metric.value)).toEqual([42.6, 2.84, 68]);
    expect(DEFAULT_MACHINE_DATA.parts.battery.metrics.map(metric => metric.value)).toEqual([3.85, 5050]);
    expect(DEFAULT_MACHINE_DATA.parts.display.metrics.map(metric => metric.value)).toEqual([620, 120]);
    for (const id of MACHINE_PART_IDS) expect(machineReadingWarning(DEFAULT_MACHINE_DATA.parts[id])).toBe(false);
    for (const id of ['shell', 'camera'] as const) {
      expect(DEFAULT_MACHINE_DATA.parts[id].metrics).toEqual([]);
      expect(DEFAULT_MACHINE_DATA.parts[id].description!.length).toBeGreaterThan(0);
    }
    const metric = DEFAULT_MACHINE_DATA.parts.board.metrics[0];
    expect(machineReadingWarning({ name: 'boundary', metrics: [{ ...metric, value: metric.warningAbove! }] })).toBe(true);
    expect(machineReadingWarning({ name: 'below', metrics: [{ ...metric, value: metric.warningAbove! - .001 }] })).toBe(false);
    expect(machineReadingWarning({ name: 'unconfigured', metrics: [{ ...metric, warningAbove: undefined, value: metric.max + 1 }] })).toBe(false);
  });

  it('flags invalid telemetry while distinguishing an explicit empty metrics array from missing data', () => {
    const metric = DEFAULT_MACHINE_DATA.parts.board.metrics[0];
    const invalid = [null, undefined, { ...metric, value: NaN }, { ...metric, value: Infinity },
      { ...metric, value: -1 }, { ...metric, max: 0 }, { ...metric, max: NaN },
      { ...metric, warningAbove: NaN }, { ...metric, warningAbove: -1 }, { ...metric, decimals: Infinity },
      { ...metric, decimals: -1 }, { ...metric, unit: '' }];
    for (const value of invalid) {
      expect(machineMetricValid(value as MachineMetric)).toBe(false);
      expect(machineReadingWarning({ name: 'invalid', metrics: [value as MachineMetric] })).toBe(true);
    }
    expect(machineReadingWarning({ name: 'structural part', metrics: [] })).toBe(false);
    for (const reading of [null, undefined, { name: 'missing' }, { name: 'sparse', metrics: Array(1) },
      { name: '', metrics: [] }]) expect(machineReadingWarning(reading as MachineReading)).toBe(true);
  });

  it('reconstructs opening and focused mesh points after backwards seeks and invalid clocks', () => {
    const snapshot = (time: number) => {
      const state = transparentMachineState(time);
      return { state, points: MACHINE_PART_IDS.map(id => ({
        center: machineLayerCentre(id, state), anchor: machinePartCentre(id, state), corners: projectedCorners(id, state),
      })) };
    };
    const expected = snapshot(13);
    for (const time of [35, 9, 0, 28, 3.5, 21]) snapshot(time);
    expect(snapshot(13)).toEqual(expected);
    expect(transparentMachineState(NaN)).toEqual(transparentMachineState(0));
    expect(transparentMachineState(-100)).toEqual(transparentMachineState(0));
    expect(transparentMachineState(Infinity)).toEqual(transparentMachineState(0));
    expect(transparentMachineState(100)).toEqual(transparentMachineState(36));
  });
});
