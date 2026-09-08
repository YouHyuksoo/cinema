import { createHash } from 'node:crypto';

export type CanvasCall = unknown[];

const round = (value: unknown): unknown => typeof value === 'number' ? Math.round(value * 1000) / 1000
  : Array.isArray(value) ? value.map(round) : value;

/**
 * Records every Canvas 2D call and property assignment so a refactor can prove it draws
 * exactly the same frame. Gradients are numbered and their color stops are recorded too.
 */
export function recordingCanvas() {
  const calls: CanvasCall[] = [];
  let gradients = 0;
  const state: Record<string, unknown> = {};
  const stack: Record<string, unknown>[] = [];
  const gradient = (kind: string) => (...args: unknown[]) => {
    const id = `gradient#${++gradients}`;
    calls.push([kind, id, ...args.map(round)]);
    return { id, addColorStop: (offset: number, color: string) => { calls.push(['addColorStop', id, round(offset), color]); } };
  };
  const methods: Record<string, unknown> = {
    canvas: { width: 1280, height: 720 },
    save: () => { calls.push(['save']); stack.push({ ...state }); },
    restore: () => { calls.push(['restore']); Object.assign(state, stack.pop() ?? {}); },
    createLinearGradient: gradient('createLinearGradient'), createRadialGradient: gradient('createRadialGradient'),
    createConicGradient: gradient('createConicGradient'),
    measureText: (text: string) => ({ width: text.length * 7 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => [...(state.lineDash as number[] ?? [])],
  };
  const ctx = new Proxy({}, {
    get: (_target, key) => {
      if (typeof key !== 'string') return undefined;
      if (key in methods) return methods[key];
      if (key in state) return state[key];
      return (...args: unknown[]) => { calls.push([key, ...args.map(value => typeof value === 'object' && value && 'id' in value ? (value as { id: string }).id : round(value))]); };
    },
    set: (_target, key, value) => {
      const recorded = typeof value === 'object' && value && 'id' in value ? (value as { id: string }).id : round(value);
      calls.push(['set', String(key), recorded]); state[String(key)] = value; return true;
    },
  }) as CanvasRenderingContext2D;
  return {
    ctx, calls,
    fingerprint: () => createHash('sha1').update(JSON.stringify(calls)).digest('hex'),
  };
}
