import type * as THREE from 'three';
import { roomCenter, STAGE_ROOMS, STAGE_WALLS, STAGE_WALL_THICKNESS, type Vec3, type WallSegment } from './factoryLayout';

export interface FactoryModel {
  root: THREE.Group;
  /** 구역 id → 바닥 메시. 히트맵이 이 메시의 색을 바꾼다. */
  floors: Map<string, THREE.Mesh>;
}

/** studio 시제품의 팔레트를 따른다: 따뜻한 도장 금속, 무광 바닥, 부드러운 주변광. */
function materials(T: typeof THREE) {
  return {
    plaster: new T.MeshStandardMaterial({ color: '#ecebe4', roughness: .86 }),
    floor: new T.MeshStandardMaterial({ color: '#a9aaa2', roughness: .65 }),
    glass: new T.MeshStandardMaterial({ color: '#213d43', roughness: .18, metalness: .5, transparent: true, opacity: .45 }),
    ivory: new T.MeshStandardMaterial({ color: '#d9ddd8', roughness: .36, metalness: .22 }),
    dark: new T.MeshStandardMaterial({ color: '#263539', roughness: .42, metalness: .35 }),
    steel: new T.MeshStandardMaterial({ color: '#9aa6a9', roughness: .3, metalness: .8 }),
    bench: new T.MeshStandardMaterial({ color: '#2f7d5e', roughness: .6 }),
    rack: new T.MeshStandardMaterial({ color: '#2d5fa8', roughness: .55, metalness: .35 }),
    carton: new T.MeshStandardMaterial({ color: '#c09a68', roughness: .95 }),
  };
}

function addWall(T: typeof THREE, root: THREE.Group, mat: THREE.Material, glass: THREE.Material, wall: WallSegment) {
  const dx = wall.x1 - wall.x0, dz = wall.z1 - wall.z0;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return;
  const ry = Math.atan2(dx, dz);
  const put = (from: number, to: number, y0: number, y1: number, material: THREE.Material) => {
    if (to - from < .02 || y1 - y0 < .02) return;
    const mid = (from + to) / 2;
    const mesh = new T.Mesh(new T.BoxGeometry(STAGE_WALL_THICKNESS, y1 - y0, to - from), material);
    mesh.position.set(wall.x0 + dx * (mid / length), (y0 + y1) / 2, wall.z0 + dz * (mid / length));
    mesh.rotation.y = ry;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  };
  let cursor = 0;
  for (const opening of [...wall.openings].sort((a, b) => a.at - b.at)) {
    put(cursor, opening.at, 0, wall.height, mat);
    if (opening.y0 > 0) put(opening.at, opening.at + opening.width, 0, opening.y0, mat);
    if (opening.y1 < wall.height) put(opening.at, opening.at + opening.width, opening.y1, wall.height, mat);
    if (opening.glass) put(opening.at, opening.at + opening.width, opening.y0, opening.y1, glass);
    cursor = opening.at + opening.width;
  }
  put(cursor, length, 0, wall.height, mat);
}

export function buildFactoryModel(T: typeof THREE): FactoryModel {
  const root = new T.Group();
  const mat = materials(T);
  const floors = new Map<string, THREE.Mesh>();
  for (const room of STAGE_ROOMS) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(room.x1 - room.x0, .12, room.z1 - room.z0),
      mat.floor.clone());
    mesh.position.set((room.x0 + room.x1) / 2, .06, (room.z0 + room.z1) / 2);
    mesh.receiveShadow = true;
    mesh.name = room.id;
    root.add(mesh);
    floors.set(room.id, mesh);
  }
  for (const wall of STAGE_WALLS) addWall(T, root, mat.plaster, mat.glass, wall);

  const box = (center: Vec3, size: Vec3, material: THREE.Material) => {
    const mesh = new T.Mesh(new T.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(center.x, center.y + size.y / 2, center.z);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  /** 설비 한 대. 본체 위에 커버와 시그널 타워를 얹어 실루엣을 만든다. */
  const machine = (x: number, z: number) => {
    box({ x, y: .12, z }, { x: 3.4, y: 2.2, z: 2 }, mat.ivory);
    box({ x, y: 2.32, z }, { x: 2.8, y: .3, z: 1.6 }, mat.steel);
    box({ x: x + 1.3, y: .8, z: z + 1.05 }, { x: .5, y: 1.2, z: .1 }, mat.dark);
  };
  /** 작업대 한 줄. */
  const bench = (x: number, z: number, length: number) => {
    box({ x, y: .74, z }, { x: length, y: .08, z: 1 }, mat.bench);
    box({ x, y: .12, z }, { x: length - .6, y: .62, z: .1 }, mat.steel);
  };
  /** 적재 랙과 상자. */
  const rack = (x: number, z: number) => {
    box({ x, y: .12, z }, { x: 6, y: 4.2, z: 1.2 }, mat.rack);
    for (let level = 0; level < 3; level++)
      for (let bay = 0; bay < 3; bay++)
        box({ x: x - 2 + bay * 2, y: .4 + level * 1.4, z }, { x: 1.4, y: .8, z: 1 }, mat.carton);
  };

  // 구역 성격에 맞는 설비를 놓는다. 보관·입고 구역은 랙, 공정 구역은 설비, 검사·포장은 작업대.
  const fill: Record<number, (center: Vec3) => void> = {
    0: c => { rack(c.x, c.z - 3); bench(c.x, c.z + 4, 6); },
    1: c => { rack(c.x, c.z - 3); rack(c.x, c.z + 3); },
    2: c => { machine(c.x - 2, c.z); bench(c.x + 3, c.z + 4, 5); },
    3: c => { machine(c.x - 2, c.z - 3); machine(c.x - 2, c.z + 3); bench(c.x + 3, c.z, 6); },
    4: c => { machine(c.x, c.z - 2); machine(c.x, c.z + 3); },
    5: c => { bench(c.x, c.z - 3, 7); bench(c.x, c.z + 3, 7); },
    6: c => { bench(c.x, c.z - 4, 8); bench(c.x, c.z, 8); bench(c.x, c.z + 4, 8); },
    7: c => { bench(c.x, c.z, 7); rack(c.x, c.z + 5); },
    8: c => { bench(c.x, c.z - 3, 6); machine(c.x, c.z + 3); },
    9: c => { rack(c.x, c.z - 4); rack(c.x, c.z + 1); },
  };
  STAGE_ROOMS.forEach((room, index) => fill[index]?.(roomCenter(room)));

  return { root, floors };
}
