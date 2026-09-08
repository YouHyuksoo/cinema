export const TAU = Math.PI * 2;
const RADIUS_PER_TOOTH = 3;

export interface Gear {
  x: number;
  y: number;
  teeth: number;
  radius: number;
  angle: number;
}

export function mainGear(angle: number): Gear {
  return { x: 620, y: 352, teeth: 48, radius: 48 * RADIUS_PER_TOOTH, angle };
}

/** External gears share a pitch and meet at their pitch circles. */
export function drivenGear(parent: Gear, teeth: number, bearing: number): Gear {
  const radius = teeth * RADIUS_PER_TOOTH;
  return {
    x: parent.x + Math.cos(bearing) * (parent.radius + radius),
    y: parent.y + Math.sin(bearing) * (parent.radius + radius),
    radius,
    teeth,
    // At the contact point, a tooth on either gear must face a gap on the other.
    angle: bearing + Math.PI - (Math.PI + parent.teeth * (parent.angle - bearing)) / teeth,
  };
}

/** Decorative teeth centered at local angle zero, with a shared depth and clearance. */
export function gearOutline(gear: Gear): [number, number][] {
  const pitch = TAU / gear.teeth;
  const profile = [[-.5, -4.8], [-.3, -4.8], [-.15, 3.6], [.15, 3.6], [.3, -4.8], [.5, -4.8]];
  return Array.from({ length: gear.teeth }, (_, tooth) => profile.map(([fraction, depth]): [number, number] => {
    const angle = gear.angle + (tooth + fraction) * pitch;
    return [gear.x + Math.cos(angle) * (gear.radius + depth), gear.y + Math.sin(angle) * (gear.radius + depth)];
  })).flat();
}
