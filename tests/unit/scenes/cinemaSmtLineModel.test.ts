import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildSmtLines, SMT_FLOOR_DEPTH, SMT_FLOOR_WIDTH, SMT_LINE_COUNT } from '@/cinema/smtLine/smtLineModel';

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
