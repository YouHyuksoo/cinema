import { smooth } from './filmDrawing';

export const RACE_CAR_SECONDS = 36;
export const RACE_DIAGNOSTICS = {
  battery: 84.2, coolant: 72, flow: 120,
  engine: 789, exhaust: 835, pressure: 4.2,
  frontLoad: 46.5, rearLoad: 53.5,
  brakes: [640, 610, 920, 892], suspension: [14, 12, 24, 20],
} as const;
export type RacePoint = readonly [number, number, number];
export const RACE_SYSTEMS = ['AERODYNAMICS', 'HYBRID / ERS', 'POWER UNIT', 'SUSPENSION', 'CARBON BRAKES'] as const;
export function raceCarState(seconds: number) {
  const time = Math.max(0, Math.min(RACE_CAR_SECONDS, Number.isFinite(seconds) ? seconds : 0));
  return { time, presence: smooth(0, 1.4, time) * (1 - smooth(34.5, 36, time)),
    system: Math.min(4, Math.max(0, Math.floor((time - 4) / 6))),
    scan: smooth(1.5, 5, time), transparent: smooth(1, 4, time),
  };
}
export type RaceCarState = ReturnType<typeof raceCarState>;

/** Fixed oblique view: front wing lower left, rear wing upper right. */
export function raceProject([x, y, z]: RacePoint) {
  return { x: 646 + x * 1.04 + y * .75, y: 365 - y * .61 + x * .39 - z * .98 };
}
