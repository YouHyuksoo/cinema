import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { chapterStart, FILM_CHAPTERS } from '@/cinema/filmProgram';
import { drawSignalFilm } from '@/cinema/drawSignalFilm';
import { buildFactoryModel } from '@/cinema/stage/factoryModel';
import { recordingCanvas } from '../support/recordingCanvas';

/**
 * 카메라 상수는 src/cinema/FactoryExplorer3D.tsx 의 BIRD_EYE_POSE 와 맞춘 값이다. 여기서
 * 상수를 그대로 되읊지 않고, 건물 바운딩 박스 + 실제 카메라 투영행렬로 "화면 안에 들어오는지"
 * 를 계산한다 — 그래서 카메라를 건물 쪽으로 당기면 이 테스트가 실패해야 한다.
 */
describe('공장 3D 챕터', () => {
  it('FILM_CHAPTERS 의 마지막 항목이 space3d 다', () => {
    expect(FILM_CHAPTERS.at(-1)?.id).toBe('space3d');
  });

  it('space3d 를 그려도 크래시하지 않는다 (renderers 표에 항목이 있다는 뜻)', () => {
    const canvas = recordingCanvas();
    const start = chapterStart('space3d');
    expect(() => drawSignalFilm(canvas.ctx, 1280, 720, start + 1)).not.toThrow();
    expect(canvas.calls.length).toBeGreaterThan(0);
  });

  describe('조감도 카메라가 건물 전체를 담는다', () => {
    const model = buildFactoryModel(T);
    const box = new T.Box3().setFromObject(model.root);
    const corners = [0, 1].flatMap(ix => [0, 1].flatMap(iy => [0, 1].map(iz => new T.Vector3(
      ix ? box.max.x : box.min.x, iy ? box.max.y : box.min.y, iz ? box.max.z : box.min.z,
    ))));

    /** 이 위치·타깃·fov 로 봤을 때, 건물 바운딩 박스 8개 꼭짓점 중 화면(NDC) 중심에서 가장 먼 값. 1 이하면 전부 화면 안. */
    const maxNdcExtent = (position: [number, number, number], target: [number, number, number], fov: number, aspect: number) => {
      const camera = new T.PerspectiveCamera(fov, aspect, .1, 400);
      camera.position.set(...position);
      camera.up.set(0, 1, 0);
      camera.lookAt(...target);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      const viewProjection = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      return Math.max(...corners.flatMap(corner => {
        const projected = corner.clone().applyMatrix4(viewProjection);
        return [Math.abs(projected.x), Math.abs(projected.y)];
      }));
    };

    // FactoryExplorer3D.tsx 의 BIRD_EYE_POSE / CAMERA_FOV 와 동일해야 한다.
    const POSITION: [number, number, number] = [-60, 50, 66];
    const TARGET: [number, number, number] = [30, 2.2, 20];
    const FOV = 42;

    it('정사각형·와이드 화면 모두에서 건물 8개 꼭짓점이 화면 안에 들어온다', () => {
      expect(maxNdcExtent(POSITION, TARGET, FOV, 1)).toBeLessThanOrEqual(1);
      expect(maxNdcExtent(POSITION, TARGET, FOV, 16 / 9)).toBeLessThanOrEqual(1);
      expect(maxNdcExtent(POSITION, TARGET, FOV, 0.9)).toBeLessThanOrEqual(1);
    });

    it('카메라를 건물 쪽으로 절반 당기면 화면 밖으로 나간다', () => {
      const halfway: [number, number, number] = [
        TARGET[0] + (POSITION[0] - TARGET[0]) * .5,
        TARGET[1] + (POSITION[1] - TARGET[1]) * .5,
        TARGET[2] + (POSITION[2] - TARGET[2]) * .5,
      ];
      expect(maxNdcExtent(halfway, TARGET, FOV, 1)).toBeGreaterThan(1);
      expect(maxNdcExtent(halfway, TARGET, FOV, 16 / 9)).toBeGreaterThan(1);
    });
  });
});
