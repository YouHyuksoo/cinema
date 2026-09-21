'use client';

import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { smtHeatmapColorAt, type SmtHeatmapFloor, type SmtHeatmapSample, type SmtLine } from './smtLine/smtLineModel';
import { environmentHeatmapDomain } from './environmentHeatmap';
import { environmentReadingStatus, type EnvironmentZone, type ZoneEnvironmentData, ZONE_COUNT } from './zoneEnvironment';
import styles from './smtLineExplorer.module.css';

/**
 * 온습도(wave) 장면의 히트맵 구간(35초~장면 끝)을 대신하는 SMT 4개 라인 3D 공간.
 * `artifacts/smt-4line-space/scene.html` 시안을 그대로 옮긴다 — 지오메트리는 `smtLine/smtLineModel.ts`,
 * 렌더 파이프라인(그림자·리사이즈·dispose·경과시간 보간)은 FactoryExplorer3D.tsx 를 그대로 따른다.
 */
// 76×44m 바닥(smtLine/smtLineModel.ts 의 SMT_FLOOR_WIDTH/DEPTH) 의 중심 — FactoryExplorer3D 의
// BUILDING_CENTER 와 같은 이유로 값만 옮긴다: smtLineModel.ts 는 three/addons 를 정적 임포트하므로
// 이 컴포넌트 모듈 스코프에서 값을 가져오면 그 무거운 의존성이 동적 임포트 밖으로 새어 나간다.
const FLOOR_CENTER: readonly [number, number, number] = [38, 0, 22];
const OVERVIEW_POSE = { position: [-19, 34, 56], target: FLOOR_CENTER } as const;
const WALK_START_POSITION: readonly [number, number, number] = [8, 1.72, 11];
const WALK_START_LOOKAT: readonly [number, number, number] = [20, 1.2, 11];
const WALK_EYE_HEIGHT = 1.72;
const CAMERA_FOV = 46;

type ViewMode = 'orbit' | 'walk';
interface LineButton { index: number; z: number; stations: readonly string[]; center: readonly [number, number, number] }

/** 히트맵 평면을 다시 칠하고 핀 위치 온도 팻말을 갱신한다 — 2D 히트맵과 같은 색·보간 규칙
 * (environmentHeatmap.ts)을 그대로 쓴다. 씬은 그대로 두고 캔버스/재질만 갱신한다. */
function paintHeatmap(heatmap: SmtHeatmapFloor, zones: readonly EnvironmentZone[]) {
  const domain = environmentHeatmapDomain(zones);
  const samples: SmtHeatmapSample[] = zones.map(zone => ({ id: zone.id,
    temperature: environmentReadingStatus(zone.temperature, zone.temperatureRange) === 'missing' ? null : zone.temperature }));
  heatmap.repaint(samples, domain);
  for (const label of heatmap.labels) {
    const pin = heatmap.pins.find(item => item.id === label.id);
    if (!pin) continue;
    const { temperature, color } = smtHeatmapColorAt(heatmap.pins, samples, domain, pin.x, pin.z);
    label.paintLabel(temperature === null ? '--' : `${temperature.toFixed(1)}℃`, color);
  }
}

/** 사용자가 직접 조작하는 장면이라, 조작이 시작되면 필름 시계를 멈춰 화면이 저절로
 * 다음 장면으로 넘어가지 않게 한다. FactoryExplorer3D 와 같은 규약이다. */
