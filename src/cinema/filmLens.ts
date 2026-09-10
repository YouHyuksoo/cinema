/**
 * Screen-anchored lens projection shared by the corner planes, the corner finale core and the
 * voice reactor. Rotation order is fixed: pitch (about x), then yaw (about y), then roll (about z);
 * apparent size is `lens / (lens + depth)`. Object-local holograms use `createHoloProjection`
 * (yaw first) and free cameras use `InspectionCamera`; see DESIGN.md "렌더링 구조".
 */
export interface LensPoint { x: number; y: number; depth: number }
export interface LensPose {
  lens: number; yaw?: number; pitch?: number; roll?: number;
  /** Forward offset of the whole plane; positive is farther from the viewer. */
  depth?: number;
  /** Plane origin in lens units, applied after rotation and before perspective. */
  originX?: number; originY?: number;
  /** Screen point the lens looks through. */
  centerX?: number; centerY?: number;
}

/** Apparent scale of a point `depth` units behind the screen plane. */
export const lensScale = (lens: number, depth: number) => lens / (lens + depth);

/** The operation order below is load-bearing: callers pin bit-identical output in cinemaFilmLens.test.ts. */
export function createLensProjection({ lens, yaw = 0, pitch = 0, roll = 0, depth = 0,
  originX = 0, originY = 0, centerX = 0, centerY = 0 }: LensPose) {
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
  return (x: number, y: number, z = 0): LensPoint => {
    const tiltedY = y * cosPitch - z * sinPitch;
    const tiltedZ = y * sinPitch + z * cosPitch;
    const rotatedX = x * cosYaw + tiltedZ * sinYaw;
    const rotatedZ = -x * sinYaw + tiltedZ * cosYaw;
    const rolledX = rotatedX * cosRoll - tiltedY * sinRoll;
    const rolledY = rotatedX * sinRoll + tiltedY * cosRoll;
    const pointDepth = depth + rotatedZ;
    const perspective = lensScale(lens, pointDepth);
    return { x: centerX + (originX + rolledX) * perspective, y: centerY + (originY + rolledY) * perspective, depth: pointDepth };
  };
}
