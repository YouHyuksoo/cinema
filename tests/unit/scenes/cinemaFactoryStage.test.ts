import { describe, expect, it } from 'vitest';
import { createFactoryStage } from '@/cinema/stage/factoryStage';

describe('무대 렌더러', () => {
  it('WebGL 을 쓸 수 없으면 null 을 돌려준다', async () => {
    const stage = await createFactoryStage();
    expect(stage).toBeNull();
  });
});
