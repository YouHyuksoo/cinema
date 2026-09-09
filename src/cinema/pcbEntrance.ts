import { smooth } from './filmDrawing';
export const PCB_ENTRANCE_SECONDS = 4;


/** Pure, seek-safe choreography values for the PCB's four-second arrival. */
export function pcbEntranceState(time: number) {
  const t = Number.isFinite(time) ? Math.max(0, Math.min(PCB_ENTRANCE_SECONDS, time)) : 0;
  const particleIn = smooth(1.45, 1.85, t), particleOut = 1 - smooth(3.2, 4, t);
  return {
    time: t,
    ground: smooth(0, .85, t),
    outline: smooth(.45, 1.55, t),
    circuits: smooth(1.25, 2.45, t),
    particles: particleIn * particleOut,
    components: smooth(2.05, 3.45, t),
    lock: smooth(3.05, 4, t),
    pulse: .78 + Math.sin(t * Math.PI * 2 * 1.2) * .22,
    complete: t >= PCB_ENTRANCE_SECONDS,
  };
}

export type PcbEntranceState = ReturnType<typeof pcbEntranceState>;

/** Component banks settle in deterministic order without changing their final geometry. */
export function pcbComponentEntrance(index: number, count: number, state: PcbEntranceState) {
  if (state.complete) return { reveal: 1, lift: 0 };
  const stagger = count > 1 ? Math.max(0, Math.min(1, index / (count - 1))) * .52 : 0;
  const reveal = smooth(2.05 + stagger, 3.28 + stagger, state.time);
  return { reveal, lift: (1 - reveal) * 10 };
}
