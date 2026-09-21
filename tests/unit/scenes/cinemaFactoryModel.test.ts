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

  it('어떤 메시도 바닥 아래로 파묻히지 않는다', () => {
    // 바닥·벽을 포함해 씬의 모든 메시는 y=0 지면 위에 서 있어야 한다. 필터 없이
    // model.root 아래 모든 메시를 대상으로 한다 — 바닥(min y=0)과 벽(밑변 y=0)도
    // 이 불변식을 만족하므로 제외할 이유가 없고, 설비 서브박스 하나가 y 오프셋
    // 실수로 지면 아래에 놓이는 회귀를 이 단언이 잡는다.
    const EPS = 1e-6;
    model.root.traverse(object => {
      const mesh = object as T.Mesh;
      if (!mesh.isMesh) return;
      const box = new T.Box3().setFromObject(mesh);
      expect(box.min.y, `${mesh.name || '(이름 없는 설비 메시)'} 가 바닥 아래로 파묻혔다`)
        .toBeGreaterThanOrEqual(-EPS);
    });
  });
});