export function SmtLineExplorer({ onManual, environment }: { onManual?: () => void; environment?: ZoneEnvironmentData }) {
  const host = useRef<HTMLDivElement>(null);
  const goOverview = useRef(() => {});
  const goLine = useRef((_line: LineButton) => {});
  const enterWalk = useRef(() => {});
  const manual = useRef(onManual);
  manual.current = onManual;
  // 마운트 시점의 스냅샷일 뿐이다 — 갱신은 아래 별도 useEffect(heatmapRef 경유)가 맡는다.
  const environmentRef = useRef(environment);
  environmentRef.current = environment;
  const heatmapRef = useRef<SmtHeatmapFloor | null>(null);
  const [mode, setModeState] = useState<ViewMode>('orbit');
  const [lines, setLines] = useState<LineButton[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('SMT 4개 라인 구성 중');

  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    async function start() {
      const [T, { OrbitControls }, { PointerLockControls }, { buildSmtLines }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/controls/PointerLockControls.js'),
        import('./smtLine/smtLineModel'),
      ]);
      if (stopped || !host.current) return;
      const node = host.current;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
      node.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', '회전과 확대, 내부 걷기가 가능한 SMT 4개 라인 3D 공간');
      const scene = new T.Scene();
      scene.background = new T.Color(0x07101a);
      scene.fog = new T.Fog(0x07101a, 90, 190);
      const camera = new T.PerspectiveCamera(CAMERA_FOV, 1, .1, 300);
      camera.position.set(...OVERVIEW_POSE.position);
      scene.add(new T.HemisphereLight(0xcce8ff, 0x172434, 2.4));
      const sun = new T.DirectionalLight(0xfff7e9, 3);
      sun.position.set(28, 54, 22); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 5, far: 140 });
      sun.shadow.camera.updateProjectionMatrix();
      scene.add(sun);
      const zoneSource = (environmentRef.current?.zones ?? []).slice(0, ZONE_COUNT);
      const model = buildSmtLines(T, zoneSource.map(zone => ({ id: zone.id, name: zone.name })));
      scene.add(model.root);
      setLines(model.lines.map((line: SmtLine) => ({ index: line.index, z: line.z, stations: line.stations,
        center: [line.center.x, line.center.y, line.center.z] })));
      paintHeatmap(model.heatmap, zoneSource);
      heatmapRef.current = model.heatmap;

      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.target.set(...OVERVIEW_POSE.target);
      orbit.enableDamping = true; orbit.minDistance = 12; orbit.maxDistance = 135;
      orbit.maxPolarAngle = Math.PI * .48; // 시선이 거의 수평인 시점은 이보다 커지므로, 옮기는 포즈마다 극각을 확인했다.
      orbit.update();

      const walk = new PointerLockControls(camera, renderer.domElement);
      const keys: Record<string, boolean> = {};
      const onKeyDown = (event: KeyboardEvent) => { keys[event.code] = true; };
      const onKeyUp = (event: KeyboardEvent) => { keys[event.code] = false; };
      addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp);
      const onCanvasClick = () => { if (modeRef.current === 'walk' && !walk.isLocked) walk.lock(); };
      renderer.domElement.addEventListener('click', onCanvasClick);

      const modeRef = { current: 'orbit' as ViewMode };
      const position = new T.Vector3(); const target = new T.Vector3(); let transitioning = false;
      const beginTransition = (pose: { position: readonly [number, number, number]; target: readonly [number, number, number] }) => {
        position.set(...pose.position); target.set(...pose.target); transitioning = true;
      };
      const interrupt = () => { transitioning = false; manual.current?.(); };
      orbit.addEventListener('start', interrupt);

      goOverview.current = () => {
        walk.unlock();
        setModeState('orbit'); modeRef.current = 'orbit'; orbit.enabled = true;
        setSelected(null); manual.current?.();
        beginTransition(OVERVIEW_POSE);
      };
      goLine.current = (line: LineButton) => {
        walk.unlock();
        setModeState('orbit'); modeRef.current = 'orbit'; orbit.enabled = true;
        setSelected(line.index); manual.current?.();
        beginTransition({ position: [0, 24, line.z + 28], target: line.center });
      };
      enterWalk.current = () => {
        transitioning = false;
        setModeState('walk'); modeRef.current = 'walk'; orbit.enabled = false; manual.current?.();
        camera.position.set(...WALK_START_POSITION); camera.lookAt(...WALK_START_LOOKAT);
      };

      const resize = () => {
        const { width, height } = node.getBoundingClientRect();
        renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize); observer.observe(node); resize();

      let frame = 0; let last = performance.now();
      const render = () => {
        const now = performance.now();
        const delta = Math.min(.1, (now - last) / 1000);
        last = now;
        if (transitioning) {
          const k = 1 - Math.pow(.02, delta); // 1초에 98% 접근 — FactoryExplorer3D 와 같은 경과시간 기반 보간.
          camera.position.lerp(position, k); orbit.target.lerp(target, k);
          if (camera.position.distanceTo(position) < .05) {
            camera.position.copy(position); orbit.target.copy(target); transitioning = false;
          }
        } else if (modeRef.current === 'walk' && walk.isLocked) {
          const speed = 8 * delta;
          if (keys.KeyW) walk.moveForward(speed);
          if (keys.KeyS) walk.moveForward(-speed);
          if (keys.KeyA) walk.moveRight(-speed);
          if (keys.KeyD) walk.moveRight(speed);
          camera.position.y = WALK_EYE_HEIGHT;
          camera.position.x = T.MathUtils.clamp(camera.position.x, 1, 75);
          camera.position.z = T.MathUtils.clamp(camera.position.z, 1, 43);
        }
        orbit.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render);
      };
      render(); setStatus('드래그로 회전 · 휠로 확대 · 라인 선택 · 내부 걷기는 WASD');

      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect();
        removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp);
        renderer.domElement.removeEventListener('click', onCanvasClick);
        if (walk.isLocked) walk.unlock(); // 챕터가 넘어가도 마우스 포인터가 붙잡힌 채로 남지 않게 한다.
        orbit.removeEventListener('start', interrupt);
        orbit.dispose(); walk.dispose();
        const mats = new Set<THREE.Material>();
        scene.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) { mesh.geometry.dispose(); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => mats.add(m)); }
        });
        mats.forEach(material => material.dispose());
        // 위 traverse 는 Mesh 의 geometry/material 만 훑는다 — 히트맵 캔버스 텍스처와 라벨 Sprite
        // 재질/텍스처는 Sprite 라 걸리지 않으므로 직접 해제한다.
        heatmapRef.current?.dispose(); heatmapRef.current = null;
        // renderer.dispose() 는 그림자맵(렌더타깃)을 해제하지 않는다 — 직접 해제하지 않으면
        // 마운트할 때마다 2048² 렌더타깃이 샌다.
        sun.shadow.map?.dispose();
        renderer.dispose(); renderer.domElement.remove();
        goOverview.current = () => {}; goLine.current = () => {}; enterWalk.current = () => {};
      };
    }
    void start().catch(error => { if (!stopped) setStatus(`3D 초기화 실패: ${error instanceof Error ? error.message : String(error)}`); });
    return () => { stopped = true; cleanup(); };
  }, []);

  // 실시간으로 바뀌는 온습도 데이터: 씬은 그대로 두고 히트맵 캔버스와 라벨만 다시 칠한다.
  useEffect(() => {
    if (!environment || !heatmapRef.current) return;
    paintHeatmap(heatmapRef.current, environment.zones.slice(0, ZONE_COUNT));
  }, [environment]);

  return <div className={styles.overlay}>
    <div ref={host} className={styles.viewport} data-mode={mode} />
    <aside className={styles.panel}>
      <h2 className={styles.title}>SMT PRODUCTION FLOOR</h2>
      <p className={styles.subtitle}>{status} · 76 × 44 m</p>
      <nav className={styles.modes} aria-label="시점 모드">
        <button type="button" aria-pressed={mode === 'orbit'} onClick={() => goOverview.current()}>둘러보기</button>
        <button type="button" aria-pressed={mode === 'walk'} onClick={() => enterWalk.current()}>내부 걷기</button>
      </nav>
      <div className={styles.lines} role="group" aria-label="생산 라인 선택">
        {lines.map(line => <button key={line.index} type="button" className={selected === line.index ? styles.active : undefined}
          aria-pressed={selected === line.index} onClick={() => goLine.current(line)}>
          <span>LINE {line.index}</span><small>58 m · 8 ST</small>
        </button>)}
      </div>
      <div className={styles.detail}>
        {selected === null
          ? <><b>전체 공정</b>4개 평행 라인 · 각 라인 58m<br />투입 → 인쇄/SPI → 마운터 → 리플로우 → AOI → ICT</>
          : <><b>LINE {selected}</b>{lines.find(line => line.index === selected)?.stations.join(' → ')}</>}
      </div>
    </aside>
    <p className={styles.help}><b>둘러보기</b> 드래그 회전 · 휠 확대<br /><b>내부 걷기</b> 화면 클릭 · WASD 이동 · ESC 해제</p>
    <div className={styles.crosshair} data-active={mode === 'walk'} />
  </div>;
}
