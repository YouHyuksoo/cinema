import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  buildSmtLines, SMT_FLOOR_DEPTH, SMT_FLOOR_WIDTH, SMT_LINE_COUNT, SMT_ZONE_COUNT, smtHeatmapColorAt, threeHslStyle,
} from '@/cinema/smtLine/smtLineModel';
import { smtHotspotOrder, smtHotspotTour, type SmtHotspotPose } from '@/cinema/smtLine/smtHotspotTour';
import { clampSmtPanelPosition, isSmtPanelDrag, SMT_PANEL_DRAG_THRESHOLD, SMT_PANEL_MIN_VISIBLE } from '@/cinema/smtLine/smtPanelDrag';
import { environmentHeatmapDomain, environmentTemperatureColor } from '@/cinema/environmentHeatmap';
import { ENVIRONMENT_HOTSPOT_DWELL } from '@/cinema/environmentHeatmapProjection';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_TIMING } from '@/cinema/zoneEnvironment';

/** "Mounter ×2" 는 실제로는 두 대다 — 시안 station 목록은 라벨 하나로 두 대를 요약한다. */
function physicalStationCount(stations: readonly string[]): number {
  return stations.reduce((total, station) => total + (station.includes('×2') ? 2 : 1), 0);
}

describe('SMT 4개 라인 3D 모델', () => {
  const model = buildSmtLines(T);

  it('라인이 4개이고 z 좌표가 서로 다르다', () => {
    expect(model.lines).toHaveLength(SMT_LINE_COUNT);
    const zValues = model.lines.map(line => line.z);
    expect(new Set(zValues).size).toBe(SMT_LINE_COUNT);
  });

  it('각 라인에 8개 공정이 모두 있다 (Loader→Printer→SPI→Mounter×2→Reflow→AOI→ICT)', () => {
    for (const line of model.lines) {
      expect(line.stations).toEqual(['Loader', 'Printer', 'SPI', 'Mounter ×2', 'Reflow', 'AOI', 'ICT']);
      expect(physicalStationCount(line.stations)).toBe(8);
    }
  });

  it('전체 모델이 76×44m 바닥 안에 들어온다', () => {
    model.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model.root);
    expect(box.min.x).toBeGreaterThanOrEqual(-1);
    expect(box.min.z).toBeGreaterThanOrEqual(-1);
    expect(box.max.x).toBeLessThanOrEqual(SMT_FLOOR_WIDTH + 1);
    expect(box.max.z).toBeLessThanOrEqual(SMT_FLOOR_DEPTH + 1);
  });

  it('바닥 슬래브를 제외한 모든 메시가 지면(y=0) 위에 있다', () => {
    // 바닥 슬래브는 상판이 y=0 이 되도록 y∈[-.4,0] 에 걸쳐 있다 — 시안 그대로다.
    // 그 외 모든 설비 메시는 지면 위에 서 있어야 한다.
    model.root.updateMatrixWorld(true);
    const EPS = 1e-6;
    let floorSeen = false;
    model.root.traverse(object => {
      const mesh = object as T.Mesh;
      if (!mesh.isMesh) return;
      const box = new T.Box3().setFromObject(mesh);
      if (mesh.name === 'smt-floor') {
        floorSeen = true;
        expect(box.max.y, '바닥 슬래브 상판은 지면과 같아야 한다').toBeCloseTo(0, 5);
        return;
      }
      expect(box.min.y, `${mesh.name || '(이름 없는 설비 메시)'} 가 지면 아래로 파묻혔다`).toBeGreaterThanOrEqual(-EPS);
    });
    expect(floorSeen, '바닥 슬래브 메시를 찾지 못했다').toBe(true);
  });
});

