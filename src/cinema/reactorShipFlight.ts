import type { ReactorPoint } from './voiceReactorGeometry';

export const REACTOR_EGG_TIMING = {
  arrived: 1.2, shoo: 2.2, retreat: 3.25, firstReturn: 4.6, perch: 6, shakeOff: 7.8,
  secondRetreat: 8.8, thirdReturn: 9.6, taunt: 10.8, rage: 12.2, flee: 14.1,
  hide: 14.9, turn: 15.2, aimed: 15.65, fire: 16.6, impact: 16.84, recover: 18.3, end: 20,
} as const;
export const REACTOR_EGG_TARGET: ReactorPoint = { x: 500, y: 150, z: 1550 };
export const REACTOR_PERCH: ReactorPoint = { x: 0, y: -122, z: -10 };
const p = (x: number, y: number, z: number): ReactorPoint => ({ x, y, z });
interface FlightSegment { end: number; points: [ReactorPoint, ReactorPoint, ReactorPoint, ReactorPoint] }
const right = p(290, -52, -10), left = p(-285, -45, -10);
const FLIGHT: FlightSegment[] = [
  { end: 1.2, points: [p(-285, -55, -60), p(-180, -70, -100), p(-120, -10, -150), p(-58, -16, -150)] },
  { end: 2.2, points: [p(-58, -16, -150), p(15, -65, -170), p(100, -70, -160), p(67, -10, -145)] },
  { end: 3.25, points: [p(67, -10, -145), p(120, 40, -145), p(80, 25, -100), p(105, -26, -100)] },
  { end: 4.1, points: [p(105, -26, -100), p(175, -100, -60), p(250, -70, -15), right] },
  { end: 4.6, points: [right, right, right, right] },
  { end: 6, points: [right, p(190, -165, -10), p(25, -155, -10), REACTOR_PERCH] },
  { end: 7.8, points: [REACTOR_PERCH, REACTOR_PERCH, REACTOR_PERCH, REACTOR_PERCH] },
  { end: 8.8, points: [REACTOR_PERCH, p(-45, -190, -20), p(-220, -80, -20), left] },
  { end: 9.6, points: [left, left, left, left] },
  { end: 10.8, points: [left, p(-150, 50, -60), p(-120, 35, -145), p(-63, -7, -150)] },
  { end: 11.45, points: [p(-63, -7, -150), p(10, -65, -160), p(100, -65, -160), p(80, -12, -145)] },
  { end: 12.2, points: [p(80, -12, -145), p(145, 65, -150), p(-85, 70, -165), p(-55, 18, -160)] },
  { end: 13.1, points: [p(-55, 18, -160), p(-100, -40, -155), p(70, -55, -155), p(63, 20, -150)] },
  { end: 14.1, points: [p(63, 20, -150), p(110, 60, -150), p(145, -50, -140), p(97, -45, -120)] },
  { end: 14.9, points: [p(97, -45, -120), p(150, -55, -70), p(65, -20, 110), p(25, -15, 180)] },
  { end: 16.6, points: [p(25, -15, 180), p(55, 10, 360), p(410, 90, 1100), REACTOR_EGG_TARGET] },
];

/** Camera-space spline; positive z goes behind the solid reactor. */
export function reactorShipPosition(time: number): ReactorPoint {
  let start = 0;
  for (const segment of FLIGHT) {
    if (time <= segment.end) {
      const t = Math.max(0, Math.min(1, (time - start) / (segment.end - start))), v = 1 - t;
      const [a, b, c, d] = segment.points;
      const coordinate = (key: keyof ReactorPoint) => v ** 3 * a[key] + 3 * v * v * t * b[key] + 3 * v * t * t * c[key] + t ** 3 * d[key];
      return { x: coordinate('x'), y: coordinate('y'), z: coordinate('z') };
    }
    start = segment.end;
  }
  return { ...REACTOR_EGG_TARGET };
}
