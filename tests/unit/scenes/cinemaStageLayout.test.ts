import { describe, expect, it } from 'vitest';
import {
  STAGE_ROOMS, STAGE_WALLS, STAGE_WIDTH, STAGE_DEPTH, STAGE_WALL_HEIGHT, STAGE_WALL_THICKNESS,
  roomArea, roomById, roomCenter, sensorAnchor,
} from '@/cinema/stage/factoryLayout';
import { DEFAULT_ENVIRONMENT_DATA } from '@/cinema/zoneEnvironment';

describe('무대 배치', () => {
  it('구역 10개가 온습도 데이터와 같은 id·이름을 쓴다', () => {
    expect(STAGE_ROOMS).toHaveLength(10);
    expect(STAGE_ROOMS.map(room => room.id)).toEqual(DEFAULT_ENVIRONMENT_DATA.zones.map(zone => zone.id));
    expect(STAGE_ROOMS.map(room => room.name)).toEqual(DEFAULT_ENVIRONMENT_DATA.zones.map(zone => zone.name));
  });

  it('모든 방이 건물 안에 있고 서로 겹치지 않는다', () => {
    for (const room of STAGE_ROOMS) {
      expect(room.x0).toBeGreaterThanOrEqual(0);
      expect(room.z0).toBeGreaterThanOrEqual(0);
      expect(room.x1).toBeLessThanOrEqual(STAGE_WIDTH);
      expect(room.z1).toBeLessThanOrEqual(STAGE_DEPTH);
      expect(room.x1).toBeGreaterThan(room.x0);
      expect(room.z1).toBeGreaterThan(room.z0);
    }
    for (const a of STAGE_ROOMS) for (const b of STAGE_ROOMS) {
      if (a.id === b.id) continue;
      const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
      expect(overlap, `${a.id} 와 ${b.id} 가 겹친다`).toBe(false);
    }
  });

  it('방 중심과 면적을 계산한다', () => {
    const first = STAGE_ROOMS[0];
    // 첫 방: x0=0, x1=12, z0=0, z1=18
    expect(roomCenter(first)).toEqual({ x: 6, y: 0, z: 9 });
    expect(roomArea(first)).toBe(216);
    expect(roomById('ZONE 01')?.name).toBe('자재 입고');
    expect(roomById('없는 구역')).toBeNull();
  });

  it('모든 내벽에 통행 개구부가 있다', () => {
    const inner = STAGE_WALLS.filter(wall => wall.kind === 'inner');
    expect(inner.length).toBeGreaterThan(0);
    for (const wall of inner) expect(wall.openings.length, `${wall.x0},${wall.z0} 벽에 문이 없다`).toBeGreaterThan(0);
  });

  it('개구부가 벽 길이를 넘지 않고 서로 겹치지 않는다', () => {
    for (const wall of STAGE_WALLS) {
      const length = Math.hypot(wall.x1 - wall.x0, wall.z1 - wall.z0);
      const sorted = [...wall.openings].sort((a, b) => a.at - b.at);
      let cursor = 0;
      for (const opening of sorted) {
        expect(opening.at).toBeGreaterThanOrEqual(cursor);
        expect(opening.at + opening.width).toBeLessThanOrEqual(length);
        expect(opening.y1).toBeGreaterThan(opening.y0);
        expect(opening.y1, `${wall.x0},${wall.z0} 벽의 개구부가 벽 높이를 초과한다`).toBeLessThanOrEqual(wall.height);
        cursor = opening.at + opening.width;
      }
    }
  });

  it('센서 위치는 해당 구역 안, 사람 키 높이에 있다', () => {
    STAGE_ROOMS.forEach((room, index) => {
      const anchor = sensorAnchor(index)!;
      expect(anchor.x).toBeGreaterThan(room.x0);
      expect(anchor.x).toBeLessThan(room.x1);
      expect(anchor.z).toBeGreaterThan(room.z0);
      expect(anchor.z).toBeLessThan(room.z1);
      expect(anchor.y).toBeCloseTo(2.6);
    });
    expect(sensorAnchor(99)).toBeNull();
  });

  it('치수 상수가 정확하다', () => {
    expect(STAGE_WIDTH).toBe(60);
    expect(STAGE_DEPTH).toBe(40);
    expect(STAGE_WALL_HEIGHT).toBe(4.2);
    expect(STAGE_WALL_THICKNESS).toBe(0.35);
  });

  it('U자 배치: 뒤 띠는 x가 왼쪽에서 오른쪽으로 증가한다', () => {
    // 뒤 띠: zone 0~4 (index 0~4)
    const backBand = STAGE_ROOMS.slice(0, 5);
    for (let i = 0; i < backBand.length - 1; i++) {
      expect(backBand[i].x0).toBeLessThan(backBand[i + 1].x0);
      expect(backBand[i].x1).toBeLessThan(backBand[i + 1].x1);
    }
  });

  it('U자 배치: 앞 띠는 x가 오른쪽에서 왼쪽으로 감소한다', () => {
    // 앞 띠: zone 5~9 (index 5~9)
    const frontBand = STAGE_ROOMS.slice(5, 10);
    for (let i = 0; i < frontBand.length - 1; i++) {
      expect(frontBand[i].x0).toBeGreaterThan(frontBand[i + 1].x0);
      expect(frontBand[i].x1).toBeGreaterThan(frontBand[i + 1].x1);
    }
  });

  it('공정 흐름의 시작과 끝이 같은 bay 열에 있다', () => {
    const first = STAGE_ROOMS[0]; // 자재 입고
    const last = STAGE_ROOMS[9];  // 완제품 보관
    expect(last.x0).toBe(first.x0);
    expect(last.x1).toBe(first.x1);
  });
});
