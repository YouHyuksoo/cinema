import type * as THREE from 'three';
import { STAGE_ROOMS, STAGE_WALLS, STAGE_WALL_THICKNESS, type WallSegment } from './factoryLayout';

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
  return { root, floors };
}
