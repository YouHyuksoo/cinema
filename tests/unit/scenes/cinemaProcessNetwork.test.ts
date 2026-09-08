import { describe, expect, it } from 'vitest';
import { DEFAULT_PROCESS_DATA, processBottleneck, processCapacity, processFlowPoint, processNetworkState } from '@/cinema/processNetwork';

describe('living production network', () => {
  it('finds the bottleneck from capacity, cycle and queue rather than the node label', () => {
    expect(processBottleneck(DEFAULT_PROCESS_DATA)?.id).toBe('reflow');
    const nodes = DEFAULT_PROCESS_DATA.nodes.map(node => ({ ...node,
      cycleSeconds: node.id === 'load' ? 30 : 5, queue: node.id === 'load' ? 80 : 0, capacityPerHour: 720 }));
    expect(processBottleneck({ ...DEFAULT_PROCESS_DATA, nodes })?.id).toBe('load');
    expect(processCapacity(nodes[0])).toBe(120);
    expect(processBottleneck({ ...DEFAULT_PROCESS_DATA, nodes: [] })).toBeUndefined();
  });

  it('travels from the source to destination on every directed production filament', () => {
    for (const link of DEFAULT_PROCESS_DATA.links) {
      const from = DEFAULT_PROCESS_DATA.nodes.find(node => node.id === link.from)!.position;
      const to = DEFAULT_PROCESS_DATA.nodes.find(node => node.id === link.to)!.position;
      expect(processFlowPoint(from, to, 0, link.bend)).toEqual(from);
      expect(processFlowPoint(from, to, 1, link.bend)).toEqual(to);
      let previous = from.x;
      for (let step = 1; step <= 100; step++) {
        const point = processFlowPoint(from, to, step / 100, link.bend);
        expect(point.x).toBeGreaterThan(previous); previous = point.x;
        expect(Object.values(point).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('brings the focal process forward then zooms back to the complete network', () => {
    const wide = processNetworkState(4), close = processNetworkState(15), returned = processNetworkState(29.5);
    expect(wide.focus).toBe(0); expect(close.focus).toBe(1); expect(returned.focus).toBe(0);
    expect(close.target!.point.z).toBeLessThan(wide.target!.point.z - 100);
    expect(close.camera.scale).toBeGreaterThan(wide.camera.scale);
    expect(returned.camera.scale).toBe(wide.camera.scale);
    expect(returned.target!.point.z).toBe(wide.target!.point.z);
  });

  it('shows recovery only from supplied recovery values and restores them on backwards seek', () => {
    const recovered = processNetworkState(28), original = processNetworkState(15);
    expect(recovered.target!.reading).toEqual(DEFAULT_PROCESS_DATA.nodes[3].recovery);
    expect(original.target!.reading.queue).toBe(42);
    expect(recovered.lineCapacity).toBeGreaterThan(original.lineCapacity);
    const withoutRecovery = { ...DEFAULT_PROCESS_DATA, nodes: DEFAULT_PROCESS_DATA.nodes.map(node => ({ ...node, recovery: undefined })) };
    expect(processNetworkState(28, withoutRecovery).target!.reading.queue).toBe(42);
    expect(processNetworkState(28, withoutRecovery).recovery).toBe(0);
    expect(processNetworkState(15).nodes).toEqual(original.nodes);
  });

  it('announces recovery only when the line can actually meet the requested throughput', () => {
    const pending = processNetworkState(25), recovered = processNetworkState(27);
    expect(pending.recovery).toBeGreaterThan(.7);
    expect(pending.lineCapacity).toBeLessThan(DEFAULT_PROCESS_DATA.demandPerHour);
    expect(pending.flowRecovered).toBe(false);
    expect(recovered.lineCapacity).toBeGreaterThanOrEqual(DEFAULT_PROCESS_DATA.demandPerHour);
    expect(recovered.flowRecovered).toBe(true);
    const insufficient = { ...DEFAULT_PROCESS_DATA, nodes: DEFAULT_PROCESS_DATA.nodes.map(node => ({ ...node,
      recovery: node.recovery ? { ...node.recovery, capacityPerHour: 450 } : undefined })) };
    expect(processNetworkState(28, insufficient).recovery).toBe(1);
    expect(processNetworkState(28, insufficient).flowRecovered).toBe(false);
  });

  it('keeps downstream process cores out of the reserved right-hand reading area', () => {
    for (const time of [10, 13, 16, 21, 24, 26.5, 27.5]) {
      const state = processNetworkState(time);
      for (const node of state.nodes.filter(entry => !entry.selected)) {
        const point = state.project(node.point), radius = 47 * point.scale;
        expect(point.x + radius < 895 || point.y + radius < 210 || point.y - radius > 490,
          `${node.node.id} behind the reading at ${time}s`).toBe(true);
      }
    }
  });

  it('keeps all default node poses finite and visible through the complete scene', () => {
    for (let tick = 0; tick <= 320; tick++) {
      const state = processNetworkState(tick / 10);
      for (const node of state.nodes) {
        const point = state.project(node.point);
        expect(Object.values(point).every(Number.isFinite)).toBe(true);
        expect(point.y).toBeGreaterThan(130); expect(point.y).toBeLessThan(560);
      }
    }
    expect(processNetworkState(Number.NaN).time).toBe(0);
    expect(processNetworkState(Infinity).time).toBe(0);
  });
});
