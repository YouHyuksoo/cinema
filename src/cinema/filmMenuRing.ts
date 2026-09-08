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
