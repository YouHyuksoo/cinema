import type * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * SMT 4개 생산라인 3D 공간. `artifacts/smt-4line-space/scene.html` (2026-09-20 시안)을 그대로 옮긴 지오메트리다.
 * 새로 디자인하지 않는다 — 재질 팔레트, 헬퍼, 설비 빌더, 라인 배치 모두 시안 값을 그대로 따른다.
 * `buildSmtLines(T, zones)` 는 매 마운트마다 새 재질·지오메트리를 만든다 (모듈 스코프 캐시 금지):
 * FactoryExplorer3D 의 언마운트 cleanup 이 씬을 traverse 해 geometry/material 을 dispose 하므로,
 * 모듈 레벨에서 공유하면 재마운트 시 이미 dispose 된 객체를 재사용하게 된다.
 * `zones` 는 온습도 히트맵 구역 바닥(SmtZoneFloor)의 이름표다 — 온도값은 여기서 다루지 않는다.
 * 실시간으로 바뀌는 온도는 씬을 다시 만들지 않고 `SmtZoneFloor.material.color`/`paintLabel()` 만
 * 갱신해야 한다 (호출부: SmtLineExplorer.tsx).
 */
export const SMT_FLOOR_WIDTH = 76;
export const SMT_FLOOR_DEPTH = 44;
/** 라인 중심(z)이 이 값들이고, 각 라인은 58m 8공정이다 (시안 makeLine 배치 그대로). */
export const SMT_LINE_COUNT = 4;

/**
 * 환경 히트맵 구역 바닥. 온습도 구역은 10개, SMT 공간은 4라인뿐이라 구역을 라인에 1:1로
 * 대응시킬 수 없다 — 2D 히트맵(`environmentHeatmap.ts`)이 이미 10개 구역을 5열×2행 격자로
 * 배치하므로, 그 순서(row = index/5, column = index%5)를 3D 바닥 전체(76×44m)에 그대로
 * 펼쳐 2D/3D 배치 감각을 맞춘다. 타일 사이 간격이 곧 구역 경계선이다.
 */
export const SMT_ZONE_COLUMNS = 5;
export const SMT_ZONE_ROWS = 2;
export const SMT_ZONE_COUNT = SMT_ZONE_COLUMNS * SMT_ZONE_ROWS;
const ZONE_TILE_GAP = .6;
/** 바닥 상판(y=0)뿐 아니라 기존 차선 마크(y=.08~.115)보다도 위로 확실히 띄워 z-파이팅을 피한다. */
const ZONE_TILE_BASE_Y = .16;
const ZONE_TILE_HEIGHT = .06;

export interface SmtLine {
  index: number;
  z: number;
  stations: readonly string[];
  center: THREE.Vector3;
}

export interface SmtZoneInput { id: string; name: string }

export interface SmtZoneFloor {
  id: string;
  name: string;
  index: number;
  mesh: THREE.Mesh;
  /** 구역마다 독립 인스턴스다 — 공유하면 모든 구역이 같은 색이 된다. */
  material: THREE.MeshBasicMaterial;
  bounds: { x: number; z: number; width: number; depth: number };
  /** 온도 텍스트/색 갱신. `document` 가 없는 테스트 환경에서는 조용히 아무 것도 하지 않는다. */
  paintLabel(reading: string, color: string): void;
}

export interface SmtLineModel {
  root: THREE.Group;
  lines: SmtLine[];
  zones: SmtZoneFloor[];
}

/**
 * `environmentTemperatureColor()`(environmentHeatmap.ts) 는 CSS4 공백 문법(`hsl(H S% L%)`)을
 * 돌려준다 — 2D canvas의 `fillStyle` 은 이를 그대로 받아들이지만, three.js `Color.setStyle()` 의
 * hsl 파서는 옛 콤마 문법(`hsl(H,S%,L%)`)만 인식한다(three/src/math/Color.js 의 hsl 정규식 참고).
 * 공백 문법을 그대로 넘기면 파싱에 실패해 `Color` 가 이전 값(신규 재질이면 흰색)에 머문 채 "Unknown
 * color model" 경고만 찍고 조용히 무시된다. `SmtZoneFloor.material.color.setStyle()` 을 부를 때는
 * 반드시 이 함수를 거쳐 콤마 문법으로 바꾼 뒤 넘긴다.
 */
