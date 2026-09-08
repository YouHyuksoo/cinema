import { describe, expect, it } from 'vitest';
import { pcbInspectionState, validatePcbInspectionData } from '@/cinema/pcbInspection';
import {
  DEFAULT_PCB_INSPECTION_DATA,
  PCB_DEFECT_CODES,
  type PcbInspectionData,
} from '@/cinema/pcbInspectionData';

describe('PCB inspection data and timeline', () => {
  const board = (components = DEFAULT_PCB_INSPECTION_DATA.components): PcbInspectionData => ({ ...DEFAULT_PCB_INSPECTION_DATA, components });
  it('uses actual failure count for the entire inspection interval and supports reverse seeking', () => {
    const defects = DEFAULT_PCB_INSPECTION_DATA.components.filter(c => !['none', 'uninspected'].includes(c.defect));
    for (const count of [0, 1, 2, 3]) {
      const data = board(defects.slice(0, count));
      for (let i = 0; i < count; i++) {
        const time = 4 + (i + 0.5) * 24 / count;
        expect(pcbInspectionState(time, data).selectedComponent?.id).toBe(defects[i].id);
        expect(pcbInspectionState(time, data).focus).toBe(1);
      }
      expect(pcbInspectionState(29, data).selectedComponent).toBeNull();
    }
    const earlier = pcbInspectionState(7);
    pcbInspectionState(32);
    expect(pcbInspectionState(7)).toEqual(earlier);
    expect(pcbInspectionState(0).phase).toBe('scan');
    expect(pcbInspectionState(4).focus).toBe(0);
    expect(pcbInspectionState(28).phase).toBe('summary');
    expect(pcbInspectionState(34.5).phase).toBe('fade');
    expect(pcbInspectionState(36).presence).toBe(0);
  });
  it('accepts empty boards and derives uninspected separately without inventing targets', () => {
    expect(pcbInspectionState(10, board([]))).toMatchObject({ validation: { valid: true }, counts: { total: 0, pass: 0, fail: 0, uninspected: 0 }, selectedComponent: null, focus: 0 });
    const component = { ...DEFAULT_PCB_INSPECTION_DATA.components[0], defect: 'uninspected' as const };
    expect(pcbInspectionState(10, board([component]))).toMatchObject({ counts: { total: 1, pass: 0, fail: 0, uninspected: 1 }, selectedComponent: null });
    const normal = board(DEFAULT_PCB_INSPECTION_DATA.components.map(component => ({ ...component, defect: 'none' })));
    expect(pcbInspectionState(10, normal)).toMatchObject({ counts: { total: normal.components.length, pass: normal.components.length, fail: 0, uninspected: 0 }, selectedComponent: null, failedComponents: [] });
  });
  it('visits more than three supplied failures without truncation and retreats before each transition', () => {
    const components = Array.from({ length: 7 }, (_, i) => ({ ...DEFAULT_PCB_INSPECTION_DATA.components[0], id: `U${i + 1}` }));
    const data = board(components);
    expect(pcbInspectionState(10, data).counts.fail).toBe(7);
    components.forEach((component, i) => {
      const state = pcbInspectionState(4 + (i + 0.5) * 24 / 7, data);
      expect(state.selectedComponent?.id).toBe(component.id);
      expect(state.focus).toBe(1);
    });
    expect(pcbInspectionState(4 + 0.99 * 24 / 7, data).focus).toBeLessThan(0.01);
    expect(pcbInspectionState(-10, data).time).toBe(0);
    expect(pcbInspectionState(99, data)).toMatchObject({ time: 36, selectedComponent: null, focus: 0, presence: 0 });
  });
  it('rejects malformed data, duplicate ids and rotated footprints crossing the board edge', () => {
    const component = DEFAULT_PCB_INSPECTION_DATA.components[0];
    for (const value of [null, {}, { ...board(), width: 0 }, { ...board(), thickness: Infinity }, board([component, component]), board([{ ...component, defect: 'bad' as never }]), board([{ ...component, x: NaN }]), board([{ ...component, x: board().width / 2 - 3, width: 2, height: 10, rotation: 90 }])]) {
      expect(validatePcbInspectionData(value).valid).toBe(false);
      expect(pcbInspectionState(NaN, value as PcbInspectionData)).toMatchObject({ counts: { total: 0, pass: 0, fail: 0, uninspected: 0 }, selectedComponent: null });
    }
  });
  it('derives the three distinct demo defects and stable counts from the component array', () => {
    const state = pcbInspectionState(0, DEFAULT_PCB_INSPECTION_DATA);
    expect(state.validation).toEqual({ valid: true });
    expect(state.counts).toEqual({ total: DEFAULT_PCB_INSPECTION_DATA.components.length, pass: expect.any(Number), fail: 3, uninspected: expect.any(Number) });
    expect(state.failedComponents.map(component => component.defect)).toEqual(['insufficient_solder', 'offset', 'bridge']);
    expect(new Set(state.failedComponents.map(component => component.process))).toEqual(new Set(['spi', 'maoi', 'aoi']));
    expect(PCB_DEFECT_CODES).toContain('none');
  });
});
