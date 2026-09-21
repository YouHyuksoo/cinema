'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type * as THREE from 'three';
import { smtHeatmapColorAt, type SmtHeatmapFloor, type SmtHeatmapSample, type SmtLine } from './smtLine/smtLineModel';
import { smtHotspotOrder, smtHotspotTour, type SmtHotspotEntry } from './smtLine/smtHotspotTour';
import { clampSmtPanelPosition, isSmtPanelDrag } from './smtLine/smtPanelDrag';
import { environmentHeatmapDomain } from './environmentHeatmap';
import { isLowPerformance } from './filmPerformanceMode';
import {
  environmentReadingStatus, ENVIRONMENT_TIMING, type EnvironmentZone, type ZoneEnvironmentData, ZONE_COUNT,
} from './zoneEnvironment';
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
const CAMERA_FOV = 46;
// Round 3-3: 약 15도 위에서 내려다보며 공장을 중심으로 천천히 도는 자동 회전. OVERVIEW_POSE 와
// 비슷한 수평거리(약 66m)를 반경으로 잡아 15도 앙각의 높이를 구했다 — 한 바퀴 60초는 "눈이 편한
// 정도"로 잡은 값이라, 실제 화면에서 보고 조정할 수 있게 상수로 뒀다.
const ORBIT_TOUR_RADIUS = 66;
const ORBIT_TOUR_ELEVATION = Math.PI / 12; // 15도
const ORBIT_TOUR_HEIGHT = ORBIT_TOUR_RADIUS * Math.tan(ORBIT_TOUR_ELEVATION);
const ORBIT_TOUR_PERIOD_SECONDS = 60;

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
export function SmtLineExplorer({ onManual, environment }: {
  onManual?: () => void; environment?: ZoneEnvironmentData;
}) {
  const host = useRef<HTMLDivElement>(null);
  const goOverview = useRef(() => {});
  const goLine = useRef((_line: LineButton) => {});
  const startHotspotTour = useRef(() => {});
  const startOrbitTour = useRef(() => {});
  const stopAutoDrive = useRef(() => {});
  const manual = useRef(onManual);
  manual.current = onManual;
  // 마운트 시점의 스냅샷일 뿐이다 — 갱신은 아래 별도 useEffect(heatmapRef 경유)가 맡는다.
  const environmentRef = useRef(environment);
  environmentRef.current = environment;
  const heatmapRef = useRef<SmtHeatmapFloor | null>(null);
  const hotspotOrderRef = useRef<SmtHotspotEntry[]>([]);
  // 카메라를 스스로 움직이는 두 자동 연출(고온 구역 순회 · 15도 자동 회전)은 동시에 돌지 않는다 —
  // 하나가 켜지면 다른 하나를 끄고, 사용자가 드래그·휠 등으로 직접 조작하면 둘 다 꺼진다.
  const autoDriveRef = useRef<'hotspot' | 'orbit' | null>(null);
  const [hotspot, setHotspot] = useState<{ name: string; temperature: number; rank: number; total: number; phase: string } | null>(null);
  const [orbitTouring, setOrbitTouring] = useState(false);
  const [lines, setLines] = useState<LineButton[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('SMT 4개 라인 구성 중');
  const helpRef = useRef<HTMLParagraphElement>(null);

  // 좌측 패널 드래그 이동(Round 3-5) — 장면 메뉴 구체(useFilmMenuGlobe.ts)와 같은 규약이다: 짧은
  // 클릭은 드래그가 아니고, pointermove 마다 getBoundingClientRect 를 다시 읽지 않으며(강제
  // 레이아웃 방지), 실제 스타일 반영은 rAF 로 프레임당 한 번만 한다. React state 가 아니라 ref +
  // 직접 DOM 스타일 쓰기를 쓰는 이유도 같다 — 드래그 중 리렌더를 만들지 않기 위해서다.
  const panelRef = useRef<HTMLElement>(null);
  const panelDragRef = useRef<{ pointerId: number; origin: { x: number; y: number }; rect: DOMRect;
    baseDx: number; baseDy: number; moved: boolean } | null>(null);
  const panelOffsetRef = useRef({ x: 0, y: 0 });
  const panelPendingRef = useRef<string | null>(null);
  const panelFrameRef = useRef(0);
  const applyPanelTransform = () => {
    panelFrameRef.current = 0;
    if (panelPendingRef.current === null || !panelRef.current) return;
    panelRef.current.style.transform = panelPendingRef.current;
    panelPendingRef.current = null;
  };
  const schedulePanelTransform = () => {
    if (!panelFrameRef.current) panelFrameRef.current = requestAnimationFrame(applyPanelTransform);
  };
  const onPanelHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation(); // 3D 캔버스의 OrbitControls 로 새지 않게 한다.
    if (!event.isPrimary || event.button !== 0 || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    panelDragRef.current = { pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, rect,
      baseDx: panelOffsetRef.current.x, baseDy: panelOffsetRef.current.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPanelHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const dragging = panelDragRef.current;
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const point = { x: event.clientX, y: event.clientY };
    // 총 이동거리가 임계값을 넘기 전까지는 짧은 클릭으로 다룬다 — 여기서 아무 것도 옮기지 않는다.
    if (!dragging.moved && !isSmtPanelDrag(dragging.origin, point)) return;
    dragging.moved = true;
    const raw = { x: dragging.rect.left + (point.x - dragging.origin.x), y: dragging.rect.top + (point.y - dragging.origin.y) };
    // window.innerWidth/Height 는 강제 레이아웃 없이 읽을 수 있다 — getBoundingClientRect 는
    // pointerdown 때 한 번만 쟀다(위 원칙: pointermove 마다 다시 재지 않는다).
    const clamped = clampSmtPanelPosition(raw, { width: dragging.rect.width, height: dragging.rect.height },
      { width: window.innerWidth, height: window.innerHeight });
    panelOffsetRef.current = { x: dragging.baseDx + (clamped.x - dragging.rect.left),
      y: dragging.baseDy + (clamped.y - dragging.rect.top) };
    panelPendingRef.current = `translate(${panelOffsetRef.current.x}px, ${panelOffsetRef.current.y}px)`;
    schedulePanelTransform();
  };
  const endPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panelDragRef.current = null;
  };

  // DESIGN.md 223행과 같은 규약 — 화면 크기가 바뀌면 이전 드래그 좌표를 버리고 기본 위치로
  // 되돌린다. 같은 크기에서는(예: 도크가 접히며 발생하는 다른 레이아웃 변화) 유지한다.
  useEffect(() => {
    let lastViewport = { width: window.innerWidth, height: window.innerHeight };
    const onResize = () => {
      const next = { width: window.innerWidth, height: window.innerHeight };
      if (next.width !== lastViewport.width || next.height !== lastViewport.height) {
        panelOffsetRef.current = { x: 0, y: 0 }; panelPendingRef.current = null;
        if (panelRef.current) panelRef.current.style.transform = '';
      }
      lastViewport = next;
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (panelFrameRef.current) cancelAnimationFrame(panelFrameRef.current);
    };
  }, []);

  // 조작 안내(.help)는 상단 우측 재생 컨트롤(FilmQuickMenu, data-scene-quick-menu) 바로 왼쪽에
  // 붙는다(c0d86ac). 그 메뉴는 MONITORING 라벨(온습도 90초 이후, ENVIRONMENT_TIMING.monitoringStart)이
  // 붙으면 폭이 늘어나는데, 고정 px 간격을 정적으로 추측하면(옛 --smt-help-gap: 268px) 라벨이
  // 붙는 순간 겹친다(Round 5-2 — 사용자가 스크린샷으로 지적). 값을 더 크게 추측하는 대신 실제
  // 폭을 매번 재서 그 자리에 붙인다 — 라벨 유무·재생 속도 자릿수·테마·언어가 바뀌어도 안 겹친다.
  // 1100px 미만에서는 CSS 미디어쿼리가 .help 를 좌하단으로 되돌리므로 인라인 값을 지워 그대로 둔다.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1101px)');
    let observer: ResizeObserver | null = null;
    const reposition = () => {
      const help = helpRef.current;
      if (!help) return;
      if (!wide.matches) { help.style.removeProperty('--smt-help-gap'); return; }
      const menu = document.querySelector<HTMLElement>('[data-scene-quick-menu="true"]');
      if (!menu) { help.style.removeProperty('--smt-help-gap'); return; }
      // right/max-width 둘 다 CSS의 --smt-help-gap 하나만 본다 — 여기서 그 값만 실제 폭으로 덮어쓴다.
      help.style.setProperty('--smt-help-gap', `${Math.max(0, window.innerWidth - menu.getBoundingClientRect().left + 12)}px`);
    };
    reposition();
    const menu = document.querySelector<HTMLElement>('[data-scene-quick-menu="true"]');
    if (menu) { observer = new ResizeObserver(reposition); observer.observe(menu); }
    window.addEventListener('resize', reposition);
    wide.addEventListener('change', reposition);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reposition);
      wide.removeEventListener('change', reposition);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    async function start() {
      const [T, { OrbitControls }, { buildSmtLines }] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('./smtLine/smtLineModel'),
      ]);
      if (stopped || !host.current) return;
      const node = host.current;
      // Round 6: 모바일 세로 화면에서도 이 장면이 뜨면서, 저사양 기기(DESIGN.md 의 data-film-perf=low
      // 규칙)에서 GPU 여력이 적은 문제가 새로 생겼다. 픽셀 비율과 그림자맵은 매 프레임 비용(그림자맵은
      // 전체 SMT 지오메트리를 광원 시점으로 한 번 더 그린다)이라 낮췄다 — 히트맵 캔버스 해상도는
      // 데이터가 바뀔 때만 한 번 다시 그리는 비주기 비용이라(Round 2 참고) 낮추지 않았다.
      const lowPerf = isLowPerformance();
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, lowPerf ? 1 : 1.75));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
      node.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', '회전과 확대가 가능한 SMT 4개 라인 3D 공간');
      const scene = new T.Scene();
      scene.background = new T.Color(0x07101a);
      scene.fog = new T.Fog(0x07101a, 90, 190);
      const camera = new T.PerspectiveCamera(CAMERA_FOV, 1, .1, 300);
      camera.position.set(...OVERVIEW_POSE.position);
      scene.add(new T.HemisphereLight(0xcce8ff, 0x172434, 2.4));
      const sun = new T.DirectionalLight(0xfff7e9, 3);
      sun.position.set(28, 54, 22); sun.castShadow = true;
      sun.shadow.mapSize.set(lowPerf ? 1024 : 2048, lowPerf ? 1024 : 2048);
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
      hotspotOrderRef.current = smtHotspotOrder(zoneSource, model.heatmap.pins);

      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.target.set(...OVERVIEW_POSE.target);
      orbit.enableDamping = true; orbit.minDistance = 12; orbit.maxDistance = 135;
      orbit.maxPolarAngle = Math.PI * .48; // 시선이 거의 수평인 시점은 이보다 커지므로, 옮기는 포즈마다 극각을 확인했다.
      orbit.update();

      const position = new T.Vector3(); const target = new T.Vector3(); let transitioning = false;
      const beginTransition = (pose: { position: readonly [number, number, number]; target: readonly [number, number, number] }) => {
        position.set(...pose.position); target.set(...pose.target); transitioning = true;
      };
      // heatmapFull 로부터 흐른 시간(초) — 고온 순회 전용 자체 시계. 필름 재생 여부와 무관하다.
      const hotspotClockRef = { current: 0 };
      const stopAuto = () => { autoDriveRef.current = null; setHotspot(null); setOrbitTouring(false); };
      const interrupt = () => { transitioning = false; stopAuto(); manual.current?.(); };
      orbit.addEventListener('start', interrupt);

      goOverview.current = () => {
        stopAuto();
        setSelected(null); manual.current?.();
        beginTransition(OVERVIEW_POSE);
      };
      goLine.current = (line: LineButton) => {
        stopAuto();
        setSelected(line.index); manual.current?.();
        beginTransition({ position: [0, 24, line.z + 28], target: line.center });
      };
      // Round 4-1: "내부 걷기" 대신 고온 구역 순회 비행(smtHotspotTour, Round 3-2)을 버튼으로도
      // 시작할 수 있게 한다. 지금 시점의 스케줄 포즈로 매끄럽게 이동한 뒤(beginTransition), 전환이
      // 끝나면 아래 render() 의 'hotspot' 분기가 넘겨받아 매 프레임 스케줄을 이어 계산한다.
      //
      // 버그(Round 5-1): 자체 시계 없이 필름의 elapsed/playing 을 그대로 썼더니, 이 버튼이 부르는
      // manual.current?.() 가 player.pause 로 필름을 멈추고 → playing prop 이 false 가 되고 →
      // "재생 중일 때만 시계를 흘린다"는 조건 때문에 순회가 스스로를 멈추는 구조였다. 자동 회전이
      // orbitAngle 이라는 자체 시계로 도는 것과 같은 방식으로, 고온 순회도 필름 재생 여부와 무관한
      // 자체 시계(hotspotClockRef)로 돌린다. 버튼을 누를 때마다 처음(온도 1위 구역)부터 다시 보여준다.
      const hotspotElapsed = () => ENVIRONMENT_TIMING.heatmapFull + hotspotClockRef.current;
      startHotspotTour.current = () => {
        setSelected(null);
        hotspotClockRef.current = 0;
        autoDriveRef.current = 'hotspot'; setOrbitTouring(false); manual.current?.();
        beginTransition(smtHotspotTour(hotspotElapsed(), hotspotOrderRef.current, OVERVIEW_POSE).pose);
      };
      // Round 3-3: 약 15도 위에서 공장을 도는 자동 회전. 시작 각도를 지금 카메라 위치에서 구한다 —
      // 마운트 기본값(아래)은 카메라가 이미 OVERVIEW_POSE 에 있으므로 전환 없이 그 자리에서 바로
      // 궤도를 시작하고, 버튼으로 시작할 때는 beginTransition 으로 그 지점까지 매끄럽게 이동한 뒤
      // (경과시간 기반 lerp), 전환이 끝나면 아래 render() 의 'orbit' 분기가 넘겨받는다.
      let orbitAngle = 0;
      const orbitTourPose = () => {
        orbitAngle = Math.atan2(camera.position.z - FLOOR_CENTER[2], camera.position.x - FLOOR_CENTER[0]);
        autoDriveRef.current = 'orbit'; setOrbitTouring(true); setHotspot(null); setSelected(null);
        return {
          position: [FLOOR_CENTER[0] + Math.cos(orbitAngle) * ORBIT_TOUR_RADIUS, ORBIT_TOUR_HEIGHT,
            FLOOR_CENTER[2] + Math.sin(orbitAngle) * ORBIT_TOUR_RADIUS] as const,
          target: FLOOR_CENTER,
        };
      };
      startOrbitTour.current = () => { manual.current?.(); beginTransition(orbitTourPose()); };
      stopAutoDrive.current = () => { stopAuto(); manual.current?.(); };

      // Round 5-3: 연출(필름 재생)로 들어오면 고온 구역 순회를 먼저 보여주고, 다 돌면 자동 회전으로
      // 잇는다(전환은 아래 render() 의 'hotspot' 분기가 tour.finished 를 보고 한다). 순회할 구역이
      // 하나도 없어도(온도값 전부 결측) smtHotspotTour 가 곧바로 finished 를 돌려주므로 별도 분기
      // 없이 첫 프레임에서 바로 자동 회전으로 넘어간다 — 카메라는 이미 OVERVIEW_POSE 에 있다.
      autoDriveRef.current = 'hotspot';

      const resize = () => {
        const { width, height } = node.getBoundingClientRect();
        renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize); observer.observe(node); resize();

      let frame = 0; let last = performance.now();
      let hotspotSignature = '';
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
        } else if (autoDriveRef.current === 'hotspot') {
          // 자동 회전(orbitAngle)과 같은 방식 — 필름 재생 여부와 무관하게 매 프레임 delta 만큼 흐른다.
          hotspotClockRef.current += delta;
          const tour = smtHotspotTour(hotspotElapsed(), hotspotOrderRef.current, OVERVIEW_POSE);
          if (tour.finished) {
            // Round 5-3: 순회가 끝나면 자동 회전으로 잇는다. orbitTourPose() 는 "지금 카메라 위치"에서
            // 각도를 구하는데, 지금 카메라는 순회의 마지막 포즈(상공 복귀 = overview 포즈)에 이미
            // 와 있다 — 다만 높이가 다르므로(순회 34m, 회전 17.68m) 그대로 넘기면 화면이 뚝 끊긴다.
            // 버튼으로 자동 회전을 시작할 때와 같은 beginTransition 으로 부드럽게 잇는다.
            // orbitTourPose() 가 autoDriveRef 를 'orbit' 으로 바꾸므로 다음 프레임부터는 이 분기
            // 대신 아래 'orbit' 분기가 넘겨받는다 — 별도 종료 플래그 없이 자연히 한 번만 실행된다.
            beginTransition(orbitTourPose());
          } else {
            camera.position.set(...tour.pose.position); orbit.target.set(...tour.pose.target);
            const signature = tour.active ? `${tour.active.id}:${tour.rank}:${tour.phase}` : `overview:${tour.phase}`;
            if (signature !== hotspotSignature) {
              hotspotSignature = signature;
              setHotspot(tour.active ? { name: tour.active.name, temperature: tour.active.temperature,
                rank: tour.rank, total: tour.total, phase: tour.phase } : null);
            }
          }
        } else if (autoDriveRef.current === 'orbit') {
          // 경과시간(delta) 기반 각속도 — 프레임레이트가 흔들려도 한 바퀴 도는 실제 시간은 같다.
          orbitAngle += (2 * Math.PI / ORBIT_TOUR_PERIOD_SECONDS) * delta;
          camera.position.set(FLOOR_CENTER[0] + Math.cos(orbitAngle) * ORBIT_TOUR_RADIUS, ORBIT_TOUR_HEIGHT,
            FLOOR_CENTER[2] + Math.sin(orbitAngle) * ORBIT_TOUR_RADIUS);
          orbit.target.set(...FLOOR_CENTER);
        }
        orbit.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render);
      };
      render(); setStatus('드래그로 회전 · 휠로 확대 · 라인/순회 선택');

      cleanup = () => {
        cancelAnimationFrame(frame); observer.disconnect();
        orbit.removeEventListener('start', interrupt);
        orbit.dispose();
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
        goOverview.current = () => {}; goLine.current = () => {}; startHotspotTour.current = () => {};
        startOrbitTour.current = () => {}; stopAutoDrive.current = () => {};
      };
    }
    void start().catch(error => { if (!stopped) setStatus(`3D 초기화 실패: ${error instanceof Error ? error.message : String(error)}`); });
    return () => { stopped = true; cleanup(); };
  }, []);

  // 실시간으로 바뀌는 온습도 데이터: 씬은 그대로 두고 히트맵 캔버스·라벨과 순회 순서만 다시 만든다.
  useEffect(() => {
    if (!environment || !heatmapRef.current) return;
    const zones = environment.zones.slice(0, ZONE_COUNT);
    paintHeatmap(heatmapRef.current, zones);
    hotspotOrderRef.current = smtHotspotOrder(zones, heatmapRef.current.pins);
  }, [environment]);

  return <div className={styles.overlay}>
    <div ref={host} className={styles.viewport} />
    <aside className={styles.panel} ref={panelRef}>
      <div className={styles.handle} onPointerDown={onPanelHandlePointerDown} onPointerMove={onPanelHandlePointerMove}
        onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag} onLostPointerCapture={() => { panelDragRef.current = null; }}>
        <h2 className={styles.title}>SMT PRODUCTION FLOOR</h2>
        <p className={styles.subtitle}>{status} · 76 × 44 m</p>
      </div>
      <nav className={styles.modes} aria-label="시점 모드">
        <button type="button" aria-pressed={selected === null && !orbitTouring && !hotspot} onClick={() => goOverview.current()}>둘러보기</button>
        <button type="button" aria-pressed={!!hotspot} onClick={() => startHotspotTour.current()}>고온 구역 순회</button>
      </nav>
      <nav className={styles.modes} aria-label="자동 회전">
        <button type="button" aria-pressed={orbitTouring} onClick={() => startOrbitTour.current()}>자동 회전</button>
        <button type="button" onClick={() => stopAutoDrive.current()}>정지</button>
      </nav>
      {hotspot && <div className={styles.hotspot} aria-live="polite">
        <b>HOTSPOT {hotspot.rank}/{hotspot.total}</b>
        {hotspot.name} · {hotspot.temperature.toFixed(1)}℃
        <small>{hotspot.phase}</small>
      </div>}
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
    <p className={styles.help} ref={helpRef}><b>둘러보기</b> 드래그 회전 · 휠 확대<br /><b>고온 구역 순회</b> 온도 높은 구역부터 차례로 비행<br /><b>자동 회전</b> 15도 위에서 천천히 공전</p>
  </div>;
}
