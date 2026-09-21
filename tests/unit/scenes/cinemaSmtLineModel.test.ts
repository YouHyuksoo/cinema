import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  buildSmtLines, SMT_FLOOR_DEPTH, SMT_FLOOR_WIDTH, SMT_LINE_COUNT, SMT_ZONE_COUNT, smtHeatmapColorAt, threeHslStyle,
} from '@/cinema/smtLine/smtLineModel';
import { environmentHeatmapDomain, environmentTemperatureColor } from '@/cinema/environmentHeatmap';
import { DEFAULT_ENVIRONMENT_DATA } from '@/cinema/zoneEnvironment';

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
