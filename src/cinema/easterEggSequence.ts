export const EASTER_EGG_ORDER = ['ship', 'globe', 'turbine', 'cube', 'scanner'] as const;
export type EasterEgg = typeof EASTER_EGG_ORDER[number];
type Start = (done: () => void) => boolean;

export function createEasterEggSequence() {
  const handlers = new Map<EasterEgg, Start>();
  let next = 0, active: object | null = null;
  return {
    get active() { return active !== null; },
    register(id: EasterEgg, start: Start) {
      handlers.set(id, start);
      return () => { if (handlers.get(id) === start) handlers.delete(id); };
    },
    play(requested?: EasterEgg) {
      if (active) return false;
      for (let offset = 0; offset < EASTER_EGG_ORDER.length; offset++) {
        const index = (next + offset) % EASTER_EGG_ORDER.length;
        if (requested && EASTER_EGG_ORDER[index] !== requested) continue;
        const start = handlers.get(EASTER_EGG_ORDER[index]);
        if (!start) continue;
        const token = {}; active = token;
        const done = () => { if (active === token) active = null; };
        if (start(done)) { if (!requested) next = (index + 1) % EASTER_EGG_ORDER.length; return true; }
        done();
      }
      return false;
    },
  };
}

const sequences = new WeakMap<Element, ReturnType<typeof createEasterEggSequence>>();
export function easterEggSequence(root: Element) {
  let sequence = sequences.get(root);
  if (!sequence) { sequence = createEasterEggSequence(); sequences.set(root, sequence); }
  return sequence;
}
