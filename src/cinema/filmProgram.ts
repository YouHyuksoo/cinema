import { SMT_FACTORY_SECONDS } from './smtFactory';
import { CORNER_FILM_SECONDS } from './cornerSequence';
import { RACE_CAR_SECONDS } from './raceCar';
import { PROCESS_NETWORK_SECONDS } from './processNetwork';
import { ENERGY_CORE_SECONDS } from './energyCore';
import { PRODUCT_INSPECTION_SECONDS } from './productInspection';
import { ENVIRONMENT_FILM_SECONDS } from './zoneEnvironment';
import { SPC_FILM_SECONDS } from './spcScene';

export const FILM_DURATIONS = { wave: ENVIRONMENT_FILM_SECONDS, gears: 28, scan: 22, unfold: 32, trace: 24, console: 28, visor: SMT_FACTORY_SECONDS, visorPan: 32,
  bars: 28, pie: 28, corners: CORNER_FILM_SECONDS, machine: RACE_CAR_SECONDS,
  network: PROCESS_NETWORK_SECONDS, energy: ENERGY_CORE_SECONDS, product: PRODUCT_INSPECTION_SECONDS, spc: SPC_FILM_SECONDS } as const;

export const FILM_CHAPTERS = [
  { id: 'wave', title: '온습도 모니터링', subtitle: '위아래 5개 ZONE의 온습도를 중앙에서 확대하고, 24시간 그래프에 이어 센서가 설치된 공간의 온도 히트맵을 보여줍니다.', duration: FILM_DURATIONS.wave, previewAt: 30 },
  { id: 'gears', title: '기어 연동', subtitle: '서로 맞물린 회전으로 공정 지표의 관계를 보여줍니다.', duration: FILM_DURATIONS.gears, previewAt: 18 },
  { id: 'scan', title: '설비 스캔', subtitle: '전체 흐름을 훑고 변화가 감지된 설비에 집중합니다.', duration: FILM_DURATIONS.scan, previewAt: 15 },
  { id: 'unfold', title: '지표 펼침', subtitle: '큰 숫자가 빛의 조각으로 풀려 차트가 되고, 자리를 옮겨 생산 종합 화면을 완성합니다.', duration: FILM_DURATIONS.unfold, previewAt: 28 },
  { id: 'trace', title: '변화 추적', subtitle: '워크오더 생성부터 SMT 8공정의 PCB 이동·불량 분리·양품 생산량 누적까지 추적합니다.', duration: FILM_DURATIONS.trace, previewAt: 16 },
  { id: 'console', title: '정보 콘솔', subtitle: '회전 부품이 연결되고 정보창에 텍스트가 박자에 맞춰 나타납니다.', duration: FILM_DURATIONS.console, previewAt: 17 },
  { id: 'visor', title: '바이저 3D', subtitle: '로더가 있는 라인 입구에서 공정 진행 방향을 바라보고 통로를 따라 이동하며 설비를 진단합니다.', duration: FILM_DURATIONS.visor, previewAt: 1.5 },
  { id: 'visorPan', title: '바이저 평면', subtitle: 'PCB 로더부터 언로더까지 SMT 8공정을 펼치고 리플로우 냉각부를 확대해 확인합니다.', duration: FILM_DURATIONS.visorPan, previewAt: 19 },
  { id: 'bars', title: '막대 비교', subtitle: '발광 눈금이 쌓이고 스캔 빛이 흐르며, 선택 라인이 앞으로 나와 목표·달성률·부족 수량을 펼칩니다.', duration: FILM_DURATIONS.bars, previewAt: 17 },
  { id: 'pie', title: '파이 구성', subtitle: '생산 비중을 조각으로 펼치고, 선택한 조각이 다가오며 구성 비율을 드러냅니다.', duration: FILM_DURATIONS.pie, previewAt: 17 },
  { id: 'corners', title: '코너 전개', subtitle: '네 정보를 우상·우하·좌상·좌하로 축소 이동한 뒤 중앙에 핵심 정보를 펼칩니다.', duration: FILM_DURATIONS.corners, previewAt: 34 },
  { id: 'machine', title: '투명 설비 분석', subtitle: '투명 레이싱카의 섀시·하이브리드 파워유닛·서스펜션·브레이크와 공기 흐름을 확인합니다.', duration: FILM_DURATIONS.machine, previewAt: 13 },
  { id: 'network', title: '살아 있는 공정망', subtitle: '빛이 공정을 따라 흐르고, 대기가 쌓인 병목 구간이 앞으로 다가옵니다.', duration: FILM_DURATIONS.network, previewAt: 15 },
  { id: 'energy', title: '에너지 파동', subtitle: '흐르는 에너지 파동과 입체 파워 게이지로 전력·생산량·효율을 확대해 보여줍니다.', duration: FILM_DURATIONS.energy, previewAt: 15 },
  { id: 'product', title: '제품 내부 검사', subtitle: '회전하는 제품의 외피를 열고 내부 치수·오차·공차 판정을 읽습니다.', duration: FILM_DURATIONS.product, previewAt: 17 },
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
  return start + (localTime + seconds) % chapter.duration;
}
