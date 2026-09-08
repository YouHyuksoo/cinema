import { SMT_FACTORY_SECONDS } from './smtFactory';
import { CORNER_FILM_SECONDS } from './cornerSequence';
import { RACE_CAR_SECONDS } from './raceCar';
import { PROCESS_NETWORK_SECONDS } from './processNetwork';
import { ENERGY_CORE_SECONDS } from './energyCore';
import { PRODUCT_INSPECTION_SECONDS } from './productInspection';
import { ENVIRONMENT_FILM_SECONDS } from './zoneEnvironment';
import { SPC_FILM_SECONDS } from './spcScene';
import { TRACE_LOOP, TRACE_TIMING } from './workOrderTraceTiming';

export const FILM_DURATIONS = { wave: ENVIRONMENT_FILM_SECONDS, gears: 28, scan: 22, unfold: 32, trace: TRACE_TIMING.endAt, console: 28, visor: SMT_FACTORY_SECONDS, visorPan: 32,
  bars: 28, pie: 28, corners: CORNER_FILM_SECONDS, machine: RACE_CAR_SECONDS,
  network: PROCESS_NETWORK_SECONDS, energy: ENERGY_CORE_SECONDS, product: PRODUCT_INSPECTION_SECONDS, spc: SPC_FILM_SECONDS } as const;

export const FILM_CHAPTERS = [
  { id: 'wave', title: '온습도 모니터링', subtitle: '구역별 온습도 · 24시간 이력 · 온도 히트맵', duration: FILM_DURATIONS.wave, previewAt: 30 },
  { id: 'gears', title: '기어 연동', subtitle: '공정 지표 · 냉각 상태', duration: FILM_DURATIONS.gears, previewAt: 18 },
  { id: 'scan', title: '설비 스캔', subtitle: '설비 상태 · 온도 이탈 · 냉각 진단', duration: FILM_DURATIONS.scan, previewAt: 15 },
  { id: 'unfold', title: '지표 펼침', subtitle: '생산 달성 · 양품률 · 사이클 타임 · 생산 잔여', duration: FILM_DURATIONS.unfold, previewAt: 28 },
  { id: 'trace', title: '변화 추적', subtitle: '워크오더 · SMT 8공정 · 생산량 · 불량', duration: FILM_DURATIONS.trace, previewAt: 16, loop: TRACE_LOOP },
  { id: 'console', title: '정보 콘솔', subtitle: '설비 온도 · 냉각 계통 · 분석 정보', duration: FILM_DURATIONS.console, previewAt: 17 },
  { id: 'visor', title: '바이저 3D', subtitle: 'SMT 5개 라인 · 40대 설비 · 설비 진단', duration: FILM_DURATIONS.visor, previewAt: 1.5 },
  { id: 'visorPan', title: '바이저 평면', subtitle: 'SMT 8공정 · 리플로우 냉각부', duration: FILM_DURATIONS.visorPan, previewAt: 19 },
  { id: 'bars', title: '막대 비교', subtitle: '라인별 생산 실적 · 목표 · 달성률', duration: FILM_DURATIONS.bars, previewAt: 17 },
  { id: 'pie', title: '파이 구성', subtitle: '라인별 생산 비중 · 수량', duration: FILM_DURATIONS.pie, previewAt: 17 },
  { id: 'corners', title: '코너 전개', subtitle: '생산 달성 · 양품률 · 설비 가동 · 사이클 타임', duration: FILM_DURATIONS.corners, previewAt: 34 },
  { id: 'machine', title: '투명 설비 분석', subtitle: '레이싱카 · 파워유닛 · 서스펜션 · 브레이크', duration: FILM_DURATIONS.machine, previewAt: 13 },
  { id: 'network', title: '살아 있는 공정망', subtitle: '공정 처리능력 · 대기량 · 병목', duration: FILM_DURATIONS.network, previewAt: 15 },
  { id: 'energy', title: '에너지 파동', subtitle: '전력 · 생산량 · 효율', duration: FILM_DURATIONS.energy, previewAt: 15 },
  { id: 'product', title: '제품 내부 검사', subtitle: '부품 치수 · 오차 · 공차 판정', duration: FILM_DURATIONS.product, previewAt: 17 },
  { id: 'spc', title: 'SPC 분석', subtitle: 'X̄–R 관리도 · 히스토그램 · 공정능력', duration: FILM_DURATIONS.spc, previewAt: 30 },
] as const;

export type FilmChapter = (typeof FILM_CHAPTERS)[number];
export type FilmId = FilmChapter['id'];
export type PlaybackMode = 'sequence' | 'chapter';
export const isVisorChapter = (id: FilmId) => id === 'visor' || id === 'visorPan';
export const FILM_SECONDS = FILM_CHAPTERS.reduce((total, chapter) => total + chapter.duration, 0);

export function chapterStart(id: FilmId): number {
  let start = 0;
  for (const chapter of FILM_CHAPTERS) {
    if (chapter.id === id) return start;
    start += chapter.duration;
  }
  return 0;
}

export function chapterAt(time: number) {
  const position = ((time % FILM_SECONDS) + FILM_SECONDS) % FILM_SECONDS;
  let start = 0;
  for (const [index, chapter] of FILM_CHAPTERS.entries()) {
    if (position < start + chapter.duration) return { chapter, index, start, localTime: position - start };
    start += chapter.duration;
  }
  return { chapter: FILM_CHAPTERS[0], index: 0, start: 0, localTime: 0 };
}

export function advanceFilm(time: number, seconds: number, mode: PlaybackMode) {
  if (mode === 'sequence') return (time + seconds) % FILM_SECONDS;
  const { chapter, start, localTime } = chapterAt(time);
  if ('loop' in chapter) {
    const next = localTime + seconds;
    if (next >= 0 && next < chapter.loop.end) return start + next;
    const length = chapter.loop.end - chapter.loop.start;
    return start + chapter.loop.start + ((next - chapter.loop.end) % length + length) % length;
  }
  return start + (localTime + seconds) % chapter.duration;
}