describe('SMT 3D 바닥의 환경 히트맵 (Round 2: 사각 타일이 아니라 연속 보간)', () => {
  const zoneInputs = DEFAULT_ENVIRONMENT_DATA.zones.map(zone => ({ id: zone.id, name: zone.name }));
  const domain = environmentHeatmapDomain(DEFAULT_ENVIRONMENT_DATA.zones);
  const samples = DEFAULT_ENVIRONMENT_DATA.zones.map(zone => ({ id: zone.id, temperature: zone.temperature }));

  it('센서 핀이 10개이고, 이름표(labels)도 핀과 1:1로 대응한다', () => {
    const model = buildSmtLines(T, zoneInputs);
    expect(model.heatmap.pins).toHaveLength(SMT_ZONE_COUNT);
    expect(model.heatmap.pins.map(pin => pin.id)).toEqual(zoneInputs.map(zone => zone.id));
    expect(model.heatmap.labels.map(label => label.id)).toEqual(zoneInputs.map(zone => zone.id));
  });

  it('센서 바로 위 지점의 색은 그 센서 온도의 environmentTemperatureColor 결과와 정확히 일치한다', () => {
    const model = buildSmtLines(T, zoneInputs);
    for (const pin of model.heatmap.pins) {
      const zone = DEFAULT_ENVIRONMENT_DATA.zones.find(item => item.id === pin.id)!;
      const result = smtHeatmapColorAt(model.heatmap.pins, samples, domain, pin.x, pin.z);
      expect(result.temperature).toBe(zone.temperature);
      expect(result.color).toBe(environmentTemperatureColor(zone.temperature, domain).color);
    }
  });

  it('인접한 두 센서 사이 중간 지점은 사각 경계로 뚝 끊기지 않고 두 값 사이로 부드럽게 번진다', () => {
    const model = buildSmtLines(T, zoneInputs);
    const [pinA, pinB] = model.heatmap.pins; // 같은 행의 인접 칸(자재 입고 23.2℃ / 자재 보관 22.8℃)
    expect(pinA.z).toBe(pinB.z); // 같은 행이라 중간점이 두 핀과 정확히 등거리다.
    const midX = (pinA.x + pinB.x) / 2;
    const midpoint = smtHeatmapColorAt(model.heatmap.pins, samples, domain, midX, pinA.z);
    const zoneA = DEFAULT_ENVIRONMENT_DATA.zones.find(z => z.id === pinA.id)!.temperature!;
    const zoneB = DEFAULT_ENVIRONMENT_DATA.zones.find(z => z.id === pinB.id)!.temperature!;
    const [lo, hi] = zoneA < zoneB ? [zoneA, zoneB] : [zoneB, zoneA];
    // 사각 타일이었다면 중간점은 두 값 중 하나와 같았을 것이다(경계에서 색이 뚝 끊김) — 여기서는 그 사이의
    // 새로운 값이어야, 즉 어느 한쪽 값과도 같지 않아야 "번짐"이 실제로 일어난 것이다.
    expect(midpoint.temperature).not.toBeNull();
    expect(midpoint.temperature!).toBeGreaterThan(lo);
    expect(midpoint.temperature!).toBeLessThan(hi);
    expect(midpoint.color).not.toBe(environmentTemperatureColor(zoneA, domain).color);
    expect(midpoint.color).not.toBe(environmentTemperatureColor(zoneB, domain).color);
  });

  it('히트맵 평면이 바닥 전체(76×44m)를 덮고, document 없는 테스트 환경에서도 repaint/dispose 가 예외 없이 동작한다', () => {
    const model = buildSmtLines(T, zoneInputs);
    model.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model.heatmap.mesh);
    expect(box.min.x).toBeCloseTo(0, 5); expect(box.max.x).toBeCloseTo(SMT_FLOOR_WIDTH, 5);
    expect(box.min.z).toBeCloseTo(0, 5); expect(box.max.z).toBeCloseTo(SMT_FLOOR_DEPTH, 5);
    expect(() => model.heatmap.repaint(samples, domain)).not.toThrow();
    expect(() => model.heatmap.dispose()).not.toThrow();
  });

  it('threeHslStyle 은 CSS4 공백 hsl 문법을 three.js Color.setStyle 이 읽는 콤마 문법으로 바꾼다', () => {
    expect(threeHslStyle('hsl(45.32 88% 55%)')).toBe('hsl(45.32,88%,55%)');
    // 변환 없이 원본 문자열을 그대로 넘기면 three.js 가 파싱하지 못해 흰색(기본값)에 머문다 — 히트맵
    // 캔버스 픽셀 색을 만들 때(readRgb) 이 함수를 거치지 않으면 전부 흰 바닥이 된다.
    expect(new T.Color(0x123456).setStyle('hsl(45.32 88% 55%)').getHexString()).toBe('123456');
    expect(new T.Color(0x123456).setStyle(threeHslStyle('hsl(45.32 88% 55%)')).getHexString()).not.toBe('123456');
  });
});

