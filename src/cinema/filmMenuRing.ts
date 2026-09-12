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
/** Inner teeth sit at this fraction of the outer radius so adjacent hexes nest instead of sharing one circle. */
export const ORBIT_INNER_SCALE = .74;
/** Outer orbit radius for a globe diameter: sawtooth packing needs less pad than a single circle. */
export const orbitRadius = (diameter: number) => (Number.isFinite(diameter) ? Math.max(0, diameter) : 0) * .5 + 48;
export const orbitTooth = (index: number) => index % 2 === 0 ? 1 : ORBIT_INNER_SCALE;

/** Orbit layout: tiles sit flat in a sawtooth around the globe, the front slot at twelve o'clock. */
export function orbitPose(index: number, turn: number, count: number, radius: number) {
  const offset = ((index - turn) % count + count) % count;
  const around = offset / count * Math.PI * 2;
  const angle = ORBIT_FRONT_ANGLE + around;
  const front = (Math.cos(around) + 1) / 2;
  const r = radius * orbitTooth(index);
  // Larger than the dock ring's tiles: they sit against the busy main screen, so they need presence.
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, z: 0, yaw: 0, angle, radius: r, tooth: orbitTooth(index),
    scale: 1.02 + front * .3, opacity: .82 + front * .18 };
}

/** Quantize only the CSS boundary: JS engines may differ in the final bits of sin/cos. */
export function menuPoseStyle(pose:ReturnType<typeof ringPose>|ReturnType<typeof orbitPose>) {
  const cssNumber=(value:number)=>String(Number(value.toFixed(6)));
  const appearance={'--ring-scale':cssNumber(pose.scale),'--ring-opacity':cssNumber(pose.opacity)};
  return 'angle' in pose
    ? {...appearance,'--orbit-angle':`${cssNumber(pose.angle)}rad`,'--orbit-tooth':cssNumber(pose.tooth),'--orbit-outer':pose.tooth === 1 ? '1' : '0'}
    : {...appearance,'--ring-x':`${cssNumber(pose.x)}px`,'--ring-y':`${cssNumber(pose.y)}px`,
      '--ring-z':`${cssNumber(pose.z)}px`,'--ring-yaw':`${cssNumber(pose.yaw)}deg`};
}
