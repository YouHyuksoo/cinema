/**
 * SMT 3D 좌측 패널(제목 영역)을 드래그로 옮기는 계산 — DESIGN.md 223/257행의 장면 메뉴 구체가 쓰는
 * 규약과 같다: 짧은 클릭(약 7px 이하 이동)은 드래그가 아니고, 화면 밖으로 완전히 나가지 않게
 * 클램프하며, 화면 크기가 바뀌면 이전 위치를 버리고 기본 자리로 돌아간다(호출부: SmtLineExplorer.tsx).
 * `filmMenuGlobe.ts`(GLOBE_DRAG_THRESHOLD / clampGlobeCenter / isGlobeDrag)와 같은 계산을 새로
 * 발명하지 않고, 사각형 패널 + "손잡이(제목) 영역은 항상 화면 안"이라는 다른 클램프 대상에 맞춰
 * 다시 썼다. three.js·DOM 에 의존하지 않는 순수 계산이라 노드 테스트에서 그대로 검증된다.
 */
export const SMT_PANEL_DRAG_THRESHOLD = 7;
/** 패널이 화면 밖으로 끌려나가도 손잡이(제목 영역)가 최소 이만큼은 남아 다시 잡을 수 있다. */
export const SMT_PANEL_MIN_VISIBLE = 40;

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Viewport { width: number; height: number }

/** 총 이동거리가 임계값을 넘어야 드래그다 — 그 전까지는 짧은 클릭으로 다룬다. */
export function isSmtPanelDrag(origin: Point, current: Point, threshold = SMT_PANEL_DRAG_THRESHOLD): boolean {
  return Math.hypot(current.x - origin.x, current.y - origin.y) > Math.max(0, threshold);
}

/**
 * `position` 은 패널 좌상단의 뷰포트 기준 목표 좌표(px)다. 가로는 손잡이가 최소 SMT_PANEL_MIN_VISIBLE
 * 만큼 화면 안에 남도록, 세로는 패널 상단(=제목이 있는 곳)이 화면 위로 넘어가지 않고 하단도
 * 최소한 손잡이 높이만큼은 보이도록 자리를 당긴다.
 */
export function clampSmtPanelPosition(position: Point, size: Size, viewport: Viewport): Point {
  const width = Math.max(0, viewport.width), height = Math.max(0, viewport.height);
  const minLeft = SMT_PANEL_MIN_VISIBLE - size.width;
  const maxLeft = Math.max(minLeft, width - SMT_PANEL_MIN_VISIBLE);
  const minTop = 0;
  const maxTop = Math.max(minTop, height - SMT_PANEL_MIN_VISIBLE);
  return {
    x: Math.max(minLeft, Math.min(maxLeft, position.x)),
    y: Math.max(minTop, Math.min(maxTop, position.y)),
  };
}
