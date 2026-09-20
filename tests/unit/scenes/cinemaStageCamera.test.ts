import { describe, expect, it } from 'vitest';
import { isStageChapter, poseSignature, stagePose, STAGE_CHAPTERS } from '@/cinema/stage/stageCamera';
import { STAGE_DEPTH, STAGE_WIDTH } from '@/cinema/stage/factoryLayout';

describe('무대 카메라', () => {
  it('공간 챕터만 연출을 받는다', () => {
    expect([...STAGE_CHAPTERS]).toEqual(['wave', 'visor', 'visorPan']);
    expect(isStageChapter('wave')).toBe(true);
    expect(isStageChapter('pie')).toBe(false);
  });

  it('공간 챕터는 시간에 따라 카메라가 움직인다', () => {
    const start = stagePose('visor', 0, 64);
    const end = stagePose('visor', 64, 64);
    expect(poseSignature(start)).not.toBe(poseSignature(end));
  });

  it('공간 챕터가 아니면 포즈가 시간과 무관하게 고정된다', () => {
    expect(poseSignature(stagePose('pie', 0, 28))).toBe(poseSignature(stagePose('pie', 27, 28)));
  });

  it('카메라와 시선이 건물 주변을 벗어나지 않는다', () => {
    for (const chapter of STAGE_CHAPTERS) {
      for (const t of [0, .25, .5, .75, 1]) {
        const pose = stagePose(chapter, t * 40, 40);
        expect(pose.target.x).toBeGreaterThan(-STAGE_WIDTH);
        expect(pose.target.x).toBeLessThan(STAGE_WIDTH * 2);
        expect(pose.target.z).toBeGreaterThan(-STAGE_DEPTH);
        expect(pose.target.z).toBeLessThan(STAGE_DEPTH * 2);
        expect(pose.position.y).toBeGreaterThan(0);
        expect(pose.fov).toBeGreaterThan(10);
        expect(pose.fov).toBeLessThan(90);
      }
    }
  });

  it('서명은 소수점 흔들림을 무시해 정지 화면을 다시 그리지 않는다', () => {
    const a = { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, fov: 45 };
    const b = { position: { x: 1.0001, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, fov: 45 };
    expect(poseSignature(a)).toBe(poseSignature(b));
  });

  it('구간을 벗어난 시간도 안전하게 처리한다', () => {
    expect(() => stagePose('wave', -5, 40)).not.toThrow();
    expect(poseSignature(stagePose('wave', -5, 40))).toBe(poseSignature(stagePose('wave', 0, 40)));
    expect(poseSignature(stagePose('wave', 999, 40))).toBe(poseSignature(stagePose('wave', 40, 40)));
  });
});
