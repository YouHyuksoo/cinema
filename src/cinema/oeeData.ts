export interface OeeEquipment {
  id: string; name: string; plannedSeconds: number; stopSeconds: number;
  idealCycleSeconds: number; totalCount: number; goodCount: number;
}
export interface OeeData { name: string; period: string; equipment: readonly OeeEquipment[] }
export const OEE_SECONDS = 60;
export const DEFAULT_OEE_DATA: OeeData = {
  name: 'SMT LINE 01', period: '주간조 · 08:00–16:00 / 시드 데이터',
  equipment: [
    { id: 'printer', name: '스크린 프린터', plannedSeconds: 27000, stopSeconds: 1800, idealCycleSeconds: 12, totalCount: 1920, goodCount: 1896 },
    { id: 'mounter-1', name: '마운터 01', plannedSeconds: 27000, stopSeconds: 2400, idealCycleSeconds: 11, totalCount: 2010, goodCount: 1988 },
    { id: 'mounter-2', name: '마운터 02', plannedSeconds: 27000, stopSeconds: 4200, idealCycleSeconds: 11, totalCount: 1820, goodCount: 1780 },
    { id: 'mounter-3', name: '마운터 03', plannedSeconds: 27000, stopSeconds: 2100, idealCycleSeconds: 11, totalCount: 2090, goodCount: 2055 },
    { id: 'mounter-4', name: '마운터 04', plannedSeconds: 27000, stopSeconds: 3600, idealCycleSeconds: 11, totalCount: 1930, goodCount: 1898 },
    { id: 'mounter-5', name: '마운터 05', plannedSeconds: 27000, stopSeconds: 1500, idealCycleSeconds: 11, totalCount: 2180, goodCount: 2161 },
    { id: 'reflow', name: '리플로우', plannedSeconds: 27000, stopSeconds: 1200, idealCycleSeconds: 12, totalCount: 2020, goodCount: 2012 },
    { id: 'aoi', name: 'AOI 검사기', plannedSeconds: 27000, stopSeconds: 1600, idealCycleSeconds: 10, totalCount: 2240, goodCount: 2180 },
    { id: 'ict', name: 'ICT 검사기', plannedSeconds: 27000, stopSeconds: 2700, idealCycleSeconds: 10, totalCount: 2150, goodCount: 2107 },
    { id: 'fct', name: 'FCT 검사기', plannedSeconds: 27000, stopSeconds: 3300, idealCycleSeconds: 12, totalCount: 1780, goodCount: 1740 },
  ],
};
export function calculateOee(item: OeeEquipment) {
  const { plannedSeconds: planned, stopSeconds: stop, idealCycleSeconds: cycle, totalCount: total, goodCount: good } = item;
  const run = planned - stop;
  if (![planned, stop, cycle, total, good].every(Number.isFinite) || planned <= 0 || stop < 0 || run <= 0
    || cycle <= 0 || total <= 0 || good < 0 || good > total || cycle * total > run
    || !Number.isInteger(total) || !Number.isInteger(good)) return null;
  const availability = run / planned, performance = cycle * total / run, quality = good / total;
  return { availability, performance, quality, oee: availability * performance * quality,
    losses: [stop / planned, (run - cycle * total) / planned, cycle * (total - good) / planned] };
}