export function threeHslStyle(cssHsl: string): string {
  return cssHsl.replace(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/, 'hsl($1,$2%,$3%)');
}

export function buildSmtLines(T: typeof THREE, zones: readonly SmtZoneInput[] = []): SmtLineModel {
  const W = SMT_FLOOR_WIDTH, D = SMT_FLOOR_DEPTH;
  const world = new T.Group();

  // 재질 팔레트 — 시안 M 전체를 그대로 옮긴다. aisle/white 는 시안에서도 선언만 되고
  // 아직 어떤 빌더에도 쓰이지 않지만, "새로 디자인하지 않는다" 원칙에 따라 그대로 둔다.
  const M = {
    floor: new T.MeshStandardMaterial({ color: 0xaeb8c1, roughness: .82 }),
    aisle: new T.MeshStandardMaterial({ color: 0x254c5c, roughness: .7 }),
    mark: new T.MeshStandardMaterial({ color: 0x54d9e4, emissive: 0x123a42 }),
    white: new T.MeshStandardMaterial({ color: 0xe9edf0, roughness: .34, metalness: .48 }),
    shell: new T.MeshPhysicalMaterial({ color: 0xe9edf0, roughness: .26, metalness: .08, clearcoat: .5, clearcoatRoughness: .2 }),
    light: new T.MeshStandardMaterial({ color: 0xc9d0d5, roughness: .4, metalness: .55 }),
    mid: new T.MeshStandardMaterial({ color: 0x74808a, roughness: .46, metalness: .62 }),
    dark: new T.MeshPhysicalMaterial({ color: 0x171d23, roughness: .2, metalness: .45, clearcoat: .28, clearcoatRoughness: .18 }),
    glass: new T.MeshPhysicalMaterial({ color: 0x172b38, roughness: .06, metalness: .08, transmission: .08, transparent: true, opacity: .82, clearcoat: .75 }),
    red: new T.MeshStandardMaterial({ color: 0xdb2e36, roughness: .5 }),
    green: new T.MeshStandardMaterial({ color: 0x42e282, emissive: 0x0b4a26 }),
    amber: new T.MeshStandardMaterial({ color: 0xffbd46, emissive: 0x5b3508 }),
    belt: new T.MeshStandardMaterial({ color: 0x303940, roughness: .65, metalness: .4 }),
    frame: new T.MeshStandardMaterial({ color: 0x8e999f, roughness: .38, metalness: .72 }),
  };

  const BOX = new T.BoxGeometry(1, 1, 1);
  const CYL = new T.CylinderGeometry(1, 1, 1, 16);
  const ROUNDED = new Map<string, THREE.BufferGeometry>();

  function box(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, ry = 0) {
    const m = new T.Mesh(BOX, mat);
    m.position.set(x, y + sy / 2, z); m.scale.set(sx, sy, sz); m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true; parent.add(m);
    return m;
  }
  function roundedBox(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, r = .12, segments = 4, ry = 0) {
    const radius = Math.min(r, sx / 2, sy / 2, sz / 2) * .98;
    const key = `${sx}:${sy}:${sz}:${radius}:${segments}`;
    if (!ROUNDED.has(key)) ROUNDED.set(key, new RoundedBoxGeometry(sx, sy, sz, segments, radius));
    const m = new T.Mesh(ROUNDED.get(key)!, mat);
    m.position.set(x, y + sy / 2, z); m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true; parent.add(m);
    return m;
  }
  function cyl(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, r: number, h: number) {
    const m = new T.Mesh(CYL, mat);
    m.position.set(x, y + h / 2, z); m.scale.set(r, h, r);
    m.castShadow = true; parent.add(m);
    return m;
  }
  /** 앵커-엘보-태그 리더 라인 + 캔버스 텍스처 라벨. 텍스트는 DOM 캔버스가 있을 때만 그린다 —
   * node(vitest) 에서 buildSmtLines 를 검증할 때 document 가 없어도 지오메트리는 그대로 만들어져야 한다. */
  function label(parent: THREE.Object3D, text: string, x: number, y: number, z: number,
    color = '#dff8ff', scale = 1, role = '생산 설비') {
    const width = 7.2 * scale;
    const anchor = new T.Vector3(x, y - 1.25, z - .55);
    const tag = new T.Vector3(x + width * .58, y, z + .72);
    const elbow = new T.Vector3(tag.x - width * .65, tag.y - .38, tag.z);
    const line = new T.Line(new T.BufferGeometry().setFromPoints([anchor, elbow, tag]),
      new T.LineBasicMaterial({ color, transparent: true, opacity: .96, depthTest: false }));
    line.renderOrder = 20; parent.add(line);
    if (typeof document === 'undefined') return line;
    const c = document.createElement('canvas'); c.width = 640; c.height = 180;
    const ctx = c.getContext('2d');
    if (!ctx) return line;
    ctx.fillStyle = 'rgba(7,20,32,.68)'; ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.roundRect(5, 5, 630, 170, 22); ctx.fill(); ctx.stroke();
    const glow = ctx.createLinearGradient(0, 0, 640, 180);
    glow.addColorStop(0, 'rgba(255,255,255,.2)'); glow.addColorStop(.32, 'rgba(255,255,255,.03)'); glow.addColorStop(1, 'rgba(255,255,255,.1)');
    ctx.fillStyle = glow; ctx.roundRect(8, 8, 624, 164, 20); ctx.fill();
    ctx.fillStyle = '#effcff'; ctx.font = '600 40px Segoe UI'; ctx.fillText(text, 30, 62);
    ctx.fillStyle = '#9bb8c8'; ctx.font = '25px Segoe UI'; ctx.fillText(role, 30, 111);
    ctx.fillStyle = color; ctx.font = '600 23px Segoe UI'; ctx.fillText('RUN', 520, 111);
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
    sprite.position.copy(tag); sprite.scale.set(width, 2.05 * scale, 1); sprite.renderOrder = 21; parent.add(sprite);
    return sprite;
  }
  /** Flat billboard readout above a zone tile — no elbow leader line, unlike `label()`'s equipment tags. */
  function zoneLabelSprite(parent: THREE.Object3D, x: number, z: number, y = 1.35) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 176;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const texture = new T.CanvasTexture(canvas);
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    sprite.position.set(x, y, z); sprite.scale.set(4.2, 1.45, 1); sprite.renderOrder = 22;
    parent.add(sprite);
    return { canvas, ctx, texture };
  }
  function paintZoneLabel(readout: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture },
    name: string, reading: string, color: string) {
    const { canvas, ctx, texture } = readout;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(6,14,20,.72)'; ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#eef7fb'; ctx.font = '600 38px Segoe UI'; ctx.fillText(name, 26, 68);
    ctx.fillStyle = color; ctx.font = '700 54px Segoe UI'; ctx.fillText(reading, 26, 142);
    texture.needsUpdate = true;
  }
  /** Zone floor tiles, independent of the 4 lines above — see SMT_ZONE_COLUMNS/ROWS doc comment. */
  function buildZoneFloors(zoneInputs: readonly SmtZoneInput[]): SmtZoneFloor[] {
    const cellWidth = W / SMT_ZONE_COLUMNS, cellDepth = D / SMT_ZONE_ROWS;
    const tileWidth = cellWidth - ZONE_TILE_GAP, tileDepth = cellDepth - ZONE_TILE_GAP;
    return zoneInputs.slice(0, SMT_ZONE_COUNT).map((zone, index) => {
      const row = Math.floor(index / SMT_ZONE_COLUMNS), column = index % SMT_ZONE_COLUMNS;
      const x = column * cellWidth + cellWidth / 2, z = row * cellDepth + cellDepth / 2;
      // Own material per zone (never shared) so color.setStyle() on one never touches another.
      const material = new T.MeshBasicMaterial({ color: 0x3a4650, transparent: true, opacity: .85, toneMapped: false });
      const mesh = new T.Mesh(BOX, material);
      mesh.position.set(x, ZONE_TILE_BASE_Y + ZONE_TILE_HEIGHT / 2, z);
      mesh.scale.set(tileWidth, ZONE_TILE_HEIGHT, tileDepth);
      mesh.name = `zone-floor:${zone.id}`;
      world.add(mesh);
      const readout = zoneLabelSprite(world, x, z);
      return {
        id: zone.id, name: zone.name, index, mesh, material,
        bounds: { x, z, width: tileWidth, depth: tileDepth },
        paintLabel(reading: string, color: string) { if (readout) paintZoneLabel(readout, zone.name, reading, color); },
      };
    });
  }
  function feet(g: THREE.Object3D, x: number, z: number, w: number, d: number) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      box(g, M.dark, x + sx * (w / 2 - .15), 0, z + sz * (d / 2 - .15), .14, .28, .14);
  }
  function conveyor(g: THREE.Object3D, x: number, z: number, len = 4, w = 1.15, h = .78) {
    box(g, M.frame, x, 0, z, .14, h, w); box(g, M.frame, x + len, 0, z, .14, h, w);
    box(g, M.belt, x + .05, h, z, len - .1, .12, w);
    for (let i = .35; i < len; i += .42) cyl(g, M.mid, x + i, h + .1, z, .045, w);
    for (const px of [x, x + len]) for (const pz of [-.42, .42]) box(g, M.dark, px, 0, z + pz, .1, h, .1);
  }
  function tower(g: THREE.Object3D, x: number, z: number, y = 2.7) {
    cyl(g, M.dark, x, y, z, .075, .12); cyl(g, M.green, x, y + .12, z, .075, .18);
    cyl(g, M.amber, x, y + .3, z, .075, .15); cyl(g, M.red, x, y + .45, z, .075, .15);
  }
  function monitor(g: THREE.Object3D, x: number, y: number, z: number, arm = .52) {
    box(g, M.frame, x, y - .06, z - arm / 2, .08, .08, arm);
    box(g, M.dark, x, y, z - arm, 1.05, .68, .1);
    box(g, M.glass, x, y + .06, z - arm - .06, .88, .49, .02);
  }
  function controls(g: THREE.Object3D, x: number, y: number, z: number) {
    for (let i = 0; i < 4; i++) cyl(g, i === 0 ? M.red : i === 1 ? M.amber : M.green, x, y - i * .2, z, .065, .06);
  }

  function loader(g: THREE.Object3D, x: number, z: number) {
    // 참조 이미지의 개방형 PCB 승강 로더: 네 기둥, 매거진, 하부 이송부.
    for (const px of [-1.05, 1.05]) for (const pz of [-.82, .82]) box(g, M.frame, x + px, 0, z + pz, .12, 2.9, .12);
    box(g, M.frame, x, 2.78, z, 2.25, .16, 1.78); box(g, M.frame, x, .15, z, 2.25, .16, 1.78);
    box(g, M.belt, x - .15, .55, z, 2.15, .12, 1.05);
    for (let y = .85; y < 2.6; y += .28) { box(g, M.dark, x - .32, y, z, .06, .06, 1.25); box(g, M.dark, x + .32, y, z, .06, .06, 1.25); }
    roundedBox(g, M.shell, x + 1.48, 0, z, 1.05, 2.55, 1.45, .1);
    box(g, M.dark, x + 1.48, .62, z + .74, .62, .98, .05);
    controls(g, x + 1.98, 1.72, z + .76); tower(g, x + 1.72, z, 2.55); conveyor(g, x + 2, z, 2.15);
  }
  function printer(g: THREE.Object3D, x: number, z: number) {
    // 솔더 페이스트 프린터: 흰 측면 셸과 큰 검은 전면 도어, 외부 모니터.
    roundedBox(g, M.shell, x, 0, z, 4.15, 2.45, 2.6, .16);
    roundedBox(g, M.dark, x + .28, .56, z + 1.31, 2.72, 1.68, .12, .08);
    box(g, M.glass, x + .28, 1.18, z + 1.36, 2.36, .8, .02);
    box(g, M.light, x - 1.62, .32, z + 1.34, .48, .64, .08); box(g, M.red, x - 1.65, 1.78, z + 1.36, .13, .13, .05);
    monitor(g, x + 2.43, 1.42, z + 1.2, .76); controls(g, x + 1.92, 1.42, z + 1.29);
    tower(g, x - 1.55, z, 2.45); feet(g, x, z, 4.15, 2.6); conveyor(g, x + 2.05, z, 1.35);
  }
  function inspector(g: THREE.Object3D, x: number, z: number, name = 'SPI') {
    roundedBox(g, M.shell, x, 0, z, 2.8, 2.75, 2.5, .15);
    roundedBox(g, M.dark, x - .18, 1.15, z + 1.27, 1.92, .78, .1, .06);
    box(g, M.glass, x - .18, 1.22, z + 1.32, 1.7, .6, .02);
    box(g, M.light, x - .25, .38, z + 1.3, 1.65, .42, .09);
    monitor(g, x + .08, 1.53, z + 1.25, .15); controls(g, x + 1.16, 1.63, z + 1.31);
    box(g, M.dark, x + 1.18, .48, z + 1.32, .3, .98, .08); tower(g, x + 1.08, z, 2.75);
    label(g, name, x, 3.55, z + 1.4, '#ffc968', .62, '솔더 페이스트 검사');
  }
  function mounter(g: THREE.Object3D, x: number, z: number, wide = false) {
    const w = wide ? 5.4 : 4.55;
    roundedBox(g, M.shell, x, 0, z, w, 2.62, 2.62, .16);
    roundedBox(g, M.dark, x, 1.45, z + 1.34, w * .7, .72, .1, .06);
    box(g, M.glass, x, 1.51, z + 1.39, w * .62, .52, .02);
    // 전면 피더 뱅크와 릴 슬롯.
    for (let i = 0; i < (wide ? 13 : 10); i++) {
      const fx = x - w * .4 + i * (w * .8 / (wide ? 12 : 9));
      box(g, M.frame, fx, .22, z + 1.48, .12, .92, .18); cyl(g, M.dark, fx, .98, z + 1.5, .12, .09);
    }
    box(g, M.dark, x - w / 2 + .2, .42, z + 1.36, .35, 1.2, .09);
    monitor(g, x + w / 2 + .65, 1.38, z + 1.12, .55); controls(g, x + w / 2 - .25, 1.42, z + 1.35);
    tower(g, x + w / 2 - .35, z, 2.62); feet(g, x, z, w, 2.62); conveyor(g, x + w / 2, z, 1.2);
  }
  function reflow(g: THREE.Object3D, x: number, z: number) {
    // 다중 존 리플로우: 챔버 도어, 상부 배기 후드, 하부 서비스 패널.
    roundedBox(g, M.shell, x, 0, z, 10.7, 2.18, 2.66, .14);
    for (let i = -4.25; i <= 4.25; i += 1.7) {
      roundedBox(g, M.light, x + i, .35, z + 1.36, 1.42, .78, .08, .035, 2);
      box(g, M.dark, x + i, .55, z + 1.41, .72, .1, .02);
      roundedBox(g, M.light, x + i, 2.18, z, 1.45, .32, 2.36, .08, 3);
      box(g, M.mid, x + i, 2.5, z, .42, .36, .62);
    }
    box(g, M.frame, x, 2.84, z, 9.9, .12, .24);
    monitor(g, x - 4.75, 1.2, z + 1.16, .52); controls(g, x + 4.88, 1.45, z + 1.38);
    tower(g, x + 4.65, z, 2.5); feet(g, x, z, 10.7, 2.66); conveyor(g, x + 5.3, z, 1.55);
    label(g, 'REFLOW', x, 3.72, z + 1.48, '#65e6ef', .66, '다중 존 열처리');
  }
  function aoi(g: THREE.Object3D, x: number, z: number) {
    roundedBox(g, M.shell, x, 0, z, 3.15, 2.88, 2.5, .16);
    roundedBox(g, M.dark, x - .12, 1.32, z + 1.27, 2.02, .9, .1, .06);
    box(g, M.glass, x - .12, 1.4, z + 1.32, 1.78, .68, .02);
    box(g, M.dark, x + 1.28, .48, z + 1.29, .3, 1.28, .08);
    monitor(g, x + .15, 1.52, z + 1.28, .12); controls(g, x + 1.29, 1.72, z + 1.34);
    tower(g, x + 1.18, z, 2.88); feet(g, x, z, 3.15, 2.5);
    label(g, 'AOI', x, 3.7, z + 1.4, '#ffc968', .6, '자동 광학 검사');
  }
  function ict(g: THREE.Object3D, x: number, z: number) {
    // ICT 인라인 검사 셀: 세 개 검사창, 전면 서비스 도어, 상태등.
    roundedBox(g, M.shell, x, 0, z, 6.65, 2.5, 3.08, .18);
    roundedBox(g, M.light, x, 2.5, z, 6.2, .22, 2.72, .08, 3);
    for (let i = -2; i <= 2; i += 2) {
      roundedBox(g, M.dark, x + i, 1.08, z + 1.57, 1.48, 1, .1, .06);
      box(g, M.glass, x + i, 1.17, z + 1.62, 1.25, .76, .02);
      box(g, M.dark, x + i, .28, z + 1.61, .72, .1, .02);
    }
    box(g, M.dark, x - 3, .48, z + 1.6, .34, 1.42, .09);
    monitor(g, x + 2.5, 1.5, z + 1.45, .38); controls(g, x + 3.04, 1.68, z + 1.6);
    tower(g, x + 2.82, z, 2.72); feet(g, x, z, 6.65, 3.08);
    label(g, 'ICT', x, 3.62, z + 1.76, '#ffc968', .62, '인서킷 전기 검사');
  }

  function makeLine(index: number, z: number): SmtLine {
    const g = new T.Group(); g.position.set(5, 0, z); world.add(g);
    const stations: string[] = [];
    loader(g, 0, 0); stations.push('Loader');
    printer(g, 6, 0); stations.push('Printer');
    inspector(g, 10.4, 0, 'SPI'); stations.push('SPI');
    mounter(g, 15.4, 0); mounter(g, 21, 0, true); stations.push('Mounter ×2');
    reflow(g, 31.4, 0); stations.push('Reflow');
    aoi(g, 39.3, 0); stations.push('AOI'); conveyor(g, 40.8, 0, 4.6);
    ict(g, 49.2, 0); stations.push('ICT'); conveyor(g, 52.5, 0, 5.2);
    label(g, `LINE ${index}`, 8, 4.65, 0, '#56d7e5', .72, 'SMT 생산 라인');
    box(world, M.mark, 34, .08, z - 2.25, 64, .035, .11);
    box(world, M.mark, 34, .08, z + 2.25, 64, .035, .11);
    return { index, z, stations, center: new T.Vector3(34, 0, z) };
  }

  box(world, M.floor, W / 2, -.4, D / 2, W, .4, D).name = 'smt-floor';
  const lines = [makeLine(1, 6), makeLine(2, 16), makeLine(3, 26), makeLine(4, 36)];
  // 자재 대기와 AGV 통로.
  for (let i = 0; i < 8; i++) {
    box(world, M.light, 69, .15, 4.5 + i * 4.8, 2.4, .9, 1.2);
    box(world, M.dark, 69, .1, 4.5 + i * 4.8, 2.7, .12, 1.5);
  }
  label(world, 'MATERIAL BUFFER', 69, 3.2, 21, '#56d7e5', .65, '자재 대기 구역');
  const zoneFloors = buildZoneFloors(zones);

  return { root: world, lines, zones: zoneFloors };
}
