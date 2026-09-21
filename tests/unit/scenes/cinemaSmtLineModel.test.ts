import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildSmtLines, SMT_FLOOR_DEPTH, SMT_FLOOR_WIDTH, SMT_LINE_COUNT, SMT_ZONE_COUNT, threeHslStyle } from '@/cinema/smtLine/smtLineModel';
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

describe('SMT 3D 바닥의 환경 히트맵 구역', () => {
  const zoneInputs = DEFAULT_ENVIRONMENT_DATA.zones.map(zone => ({ id: zone.id, name: zone.name }));
  const model = buildSmtLines(T, zoneInputs);

  it('구역 바닥이 10개 만들어진다', () => {
    expect(model.zones).toHaveLength(SMT_ZONE_COUNT);
    expect(model.zones.map(z => z.id)).toEqual(zoneInputs.map(z => z.id));
  });

  it('구역마다 독립된 재질이다', () => {
    const materials = new Set(model.zones.map(zone => zone.material));
    expect(materials.size).toBe(model.zones.length);
  });

  it('구역 바닥이 서로 겹치지 않는다', () => {
    for (let i = 0; i < model.zones.length; i++) {
      for (let j = i + 1; j < model.zones.length; j++) {
        const a = model.zones[i].bounds, b = model.zones[j].bounds;
        const overlapsX = Math.abs(a.x - b.x) * 2 < a.width + b.width;
        const overlapsZ = Math.abs(a.z - b.z) * 2 < a.depth + b.depth;
        expect(overlapsX && overlapsZ, `구역 ${model.zones[i].id} 와 ${model.zones[j].id} 가 겹친다`).toBe(false);
      }
    }
  });

  it('온도를 바꾸면 해당 구역의 색만 environmentTemperatureColor 결과로 바뀐다', () => {
    // 새 모델로 각 검증을 독립시킨다 — 앞선 테스트가 material.color 를 건드리지 않았다는 전제에 기대지 않는다.
    const fresh = buildSmtLines(T, zoneInputs);
    const before = fresh.zones.map(zone => zone.material.color.getHexString());
    const domain = environmentHeatmapDomain(DEFAULT_ENVIRONMENT_DATA.zones);
    const { color } = environmentTemperatureColor(31.5, domain);
    const target = fresh.zones[3];
    target.material.color.setStyle(threeHslStyle(color));
    const after = fresh.zones.map(zone => zone.material.color.getHexString());
    const expectedHex = new T.Color().setStyle(threeHslStyle(color)).getHexString();
    // three.js Color.setStyle 은 hsl(H,S%,L%) 콤마 문법만 읽는다 — environmentTemperatureColor 가
    // 돌려주는 CSS4 공백 문법을 그대로 넘기면 파싱에 실패해 흰색(기본값)에 머문다. 이 단언은 그 회귀를 잡는다.
    expect(expectedHex).not.toBe('ffffff');
    expect(after[3]).toBe(expectedHex);
    expect(after[3]).not.toBe(before[3]);
    // 공유 재질로 되돌리면(또는 색 갱신을 빼면) 다른 구역까지 같이 바뀌어 여기서 실패해야 한다.
    after.forEach((hex, index) => { if (index !== 3) expect(hex).toBe(before[index]); });
  });

  it('threeHslStyle 은 CSS4 공백 hsl 문법을 three.js Color.setStyle 이 읽는 콤마 문법으로 바꾼다', () => {
    expect(threeHslStyle('hsl(45.32 88% 55%)')).toBe('hsl(45.32,88%,55%)');
    // 변환 없이 원본 문자열을 그대로 넘기면 three.js 가 파싱하지 못해 흰색(기본값)에 머문다.
    expect(new T.Color(0x123456).setStyle('hsl(45.32 88% 55%)').getHexString()).toBe('123456');
    expect(new T.Color(0x123456).setStyle(threeHslStyle('hsl(45.32 88% 55%)')).getHexString()).not.toBe('123456');
  });
});
