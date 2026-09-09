/** Continuous turns are measured in menu slots; index zero is at the front. */
export function ringIndex(turn: number, count: number) {
  return ((Math.round(turn) % count) + count) % count;
}

export function nearestRingTurn(turn: number, index: number, count: number) {
  return index + Math.round((turn - index) / count) * count;
}

export function dragRingTurn(start: number, deltaX: number, width: number, count: number) {
  return start - deltaX / Math.max(1, width) * count;
}

export function ringPose(index: number, turn: number, count: number, radius: number) {
  const offset = ((index - turn) % count + count) % count;
  const angle = offset / count * Math.PI * 2;
  const depth = Math.cos(angle), front = (depth + 1) / 2;
  return { x: Math.sin(angle) * radius, y: depth * 36, z: depth * 105,
    yaw: -Math.sin(angle) * 32, scale: .58 + front * .42, opacity: .38 + front * .62 };
}

/** How the folded globe unfolds: into the bottom dock ring, or into a circle around the globe itself. */
export type MenuLayout = 'dock' | 'orbit';
export const MENU_LAYOUTS = [
  { value: 'dock', label: '하단 링' },
  { value: 'orbit', label: '구체 둘레 링' },
] as const satisfies readonly { value: MenuLayout; label: string }[];
export const isMenuLayout = (value: unknown): value is MenuLayout => MENU_LAYOUTS.some(item => item.value === value);

export const ORBIT_FRONT_ANGLE = -Math.PI / 2;
/** Orbit radius for a globe diameter: just outside the sphere with room for the hex tiles. */
export const orbitRadius = (diameter: number) => (Number.isFinite(diameter) ? Math.max(0, diameter) : 0) * .5 + 96;

/** Orbit layout: tiles sit flat on a circle around the globe, the front slot at twelve o'clock. */
export function orbitPose(index: number, turn: number, count: number, radius: number) {
  const offset = ((index - turn) % count + count) % count;
  const around = offset / count * Math.PI * 2;
  const angle = ORBIT_FRONT_ANGLE + around;
  const front = (Math.cos(around) + 1) / 2;
  // Larger than the dock ring's tiles: they sit against the busy main screen, so they need presence.
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0, yaw: 0, angle,
    scale: 1.02 + front * .3, opacity: .82 + front * .18 };
}
