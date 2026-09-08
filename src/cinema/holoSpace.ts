export interface HoloPoint { x: number; y: number; z: number }
export interface HoloProjectedPoint { x: number; y: number; depth: number; scale: number }
export interface HoloCamera {
  x?: number; y?: number; yaw: number; pitch: number; scale?: number;
  distance?: number; panX?: number; panY?: number;
}

/** Shared local 3D space for glass objects, flow paths and their exact annotation anchors. */
export function createHoloProjection({ x = 640, y = 350, yaw, pitch, scale = 1,
  distance = 900, panX = 0, panY = 0 }: HoloCamera) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (point: HoloPoint): HoloProjectedPoint => {
    const vx = point.x * cy + point.z * sy, vz = -point.x * sy + point.z * cy;
    const vy = point.y * cp - vz * sp, depth = point.y * sp + vz * cp;
    const perspective = scale * distance / Math.max(distance * .12, distance + depth);
    return { x: x + (vx - panX) * perspective, y: y + (vy - panY) * perspective, depth, scale: perspective };
  };
}

export function mixHoloPoint(a: HoloPoint, b: HoloPoint, amount: number): HoloPoint {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount, z: a.z + (b.z - a.z) * amount };
}
