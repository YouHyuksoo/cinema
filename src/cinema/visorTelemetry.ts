import { smooth } from './filmDrawing';

/** One simulated sensor feeds the equipment, visor, annotation and history. */
export function visorTelemetry(time: number) {
  const recovery = smooth(23, 27, time);
  const heat = smooth(9, 11, time) * (1 - recovery);
  const temperature = 78.2 + heat * (16.4 + Math.sin(time * 1.1) * .18);
  return {
    heat, temperature, baseline: 78.2, recovery,
    fan: 62 + recovery * 30,
    yieldRate: 96.4 + recovery * 2.2,
    warning: heat > .35,
    recovering: time >= 23 && recovery < 1,
    stable: recovery === 1,
  };
}
