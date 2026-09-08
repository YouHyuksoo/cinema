import { describe, expect, it } from 'vitest';
import { FILM_DURATIONS } from '@/cinema/filmProgram';
import { SMT_LINE } from '@/cinema/smtLine';
import { TRACE_TIMING, TRACE_WORK_ORDER, workOrderTraceState } from '@/cinema/workOrderTrace';

const launchAt = (serial: number) => TRACE_TIMING.launchAt + (serial - 1) * TRACE_TIMING.unitInterval;
const exitAt = (serial: number, stageIndex: number) => launchAt(serial) + (stageIndex + 1) * TRACE_TIMING.stageDuration;

describe('work order production trace', () => {
  it('uses the canonical eight-machine sequence including post-mount MAOI', () => {
    const stages = workOrderTraceState(10).stages;
    expect(stages.map(stage => stage.equipment)).toEqual(SMT_LINE);
    expect(stages.map(stage => stage.equipment.id)).toEqual([
      'loader', 'printer', 'spi', 'mounter', 'maoi', 'reflow', 'aoi', 'unloader',
    ]);
    expect(stages[4].equipment.english).toBe('POST-MOUNT AOI');
    expect(TRACE_TIMING.endAt).toBe(FILM_DURATIONS.trace);
    expect(TRACE_TIMING.endAt).toBe(24);
  });

  it('creates the order before releasing any PCB and reports zero production before creation', () => {
    const before = workOrderTraceState(TRACE_TIMING.createdAt - .001);
    expect(before).toMatchObject({
      created: false, phase: 'creating', issued: 0, released: 0, notStarted: 0,
      inProcess: 0, completedGood: 0, defectCount: 0, progress: 0, yieldPercent: 0,
      units: [], events: [], latestEvent: undefined,
    });
    expect(before.stages.every(stage => stage.entered === 0 && !stage.active)).toBe(true);
    const created = workOrderTraceState(TRACE_TIMING.createdAt);
    expect(created).toMatchObject({ created: true, issued: 120, notStarted: 120, released: 0 });
    expect(created.units).toHaveLength(TRACE_WORK_ORDER.quantity);
    expect(created.units.every(unit => unit.status === 'waiting' && unit.stageIndex === -1)).toBe(true);
    expect(workOrderTraceState(TRACE_TIMING.launchAt)).toMatchObject({ phase: 'running', released: 1, inProcess: 1 });
  });

  it('moves each PCB through station boundaries before counting an unloaded good unit', () => {
    for (let stageIndex = 0; stageIndex < SMT_LINE.length; stageIndex++) {
      const entry = workOrderTraceState(launchAt(1) + stageIndex * TRACE_TIMING.stageDuration);
      expect(entry.units[0]).toMatchObject({ serial: 1, stageIndex, stageProgress: 0, status: 'processing' });
      const middle = workOrderTraceState(launchAt(1) + (stageIndex + .5) * TRACE_TIMING.stageDuration);
      expect(middle.units[0].stageProgress).toBeCloseTo(.5);
    }
    const firstOutput = exitAt(1, SMT_LINE.length - 1);
    expect(workOrderTraceState(firstOutput - .001).completedGood).toBe(0);
    expect(workOrderTraceState(firstOutput)).toMatchObject({ completedGood: 1 });
    expect(workOrderTraceState(firstOutput).units[0]).toMatchObject({ status: 'good', stageIndex: 7, stageProgress: 1 });
  });

  it('emits defects only at the correct inspection exit and removes those units from downstream work', () => {
    const expected = [
      { serial: 7, stageIndex: 2, label: '납량 부족' },
      { serial: 27, stageIndex: 4, label: '부품 위치 편차' },
      { serial: 83, stageIndex: 4, label: '부품 위치 편차' },
      { serial: 61, stageIndex: 6, label: '납땜 브리지' },
    ];
    for (const result of expected) {
      const at = exitAt(result.serial, result.stageIndex);
      const before = workOrderTraceState(at - .001);
      expect(before.events.some(event => event.serial === result.serial)).toBe(false);
      expect(before.units[result.serial - 1]).toMatchObject({ status: 'processing', stageIndex: result.stageIndex });
      const atExit = workOrderTraceState(at);
      expect(atExit.events).toContainEqual({ ...result, at });
      expect(atExit.latestEvent).toEqual({ ...result, at });
      expect(atExit.units[result.serial - 1]).toMatchObject({
        status: 'defect', stageIndex: result.stageIndex, defectStageIndex: result.stageIndex,
      });
      expect(workOrderTraceState(TRACE_TIMING.endAt).units[result.serial - 1]).toEqual(atExit.units[result.serial - 1]);
    }
    expect(workOrderTraceState(TRACE_TIMING.endAt).stages.map(stage => [stage.entered, stage.passed, stage.defects])).toEqual([
      [120, 120, 0], [120, 120, 0], [120, 119, 1], [119, 119, 0],
      [119, 117, 2], [117, 117, 0], [117, 116, 1], [116, 116, 0],
    ]);
  });

  it('conserves all issued PCBs and station counts throughout the entire scene', () => {
    for (let step = 0; step <= TRACE_TIMING.endAt * 100; step++) {
      const state = workOrderTraceState(step / 100);
      expect(state.issued).toBe(state.notStarted + state.inProcess + state.completedGood + state.defectCount);
      expect(state.released).toBe(state.inProcess + state.completedGood + state.defectCount);
      expect(state.units).toHaveLength(state.issued);
      expect(new Set(state.units.map(unit => unit.serial)).size).toBe(state.issued);
      expect(state.stages.reduce((sum, stage) => sum + stage.wip, 0)).toBe(state.inProcess);
      expect(state.events).toHaveLength(state.defectCount);
      for (const stage of state.stages) {
        expect(stage.entered).toBe(stage.passed + stage.defects + stage.wip);
        expect(stage.active).toBe(stage.wip > 0);
        if (stage.index > 0) expect(stage.entered).toBe(state.stages[stage.index - 1].passed);
      }
    }
  });

  it('accumulates released, good, and defect quantities without decreasing or double counting', () => {
    let previous = workOrderTraceState(0);
    for (let step = 1; step <= TRACE_TIMING.endAt * 20; step++) {
      const state = workOrderTraceState(step / 20);
      expect(state.released).toBeGreaterThanOrEqual(previous.released);
      expect(state.completedGood).toBeGreaterThanOrEqual(previous.completedGood);
      expect(state.defectCount).toBeGreaterThanOrEqual(previous.defectCount);
      expect(state.progress).toBeGreaterThanOrEqual(previous.progress);
      expect(state.yieldPercent).toBeGreaterThanOrEqual(0);
      expect(state.yieldPercent).toBeLessThanOrEqual(100);
      state.stages.forEach((stage, index) => {
        expect(stage.entered).toBeGreaterThanOrEqual(previous.stages[index].entered);
        expect(stage.passed).toBeGreaterThanOrEqual(previous.stages[index].passed);
        expect(stage.defects).toBeGreaterThanOrEqual(previous.stages[index].defects);
      });
      previous = state;
    }
  });

  it('finishes with 116 good units and four rejects before the final summary', () => {
    const lastOutputAt = exitAt(TRACE_WORK_ORDER.quantity, SMT_LINE.length - 1);
    expect(lastOutputAt).toBeCloseTo(19.54);
    expect(lastOutputAt).toBeLessThan(TRACE_TIMING.summaryAt);
    expect(workOrderTraceState(lastOutputAt - .001)).toMatchObject({ phase: 'running', completedGood: 115, inProcess: 1 });
    const completed = workOrderTraceState(lastOutputAt);
    expect(completed).toMatchObject({
      phase: 'complete', issued: 120, released: 120, notStarted: 0,
      inProcess: 0, completedGood: 116, defectCount: 4, progress: 1,
    });
    expect(completed.yieldPercent).toBeCloseTo(96.6666667);
    expect(completed.stages.every(stage => stage.wip === 0 && !stage.active)).toBe(true);
    expect(completed.events.map(event => event.at)).toEqual([...completed.events.map(event => event.at)].sort((a, b) => a - b));
  });

  it('reconstructs the same state after backward seeking and clamps invalid or out-of-range time', () => {
    const order = JSON.stringify(TRACE_WORK_ORDER), equipment = JSON.stringify(SMT_LINE);
    const initial = workOrderTraceState(8.31);
    workOrderTraceState(18); workOrderTraceState(24);
    expect(workOrderTraceState(8.31)).toEqual(initial);
    for (const time of [-100, NaN, Infinity, -Infinity]) expect(workOrderTraceState(time)).toEqual(workOrderTraceState(0));
    expect(workOrderTraceState(200)).toEqual(workOrderTraceState(TRACE_TIMING.endAt));
    const mutatedCopy = workOrderTraceState(24);
    mutatedCopy.events[0].label = 'changed by a consumer';
    expect(workOrderTraceState(24).events[0].label).toBe('납량 부족');
    expect(JSON.stringify(TRACE_WORK_ORDER)).toBe(order);
    expect(JSON.stringify(SMT_LINE)).toBe(equipment);
  });
});
