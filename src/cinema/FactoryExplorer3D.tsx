'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './factoryExplorer3d.module.css';

/**
 * 마지막 챕터의 조작 가능한 3D 공장. `stage/factoryModel` 의 buildFactoryModel(T) 가 만드는 건물은
 * STAGE_WIDTH=60 · STAGE_DEPTH=40 (원점이 건물의 한쪽 모서리) 이라 중심은 (30, ., 20) 이다.
 * 카메라·컨트롤·그림자 값은 이 크기에 맞춰 계산했다 — 근거는 task-final-report.md 참고.
 * 렌더 파이프라인(그림자·PMREM·리사이즈·dispose)은 studio/FactoryStudio.tsx 를 그대로 옮겼다.
 */
const BUILDING_CENTER: readonly [number, number, number] = [30, 2.2, 20];
const BIRD_EYE_POSE = { position: [-44, 40, 54], target: BUILDING_CENTER } as const;
// 건물 한가운데를 가로지르는 통로(z 18~22) 안에 서서 동쪽 끝을 바라보는 시점.
// 시선이 거의 수평이면 OrbitControls 의 maxPolarAngle 에 걸려 카메라가 매 프레임 되밀리므로,
// 눈높이를 목표보다 충분히 높여 극각에 여유를 둔다.
const INSIDE_POSE = { position: [8, 2.6, 20], target: [50, 1.2, 20] } as const;
const CAMERA_FOV = 42;

/**
 * 사용자가 직접 조작하는 장면이라, 조작이 시작되면 필름 시계를 멈춰 화면이 저절로
 * 다음 장면으로 넘어가지 않게 한다. 바이저 장면이 쓰는 것과 같은 규약이다.
 */
export default function FactoryExplorer3D({ onManual }: { onManual?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const choose = useRef<(inside: boolean) => void>(() => {});
  const manual = useRef(onManual);
  manual.current = onManual;
  const [inside, setInside] = useState(false);
  const [status, setStatus] = useState('3D 공장 준비 중');
  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    async function start() {
      const [T, { OrbitControls }, { RoomEnvironment }, { buildFactoryModel }] = await Promise.all([
        import('three'), import('three/addons/controls/OrbitControls.js'),
        import('three/addons/environments/RoomEnvironment.js'), import('./stage/factoryModel'),
      ]);
      if (stopped || !host.current) return;
      const node = host.current;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      node.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', '회전과 확대가 가능한 3D 공장 전체 구역');
      const scene = new T.Scene(); scene.background = new T.Color('#17232a');
      const pmrem = new T.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const env = pmrem.fromScene(room, .04); scene.environment = env.texture; scene.environmentIntensity = .65;
      room.dispose(); pmrem.dispose();
      const camera = new T.PerspectiveCamera(CAMERA_FOV, 1, .1, 400);
      camera.position.set(...BIRD_EYE_POSE.position);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(...BIRD_EYE_POSE.target);
      controls.enableDamping = true; controls.dampingFactor = .07;
      // 조감도 거리(약 112) 보다 조금 더 물러날 수 있게, 벽 안까지는 바싹 붙을 수 있게 잡았다.
      controls.minDistance = 1.5; controls.maxDistance = 150; controls.maxPolarAngle = Math.PI * .495; // 내부 시점은 시선이 거의 수평이라 .48 로는 도달하지 못한다
      const model = buildFactoryModel(T); scene.add(model.root);
      const key = new T.DirectionalLight('#fff2dc', 3.8);
      key.position.set(10, 46, 55);
      key.target.position.set(BUILDING_CENTER[0], 0, BUILDING_CENTER[2]);
      scene.add(key.target); // DirectionalLight.target 은 씬에 넣어야 매 프레임 matrixWorld 가 갱신된다.
      key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
      // 건물 전체(60x40, 높이 ~4.3)를 key 위치에서 내려다본 view-space 범위는
      // x:[-36.2,36.2] y:[-24.4,27.3] z(깊이):[36.5,82.6] — 여기에 여유를 두고 잡았다.
      Object.assign(key.shadow.camera, { left: -42, right: 42, top: 32, bottom: -32, near: 20, far: 100 });
      key.shadow.camera.updateProjectionMatrix();
      key.shadow.normalBias = .025; key.shadow.bias = -.00015; key.shadow.radius = 4; scene.add(key);
      scene.add(new T.HemisphereLight('#e2f0ff', '#847969', 1.1));
      const ground = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshStandardMaterial({ color: '#17232a', roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(BUILDING_CENTER[0], -.43, BUILDING_CENTER[2]); ground.receiveShadow = true; scene.add(ground);
      const position = new T.Vector3(); const target = new T.Vector3(); let transition = false;
      choose.current = (enter) => {
        const pose = enter ? INSIDE_POSE : BIRD_EYE_POSE;
        position.set(pose.position[0], pose.position[1], pose.position[2]);
        target.set(pose.target[0], pose.target[1], pose.target[2]);
        transition = true;
      };
      const interrupt = () => { transition = false; manual.current?.(); };
      controls.addEventListener('start', interrupt);
      const resize = () => { const { width, height } = node.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); };
      const observer = new ResizeObserver(resize); observer.observe(node); resize();
      let frame = 0;
      // 필름 루프와 한 화면을 나눠 쓰므로 프레임이 고르지 않다. 프레임당 고정 비율로 보간하면
      // 느린 기기에서 전환이 몇 초씩 늘어져 목표 시점에 도착하기 전처럼 보인다. 경과 시간으로 맞춘다.
      let last = performance.now();
      const render = () => {
        const now = performance.now();
        const delta = Math.min(.1, (now - last) / 1000);
        last = now;
        if (transition) {
          const k = 1 - Math.pow(.02, delta); // 1초에 98% 접근
          camera.position.lerp(position, k); controls.target.lerp(target, k);
          if (camera.position.distanceTo(position) < .05) {
            camera.position.copy(position); controls.target.copy(target); transition = false;
          }
        }
        controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render);
      };
      render(); setStatus('드래그로 회전 · 휠로 확대 · 우클릭으로 이동');
      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); env.dispose();
        const mats = new Set<import('three').Material>();
        scene.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); } });
        mats.forEach(m => m.dispose());
        // renderer.dispose() 는 그림자맵(렌더타깃)을 해제하지 않는다 — 직접 해제하지 않으면
        // 마운트할 때마다 2048² 렌더타깃이 샌다.
        key.shadow.map?.dispose();
        renderer.dispose(); renderer.domElement.remove(); choose.current = () => {};
      };
    }
    void start().catch(error => { if (!stopped) setStatus(`3D 초기화 실패: ${error instanceof Error ? error.message : String(error)}`); });
    return () => { stopped = true; cleanup(); };
  }, []);

  return <div className={styles.overlay}>
    <div ref={host} className={styles.viewport} />
    <div className={styles.panel}>
      <p className={styles.status}>{status}</p>
      <nav className={styles.actions} aria-label="3D 시점">
        <button type="button" aria-pressed={!inside} onClick={() => { setInside(false); choose.current(false); }}>조감도</button>
        <button type="button" aria-pressed={inside} onClick={() => { setInside(true); choose.current(true); }}>내부 진입 ↗</button>
      </nav>
    </div>
  </div>;
}