describe('SMT 3D 고온 구역 비행 연출 (Round 3-2: 2D 히트맵이 사라지며 함께 빠졌던 순회를 3D 로 복원)', () => {
  const zoneInputs = DEFAULT_ENVIRONMENT_DATA.zones.map(zone => ({ id: zone.id, name: zone.name }));
  const model = buildSmtLines(T, zoneInputs);
  const OVERVIEW: SmtHotspotPose = { position: [-19, 34, 56], target: [38, 0, 22] };

  it('온도가 가장 높은 구역부터 순서가 매겨진다', () => {
    const ordered = smtHotspotOrder(DEFAULT_ENVIRONMENT_DATA.zones, model.heatmap.pins);
    // DEFAULT_ENVIRONMENT_DATA 온도: [23.2,22.8,24.1,25.3,26.7,29.4,24.8,23.9,23.1,22.6] — index 5(29.4)가 최고.
    expect(ordered[0].id).toBe(DEFAULT_ENVIRONMENT_DATA.zones[5].id);
    for (let i = 1; i < ordered.length; i++) expect(ordered[i - 1].temperature).toBeGreaterThanOrEqual(ordered[i].temperature);
  });

  it('온도를 바꾸면 순회 순서도 따라 바뀐다', () => {
    const hotter = DEFAULT_ENVIRONMENT_DATA.zones.map((zone, index) => index === 0 ? { ...zone, temperature: 99 } : zone);
    const ordered = smtHotspotOrder(hotter, model.heatmap.pins);
    expect(ordered[0].id).toBe(DEFAULT_ENVIRONMENT_DATA.zones[0].id);
  });

  const ordered = smtHotspotOrder(DEFAULT_ENVIRONMENT_DATA.zones, model.heatmap.pins);
  const DWELL = ENVIRONMENT_HOTSPOT_DWELL;

  it('heatmapFull 이전에는 상공 평면에 머문다', () => {
    const frame = smtHotspotTour(ENVIRONMENT_TIMING.heatmapFull - 1, ordered, OVERVIEW);
    expect(frame.touring).toBe(false);
    expect(frame.active).toBeNull();
    expect(frame.pose).toEqual(OVERVIEW);
  });

  it('heatmapFull 직후에는 온도가 가장 높은 첫 구역이 활성이다(1/10)', () => {
    const frame = smtHotspotTour(ENVIRONMENT_TIMING.heatmapFull + .1, ordered, OVERVIEW);
    expect(frame.touring).toBe(true);
    expect(frame.active?.id).toBe(ordered[0].id);
    expect(frame.rank).toBe(1);
    expect(frame.total).toBe(ordered.length);
  });

  it('구역당 dwell(4.8초)을 다 채우면 다음 구역으로 넘어간다', () => {
    const justBefore = smtHotspotTour(ENVIRONMENT_TIMING.heatmapFull + DWELL - .01, ordered, OVERVIEW);
    const justAfter = smtHotspotTour(ENVIRONMENT_TIMING.heatmapFull + DWELL + .01, ordered, OVERVIEW);
    expect(justBefore.active?.id).toBe(ordered[0].id);
    expect(justAfter.active?.id).toBe(ordered[1].id);
    expect(justAfter.rank).toBe(2);
  });

  it('진입 구간은 사각 점프가 아니라 이전 구역 포즈와 다음 구역 포즈 사이를 부드럽게 지난다', () => {
    // index 1 은 실제 "이전 구역"이 있어 두 서로 다른 3D 지점 사이를 잇는 보간을 검증할 수 있다.
    const enterStart = ENVIRONMENT_TIMING.heatmapFull + DWELL; // index=1 진입 시작(local=0)
    const early = smtHotspotTour(enterStart + .01, ordered, OVERVIEW);
    const mid = smtHotspotTour(enterStart + .7, ordered, OVERVIEW); // 진입(1.4초)의 절반 지점
    const late = smtHotspotTour(enterStart + 1.4, ordered, OVERVIEW); // 진입 완료 → 판독 시작
    // 뚝 끊겨 둘 중 하나의 값과 같아지는 게 아니라, 그 사이의 새로운 좌표를 지나야 "부드러운 진입"이다.
    expect(mid.pose.position[0]).not.toBeCloseTo(early.pose.position[0], 3);
    expect(mid.pose.position[0]).not.toBeCloseTo(late.pose.position[0], 3);
    const minX = Math.min(early.pose.position[0], late.pose.position[0]);
    const maxX = Math.max(early.pose.position[0], late.pose.position[0]);
    expect(mid.pose.position[0]).toBeGreaterThan(minX);
    expect(mid.pose.position[0]).toBeLessThan(maxX);
  });

  it('전체 구역을 다 돈 뒤에는 상공으로 복귀해 그 자리에 머문다', () => {
    const afterAll = ENVIRONMENT_TIMING.heatmapFull + DWELL * ordered.length + 10;
    const frame = smtHotspotTour(afterAll, ordered, OVERVIEW);
    expect(frame.touring).toBe(false);
    expect(frame.active).toBeNull();
    expect(frame.pose.position[0]).toBeCloseTo(OVERVIEW.position[0], 5);
    expect(frame.pose.target[0]).toBeCloseTo(OVERVIEW.target[0], 5);
  });

  // Round 5-3: 순회가 끝나면 호출부(SmtLineExplorer.tsx)가 이 신호로 자동 회전으로 넘긴다.
  it('finished 는 순회 도중에는 false, 상공 복귀가 끝나 자리 잡은 뒤로는 true다', () => {
    expect(smtHotspotTour(ENVIRONMENT_TIMING.heatmapFull - 1, ordered, OVERVIEW).finished).toBe(false);
    expect(smtHotspotTour(ENVIRONMENT_TIMING.heatmapFull + .1, ordered, OVERVIEW).finished).toBe(false);
    // 복귀 비행 시작 직후(아직 상공에 닿기 전)에는 returning 은 true 여도 finished 는 아직 false 다.
    const returnStart = ENVIRONMENT_TIMING.heatmapFull + DWELL * ordered.length + .1;
    const midReturn = smtHotspotTour(returnStart, ordered, OVERVIEW);
    expect(midReturn.returning).toBe(true);
    expect(midReturn.finished).toBe(false);
    // 복귀(3초)가 끝나 자리 잡은 뒤로는 true.
    const settled = smtHotspotTour(returnStart + 3, ordered, OVERVIEW);
    expect(settled.returning).toBe(true);
    expect(settled.finished).toBe(true);
  });

  it('돌 구역이 하나도 없으면(온도값 전부 결측) 시작부터 finished 다 — 자동 회전으로 곧바로 넘어가야 한다', () => {
    const empty = smtHotspotTour(ENVIRONMENT_TIMING.heatmapFull + .1, [], OVERVIEW);
    expect(empty.finished).toBe(true);
    expect(empty.touring).toBe(false);
    expect(empty.active).toBeNull();
  });
});

