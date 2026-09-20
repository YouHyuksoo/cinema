import { describe, expect, it } from 'vitest';
// 테스트에서만 정적 import 로 three 를 쓴다 — 번들에는 영향이 없다.
import * as THREE from 'three';
import { STAGE_ROOMS } from '@/cinema/stage/factoryLayout';
import { buildFactoryModel } from '@/cinema/stage/factoryModel';
import { createFactoryStage } from '@/cinema/stage/factoryStage';

describe('무대 렌더러', () => {
  it('WebGL 을 쓸 수 없으면 null 을 돌려준다', async () => {
    const stage = await createFactoryStage();
    expect(stage).toBeNull();
  });

  it('구역마다 바닥 메시가 독립된 재질 인스턴스를 갖는다', () => {
    const model = buildFactoryModel(THREE);
    const [roomA, roomB] = STAGE_ROOMS;
    const meshA = model.floors.get(roomA.id);
    const meshB = model.floors.get(roomB.id);
    expect(meshA).toBeDefined();
    expect(meshB).toBeDefined();
    expect(meshA!.material).not.toBe(meshB!.material);
  });
});
