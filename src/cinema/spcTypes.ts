export interface SpcSubgroup { id: string; values: readonly number[] }
export interface SpcData {
  name: string; unit: string; nominal: number; lsl: number; usl: number; cpkTarget: number;
  subgroups: readonly SpcSubgroup[];
}
export interface SpcControlSeries {
  values: number[]; lower: number; center: number; upper: number; violations: boolean[];
}
export interface SpcHistogramBin { lower: number; upper: number; count: number }
export interface ValidSpcAnalysis {
  valid: true; subgroupSize: number; totalSamples: number;
  mean: number; rbar: number; sigmaWithin: number; cp: number | null; cpk: number | null;
  xbar: SpcControlSeries; r: SpcControlSeries;
  histogram: { min: number; max: number; binWidth: number; peak: number; bins: SpcHistogramBin[] };
  violationCount: number; outOfControl: boolean; outsideSpecs: number; focusGroupIndex: number;
}
export type SpcAnalysis = ValidSpcAnalysis | { valid: false; reason: string };
