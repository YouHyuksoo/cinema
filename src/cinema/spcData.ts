import type { SpcData, SpcTarget } from './spcTypes';
import { pad2 } from './filmMath';

// Fixed illustrative diameter measurements, in acquisition order. Subgroup 18 has a mean shift;
// its internal range remains ordinary. These are simulation inputs, not production records.
const DIAMETER_SAMPLES = [
  [9.996, 10.006, 10.009, 10.014, 10.021],
  [9.994, 10.001, 10.006, 10.013, 10.019],
  [10.001, 10.008, 10.012, 10.018, 10.026],
  [9.997, 10.003, 10.008, 10.015, 10.023],
  [9.992, 10.001, 10.005, 10.011, 10.017],
  [9.999, 10.006, 10.010, 10.017, 10.025],
  [9.996, 10.002, 10.009, 10.013, 10.020],
  [10.002, 10.007, 10.014, 10.019, 10.029],
  [9.995, 10.003, 10.006, 10.012, 10.021],
  [9.999, 10.005, 10.011, 10.016, 10.026],
  [9.991, 9.999, 10.004, 10.010, 10.018],
  [9.997, 10.005, 10.010, 10.016, 10.022],
  [10.001, 10.008, 10.013, 10.019, 10.027],
  [9.993, 10.000, 10.006, 10.012, 10.019],
  [9.998, 10.004, 10.009, 10.015, 10.023],
  [9.996, 10.003, 10.008, 10.014, 10.021],
  [10.000, 10.007, 10.011, 10.017, 10.025],
  [10.036, 10.044, 10.047, 10.052, 10.056],
  [9.998, 10.004, 10.009, 10.015, 10.024],
  [9.994, 10.001, 10.006, 10.012, 10.020],
  [10.000, 10.007, 10.012, 10.018, 10.026],
  [9.997, 10.002, 10.008, 10.014, 10.023],
  [9.993, 10.001, 10.005, 10.011, 10.020],
  [9.999, 10.005, 10.011, 10.017, 10.026],
  [9.995, 10.002, 10.007, 10.013, 10.021],
] as const;

// Illustrative limits only. Production feeds must supply their own measurement specifications.
const SMT_TARGETS = [
  ['spi-height', 'SPI · 솔더 높이', 'μm', 120, 90, 150, 320],
  ['spi-volume', 'SPI · 솔더 체적', '%', 100, 70, 130, 410],
  ['spi-area', 'SPI · 도포 면적', '%', 100, 75, 125, 250],
  ['placement-x', '실장 · X 위치 편차', 'μm', 0, -50, 50, 480],
  ['placement-y', '실장 · Y 위치 편차', 'μm', 0, -50, 50, 570],
  ['reflow-peak', '리플로우 · 피크 온도', '°C', 245, 235, 255, 95],
  ['fct-voltage', 'FCT · 출력 전압', 'V', 5, 4.75, 5.25, 2.4],
  ['fct-current', 'FCT · 동작 전류', 'mA', 200, 180, 220, 180],
  ['ict-resistance', 'ICT · 저항', 'Ω', 1000, 950, 1050, 450],
  ['ict-capacitance', 'ICT · 정전 용량', 'nF', 100, 90, 110, 85],
] as const;

/** Independent deterministic acquisition histories, rather than rescaling one common trace. */
function targetSamples(targetIndex: number, nominal: number, scale: number) {
  if (targetIndex === 0) return DIAMETER_SAMPLES.map(values => values.map(value => nominal + (value - 10) * scale));
  let seed = (targetIndex + 1) * 7919;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const centeredNoise = () => (random() + random() + random() + random() - 2);
  return Array.from({ length: 25 }, (_, group) => {
    const position = group / 24;
    const trend = [
      0,
      -.011 + position * .018,
      Math.sin(group * .57) * .009,
      -.012 + (group >= 14 ? .018 : 0),
      .008 - position * .019,
      Math.sin(group * .3 + 1) * .006,
      .003 + (group === 9 ? .02 : 0),
      -.006 + position ** 2 * .02,
      -.008,
      .006 + Math.cos(group * .8) * .004,
    ][targetIndex] ?? 0;
    const groupOffset = centeredNoise() * .003;
    const spread = .006 + (targetIndex % 3) * .002 + (targetIndex === 8 ? position * .009 : 0);
    return Array.from({ length: 5 }, () => nominal + scale * (trend + groupOffset + centeredNoise() * spread));
  });
}
export const DEFAULT_SPC_TARGETS: readonly SpcTarget[] = SMT_TARGETS.map(([id, name, unit, nominal, lsl, usl, scale], targetIndex) => ({
  id, name, unit, nominal, lsl, usl, cpkTarget: 1.33,
  subgroups: targetSamples(targetIndex, nominal, scale).map((values, index) => ({ id: `SG-${pad2(index + 1)}`, values })),
}));
export const DEFAULT_SPC_DATA: SpcData = { ...DEFAULT_SPC_TARGETS[0], targets: DEFAULT_SPC_TARGETS };
