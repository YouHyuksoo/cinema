import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildFactoryModel } from '@/cinema/stage/factoryModel';
import { STAGE_DEPTH, STAGE_ROOMS, STAGE_WIDTH } from '@/cinema/stage/factoryLayout';

describe('공장 모델', () => {
  const model = buildFactoryModel(T);

  it('구역마다 바닥 메시가 하나씩 있다', () => {
    expect(model.floors.size).toBe(STAGE_ROOMS.length);
    for (const room of STAGE_ROOMS) expect(model.floors.get(room.id)).toBeDefined();
  });

  it('모델이 건물 범위 안에 들어온다', () => {
    const box = new T.Box3().setFromObject(model.root);
    expect(box.min.x).toBeGreaterThanOrEqual(-1);
    expect(box.min.z).toBeGreaterThanOrEqual(-1);
    expect(box.max.x).toBeLessThanOrEqual(STAGE_WIDTH + 1);
    expect(box.max.z).toBeLessThanOrEqual(STAGE_DEPTH + 1);
  });

  it('구역마다 설비가 들어가 빈 방이 없다', () => {
    for (const room of STAGE_ROOMS) {
      const inside = model.root.children.filter(child =>
        child.position.x > room.x0 && child.position.x < room.x1
        && child.position.z > room.z0 && child.position.z < room.z1
        && child.position.y > .2);
      expect(inside.length, `${room.name} 이 비어 있다`).toBeGreaterThan(0);
    }
  });
});