describe('SMT 3D 좌측 패널 드래그 (Round 3-5)', () => {
  it('임계값(7px) 이하 이동은 드래그가 아니라 짧은 클릭으로 판정한다', () => {
    const origin = { x: 100, y: 100 };
    expect(isSmtPanelDrag(origin, { x: 100, y: 100 })).toBe(false);
    expect(isSmtPanelDrag(origin, { x: 104, y: 103 })).toBe(false); // hypot(4,3)=5 < 7
    expect(isSmtPanelDrag(origin, { x: 100 + SMT_PANEL_DRAG_THRESHOLD, y: 100 })).toBe(false); // 경계값은 아직 드래그가 아니다
    expect(isSmtPanelDrag(origin, { x: 108, y: 100 })).toBe(true);
  });

  it('화면 안에 있는 좌표는 그대로 둔다', () => {
    const position = { x: 200, y: 150 };
    const clamped = clampSmtPanelPosition(position, { width: 300, height: 400 }, { width: 1280, height: 800 });
    expect(clamped).toEqual(position);
  });

  it('화면 왼쪽/위로 나가는 좌표는 손잡이가 화면 안에 남도록 안으로 당겨진다', () => {
    const size = { width: 300, height: 400 };
    const viewport = { width: 1280, height: 800 };
    const farLeft = clampSmtPanelPosition({ x: -9999, y: 100 }, size, viewport);
    expect(farLeft.x).toBe(SMT_PANEL_MIN_VISIBLE - size.width); // 손잡이 쪽 SMT_PANEL_MIN_VISIBLE 만큼만 화면에 남는다
    expect(farLeft.x).toBeGreaterThan(-9999);
    const farUp = clampSmtPanelPosition({ x: 100, y: -9999 }, size, viewport);
    expect(farUp.y).toBe(0); // 제목이 있는 상단은 화면 위로 넘어가지 않는다
  });

  it('화면 오른쪽/아래로 나가는 좌표도 최소 손잡이만큼 화면 안에 남긴다', () => {
    const size = { width: 300, height: 400 };
    const viewport = { width: 1280, height: 800 };
    const farRight = clampSmtPanelPosition({ x: 99999, y: 100 }, size, viewport);
    expect(farRight.x).toBe(viewport.width - SMT_PANEL_MIN_VISIBLE);
    const farDown = clampSmtPanelPosition({ x: 100, y: 99999 }, size, viewport);
    expect(farDown.y).toBe(viewport.height - SMT_PANEL_MIN_VISIBLE);
  });

  it('뷰포트가 극단적으로 작아도(0×0 등 레이아웃 측정 전 순간) 유한한 값을 돌려준다', () => {
    const size = { width: 300, height: 400 };
    for (const viewport of [{ width: 0, height: 0 }, { width: -10, height: -10 }, { width: 5, height: 5 }]) {
      const clamped = clampSmtPanelPosition({ x: 50, y: 50 }, size, viewport);
      expect(Number.isFinite(clamped.x), `viewport=${JSON.stringify(viewport)}`).toBe(true);
      expect(Number.isFinite(clamped.y), `viewport=${JSON.stringify(viewport)}`).toBe(true);
    }
  });
});
