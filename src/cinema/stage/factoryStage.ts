import type * as THREE from 'three';
import { STAGE_DEPTH, STAGE_WIDTH } from './factoryLayout';
import { buildFactoryModel } from './factoryModel';
import type { StagePose } from './stageCamera';

export interface FactoryStage {
  /** 무대를 그려 필름 캔버스의 배경으로 합성한다. */
  compose(ctx: CanvasRenderingContext2D, width: number, height: number, pose: StagePose): void;
  dispose(): void;
}

const MAX_SHADOW = 2048;

/**
 * three.js 와 WebGL 컨텍스트를 준비한다. 둘 중 하나라도 없으면 null 을 돌려주고,
 * 호출부는 합성 단계를 건너뛰어 기존 화면을 그대로 그린다.
 */
export async function createFactoryStage(): Promise<FactoryStage | null> {
  let T: typeof THREE;
  try {
    T = await import('three');
  }
  catch { return null; }

  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  if (!canvas) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  }
  catch { return null; }

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new T.Scene();
  scene.background = new T.Color('#17232a');
  const model = buildFactoryModel(T);
  scene.add(model.root);

  const key = new T.DirectionalLight('#fff2dc', 3.2);
  key.position.set(STAGE_WIDTH * .2, 70, STAGE_DEPTH * .8);
  key.castShadow = true;
  key.shadow.mapSize.set(MAX_SHADOW, MAX_SHADOW);
  Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = .025;
  scene.add(key);
  scene.add(new T.HemisphereLight('#e2f0ff', '#847969', 1.2));

  const camera = new T.PerspectiveCamera(45, 1, .1, 400);
  let sized = { width: 0, height: 0 };

  return {
    compose(ctx, width, height, pose) {
      if (width <= 0 || height <= 0) return;
      if (sized.width !== width || sized.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        sized = { width, height };
      }
      camera.fov = pose.fov;
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      ctx.drawImage(canvas, 0, 0, width, height);
    },
    dispose() {
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      });
      renderer.dispose();
    },
  };
}
