import type { SpcAnalysis, SpcData, SpcHistogramBin } from './spcTypes';

// d2/d3 for normally distributed observations, n=2..10:
// https://support.minitab.com/en-us/minitab/help-and-how-to/quality-and-process-improvement/control-charts/how-to/variables-charts-for-subgroups/r-chart/methods-and-formulas/estimating-sigma/
const RANGE_CONSTANTS: Readonly<Record<number, readonly [number, number]>> = {
  2: [1.128, .8525], 3: [1.693, .8884], 4: [2.059, .8798], 5: [2.326, .8641],
  6: [2.534, .8480], 7: [2.704, .8332], 8: [2.847, .8198], 9: [2.970, .8078], 10: [3.078, .7971],
};
const HISTOGRAM_BINS = 12;
const invalid = (reason: string): SpcAnalysis => ({ valid: false, reason });
const average = (values: readonly number[]) => {
  const origin = values[0];
  return origin + values.reduce((sum, value) => sum + (value - origin) / values.length, 0);
};

/** Equal-size Xbar/R estimates; no observations or subgroups are silently discarded. */
export function analyzeSpc(data: SpcData): SpcAnalysis {
  if (!data || typeof data !== 'object') return invalid('SPC 측정 데이터가 없습니다.');
  if (typeof data.name !== 'string' || !data.name.trim() || typeof data.unit !== 'string' || !data.unit.trim()) {
    return invalid('측정 항목 이름과 단위가 필요합니다.');
  }
  if (![data.nominal, data.lsl, data.usl, data.cpkTarget].every(Number.isFinite)
    || data.lsl >= data.usl || data.nominal < data.lsl || data.nominal > data.usl || data.cpkTarget <= 0) {
    return invalid('유효한 규격 하한·상한·공칭값과 양수 Cpk 목표가 필요합니다.');
  }
  if (!Array.isArray(data.subgroups) || data.subgroups.length < 2) {
    return invalid('동일한 크기의 부분군이 최소 2개 필요합니다.');
  }
  const subgroupSize = data.subgroups[0]?.values?.length ?? 0;
  if (!Number.isInteger(subgroupSize) || subgroupSize < 2 || subgroupSize > 10) {
    return invalid('Xbar/R 분석은 부분군당 2~10개 측정값을 지원합니다.');
  }
  const identifiers = new Set<string>();
  for (const group of data.subgroups) {
    if (!group || typeof group.id !== 'string' || !group.id.trim() || identifiers.has(group.id)) {
      return invalid('각 부분군에 서로 다른 식별자가 필요합니다.');
    }
    identifiers.add(group.id);
    if (!Array.isArray(group.values) || group.values.length !== subgroupSize) {
      return invalid('부분군의 측정값 개수가 서로 다르거나 누락되었습니다.');
    }
    for (const value of group.values) {
      if (!Number.isFinite(value)) return invalid('누락되거나 유효하지 않은 측정값이 있습니다.');
    }
  }

  const values = data.subgroups.flatMap(group => [...group.values]);
  const means = data.subgroups.map(group => average(group.values));
  const ranges = data.subgroups.map(group => Math.max(...group.values) - Math.min(...group.values));
  const mean = average(means), rbar = average(ranges);
  const [d2, d3] = RANGE_CONSTANTS[subgroupSize];
  const sigmaWithin = rbar / d2;

  // Estimated Shewhart limits from all supplied groups (no special-cause exclusion):
  // A2=3/(d2*sqrt(n)); D3=max(0,1-3*d3/d2); D4=1+3*d3/d2.
  // https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc311.htm
  const a2 = 3 / (d2 * Math.sqrt(subgroupSize));
  const xLower = mean - a2 * rbar, xUpper = mean + a2 * rbar;
  const rLower = Math.max(0, 1 - 3 * d3 / d2) * rbar, rUpper = (1 + 3 * d3 / d2) * rbar;
  // These remain reference estimates when outOfControl is true. The view must not declare capability.
  // https://www.itl.nist.gov/div898/handbook/pmc/section1/pmc16.htm
  const cp = sigmaWithin > 0 ? (data.usl - data.lsl) / (6 * sigmaWithin) : null;
  const cpk = sigmaWithin > 0 ? Math.min((data.usl - mean) / (3 * sigmaWithin), (mean - data.lsl) / (3 * sigmaWithin)) : null;
  if (![mean, rbar, sigmaWithin, xLower, xUpper, rLower, rUpper, ...means, ...ranges,
    ...(cp === null ? [] : [cp]), ...(cpk === null ? [] : [cpk])].every(Number.isFinite)) {
    return invalid('측정값이 계산 가능한 수치 범위를 벗어났습니다.');
  }

  const xViolations = means.map(value => value < xLower || value > xUpper);
  const rViolations = ranges.map(value => value < rLower || value > rUpper);
  const violatedGroups = means.map((_, index) => xViolations[index] || rViolations[index]);
  const violationCount = violatedGroups.filter(Boolean).length;
  let focusGroupIndex = violatedGroups.findIndex(Boolean);
  if (focusGroupIndex < 0) {
    focusGroupIndex = means.reduce((extreme, value, index) => Math.abs(value - mean) > Math.abs(means[extreme] - mean)
      ? index : extreme, 0);
  }

  let min = data.lsl, max = data.usl, outsideSpecs = 0;
  for (const value of values) {
    min = Math.min(min, value); max = Math.max(max, value);
    if (value < data.lsl || value > data.usl) outsideSpecs++;
  }
  const binWidth = (max - min) / HISTOGRAM_BINS;
  if (!Number.isFinite(binWidth) || binWidth <= 0) return invalid('히스토그램 축 범위를 계산할 수 없습니다.');
  const bins: SpcHistogramBin[] = Array.from({ length: HISTOGRAM_BINS }, (_, index) => ({
    lower: min + index * binWidth,
    upper: index === HISTOGRAM_BINS - 1 ? max : min + (index + 1) * binWidth,
    count: 0,
  }));
  if (bins.some(bin => bin.lower >= bin.upper)) return invalid('측정값의 자릿수에 비해 규격 범위가 너무 작습니다.');
  for (const value of values) {
    // Left-closed/right-open bins; the final bin also includes the exact domain maximum.
    const index = bins.findIndex(bin => value < bin.upper);
    bins[index < 0 ? bins.length - 1 : index].count++;
  }
  return {
    valid: true, subgroupSize, totalSamples: values.length, mean, rbar, sigmaWithin, cp, cpk,
    xbar: { values: means, lower: xLower, center: mean, upper: xUpper, violations: xViolations },
    r: { values: ranges, lower: rLower, center: rbar, upper: rUpper, violations: rViolations },
    histogram: { min, max, binWidth, peak: Math.max(...bins.map(bin => bin.count)), bins },
    violationCount, outOfControl: violationCount > 0, outsideSpecs, focusGroupIndex,
  };
}
