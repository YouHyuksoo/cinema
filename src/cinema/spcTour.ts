import { SPC_FILM_SECONDS } from './spcScene';
import { analyzeSpc } from './spcStatistics';
import type { SpcAnalysis, SpcData } from './spcTypes';

const analyses = new WeakMap<SpcData, SpcAnalysis>();
export function spcTargetAnalysis(data: SpcData) {
  let result = analyses.get(data);
  if (!result) { result = analyzeSpc(data); analyses.set(data, result); }
  return result;
}

/** Visit every supplied target during one chapter; an empty feed stays empty. */
export function spcTour(data: SpcData, time: number) {
  const targets: readonly SpcData[] = data.targets ?? [data];
  const duration = SPC_FILM_SECONDS / Math.max(1, targets.length);
  const elapsed = Math.max(0, Number.isFinite(time) ? time : 0) % SPC_FILM_SECONDS;
  const index = Math.min(targets.length - 1, Math.floor(elapsed / duration));
  return { targets, index, target: targets[index], progress: (elapsed % duration) / duration };
}
