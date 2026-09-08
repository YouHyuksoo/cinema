import { describe, expect, it } from 'vitest';
import { analyzeSpc } from '@/cinema/spcStatistics';
import { DEFAULT_SPC_DATA } from '@/cinema/spcData';
import type { SpcData, ValidSpcAnalysis } from '@/cinema/spcTypes';

function fixture(groups: readonly (readonly number[])[], overrides: Partial<SpcData> = {}): SpcData {
  return { name: '검증 치수', unit: 'mm', nominal: 3, lsl: 0, usl: 6, cpkTarget: 1.33,
    subgroups: groups.map((values, index) => ({ id: `G${index + 1}`, values })), ...overrides };
}
function valid(data: SpcData): ValidSpcAnalysis {
  const result = analyzeSpc(data);
  expect(result.valid, result.valid ? undefined : result.reason).toBe(true);
  if (!result.valid) throw new Error(result.reason);
  return result;
}

describe('Xbar/R statistics and capability reference estimates', () => {
  it('matches a hand-calculated two-member subgroup example', () => {
    // Subgroup means 2,3,4 and ranges 2,2,2; d2=1.128, d3=.8525 (Minitab table).
    const result = valid(fixture([[1, 3], [2, 4], [3, 5]]));
    expect(result.totalSamples).toBe(6); expect(result.subgroupSize).toBe(2);
    expect(result.mean).toBe(3); expect(result.rbar).toBe(2);
    expect(result.xbar.values).toEqual([2, 3, 4]); expect(result.r.values).toEqual([2, 2, 2]);
    expect(result.sigmaWithin).toBeCloseTo(1.773049645390071, 12);
    expect(result.xbar.lower).toBeCloseTo(-.761206282907168, 12);
    expect(result.xbar.upper).toBeCloseTo(6.761206282907168, 12);
    expect(result.r.lower).toBe(0); expect(result.r.upper).toBeCloseTo(6.534574468085107, 12);
    expect(result.cp).toBeCloseTo(.564, 12); expect(result.cpk).toBeCloseTo(.564, 12);
    expect(result.outOfControl).toBe(false);
  });

  it('supports every equal subgroup size from two to ten with the corresponding within-sigma constant', () => {
    const d2 = [1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.970, 3.078];
    for (let size = 2; size <= 10; size++) {
      const readings = Array.from({ length: size }, (_, index) => 2 * index / (size - 1));
      const result = valid(fixture([readings, readings, readings]));
      expect(result.subgroupSize).toBe(size);
      expect(result.totalSamples).toBe(size * 3);
      expect(result.rbar).toBeCloseTo(2);
      expect(result.sigmaWithin).toBeCloseTo(2 / d2[size - 2], 12);
      expect(result.r.lower).toBeGreaterThanOrEqual(0);
      expect(result.r.lower).toBeLessThan(result.rbar);
      expect(result.r.upper).toBeGreaterThan(result.rbar);
      expect(result.outOfControl).toBe(false);
    }
  });

  it('preserves capability and control decisions when the same measurements change units and origin', () => {
    const original = valid(DEFAULT_SPC_DATA), scale = 1000, shift = 40;
    const converted = valid({ ...DEFAULT_SPC_DATA,
      nominal: DEFAULT_SPC_DATA.nominal * scale + shift, lsl: DEFAULT_SPC_DATA.lsl * scale + shift,
      usl: DEFAULT_SPC_DATA.usl * scale + shift,
      subgroups: DEFAULT_SPC_DATA.subgroups.map(group => ({ ...group, values: group.values.map(value => value * scale + shift) })),
    });
    expect(converted.mean).toBeCloseTo(original.mean * scale + shift, 8);
    expect(converted.rbar).toBeCloseTo(original.rbar * scale, 8);
    expect(converted.sigmaWithin).toBeCloseTo(original.sigmaWithin * scale, 8);
    expect(converted.cp).toBeCloseTo(original.cp!, 9);
    expect(converted.cpk).toBeCloseTo(original.cpk!, 9);
    expect(converted.xbar.lower).toBeCloseTo(original.xbar.lower * scale + shift, 8);
    expect(converted.xbar.upper).toBeCloseTo(original.xbar.upper * scale + shift, 8);
    expect(converted.r.upper).toBeCloseTo(original.r.upper * scale, 8);
    expect(converted.xbar.violations).toEqual(original.xbar.violations);
    expect(converted.r.violations).toEqual(original.r.violations);
    expect(converted.violationCount).toBe(original.violationCount);
    expect(converted.outsideSpecs).toBe(original.outsideSpecs);
    expect(converted.focusGroupIndex).toBe(original.focusGroupIndex);
    const changedGoal = valid({ ...DEFAULT_SPC_DATA, nominal: 9.97, cpkTarget: 2 });
    expect(changedGoal.cp).toBe(original.cp); expect(changedGoal.cpk).toBe(original.cpk);
  });

  it('preserves negative Cpk when the process mean lies outside either specification limit', () => {
    const above = valid(fixture([[12, 14], [13, 15]], { nominal: 5, lsl: 0, usl: 10 }));
    const below = valid(fixture([[-5, -3], [-4, -2]], { nominal: 5, lsl: 0, usl: 10 }));
    expect(above.mean).toBe(13.5); expect(below.mean).toBe(-3.5);
    expect(above.cp).toBeCloseTo(.94, 12);
    expect(above.cpk).toBeCloseTo(-.658, 12); expect(below.cpk).toBeCloseTo(-.658, 12);
    expect(above.outsideSpecs).toBe(4); expect(below.outsideSpecs).toBe(4);
  });

  it('leaves Cp and Cpk undefined for zero within variation while still reporting actual mean shifts', () => {
    const constant = valid(fixture([[10, 10], [10, 10]], { nominal: 10, lsl: 9.95, usl: 10.05 }));
    expect(constant.sigmaWithin).toBe(0); expect(constant.cp).toBeNull(); expect(constant.cpk).toBeNull();
    expect(constant.xbar.lower).toBe(10); expect(constant.xbar.upper).toBe(10);
    expect(constant.r.lower).toBe(0); expect(constant.r.upper).toBe(0);
    expect(constant.outOfControl).toBe(false); expect(constant.outsideSpecs).toBe(0);
    const shifted = valid(fixture([[10, 10], [10.1, 10.1]], { nominal: 10, lsl: 9.95, usl: 10.05 }));
    expect(shifted.cp).toBeNull(); expect(shifted.cpk).toBeNull();
    expect(shifted.violationCount).toBe(2); expect(shifted.outsideSpecs).toBe(2);
  });

  it('rejects missing, unequal, non-finite or unsupported samples and invalid specifications as a whole', () => {
    const good = fixture([[1, 2], [2, 3]]);
    const invalidInputs: unknown[] = [null, undefined, {}, { ...good, subgroups: undefined },
      fixture([]), fixture([[1, 2]]), fixture([[], []]), fixture([[1], [2]]),
      fixture([[1, 2], [2, 3, 4]]), fixture([Array(11).fill(1), Array(11).fill(2)]),
      fixture([[1, NaN], [2, 3]]), fixture([[1, Infinity], [2, 3]]),
      { ...good, subgroups: [{ id: 'G1', values: [1, undefined] }, good.subgroups[1]] },
      { ...good, subgroups: [{ id: 'G1', values: Array(2) }, good.subgroups[1]] },
      { ...good, subgroups: [good.subgroups[0], { id: 'G1', values: [2, 3] }] },
      { ...good, subgroups: [good.subgroups[0], null] }, { ...good, lsl: 6, usl: 0 },
      { ...good, lsl: 3, usl: 3 }, { ...good, lsl: NaN }, { ...good, usl: Infinity },
      { ...good, nominal: undefined }, { ...good, nominal: 7 }, { ...good, cpkTarget: 0 },
      { ...good, cpkTarget: NaN }, { ...good, unit: '' },
      fixture([[-1e308, 1e308], [-1e308, 1e308]]),
    ];
    for (const input of invalidInputs) {
      const result = analyzeSpc(input as SpcData);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('bins every observation once, including interval boundaries and both specification endpoints', () => {
    const data = fixture([[0, 12], [1, 11], [2, 10], [3, 9], [4, 8], [5, 7], [6, 12]],
      { lsl: 0, usl: 12, nominal: 6 });
    const result = valid(data);
    expect(result.histogram.bins).toHaveLength(12);
    expect(result.histogram.min).toBe(0); expect(result.histogram.max).toBe(12);
    expect(result.histogram.binWidth).toBe(1);
    expect(result.histogram.bins.map(bin => bin.count)).toEqual([...Array(11).fill(1), 3]);
    expect(result.histogram.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(14);
    expect(result.histogram.peak).toBe(3); expect(result.outsideSpecs).toBe(0);
    result.histogram.bins.forEach((bin, index) => {
      expect(bin.upper - bin.lower).toBeCloseTo(result.histogram.binWidth);
      if (index > 0) expect(bin.lower).toBe(result.histogram.bins[index - 1].upper);
    });
    const extended = valid(fixture([[0, 12], [-1, 13]], { lsl: 0, usl: 12, nominal: 6 }));
    expect(extended.histogram.min).toBe(-1); expect(extended.histogram.max).toBe(13);
    expect(extended.histogram.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(4);
    expect(extended.outsideSpecs).toBe(2);
  });

  it('counts each violating subgroup once and focuses the first violation or the most extreme stable mean', () => {
    const groups = Array.from({ length: 10 }, () => [0, 2]);
    groups[4] = [10, 30]; groups[8] = [-10, -8];
    const result = valid(fixture(groups, { lsl: -40, usl: 40, nominal: 0 }));
    expect(result.xbar.violations[4]).toBe(true); expect(result.r.violations[4]).toBe(true);
    expect(result.xbar.violations[8]).toBe(true); expect(result.r.violations[8]).toBe(false);
    expect(result.violationCount).toBe(2); expect(result.focusGroupIndex).toBe(4);
    expect(result.outsideSpecs).toBe(0);
    const stable = valid(fixture([[2, 4], [2.2, 4.2], [3.5, 5.5]]));
    expect(stable.outOfControl).toBe(false); expect(stable.focusGroupIndex).toBe(2);
  });

  it('provides a deterministic 125-measurement demo with subgroup 18 outside Xbar limits and ordinary ranges', () => {
    const data = Object.freeze({ ...DEFAULT_SPC_DATA, subgroups: Object.freeze(DEFAULT_SPC_DATA.subgroups.map(group =>
      Object.freeze({ ...group, values: Object.freeze([...group.values]) }))) });
    const result = valid(data);
    expect(data.subgroups).toHaveLength(25);
    expect(result.subgroupSize).toBe(5); expect(result.totalSamples).toBe(125);
    expect(result.histogram.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(125);
    expect(result.outOfControl).toBe(true); expect(result.violationCount).toBe(1); expect(result.focusGroupIndex).toBe(17);
    expect(result.xbar.violations.filter(Boolean)).toHaveLength(1); expect(result.xbar.violations[17]).toBe(true);
    expect(result.r.violations.every(violation => !violation)).toBe(true);
    expect(result.outsideSpecs).toBe(2);
    expect(result.cp).toBeGreaterThan(result.cpk!);
    expect(Number.isFinite(result.cpk)).toBe(true);
    expect(analyzeSpc(data)).toEqual(result);
  });
});
