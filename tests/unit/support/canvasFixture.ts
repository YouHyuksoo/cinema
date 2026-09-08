interface Paint {
  globalAlpha: number; globalCompositeOperation: string; filter: string; shadowColor: string;
  shadowBlur: number; shadowOffsetX: number; shadowOffsetY: number; lineDash: number[];
}
export interface Fill extends Paint { fillStyle: unknown; rect: number[] }
export interface Text { value: string; x: number; y: number; opacity: number }

/** Stateful Canvas stand-in: paths are ignored, but save/restore, paint state and text calls are real. */
export function canvasFixture(initial: Partial<Paint> = {}) {
  let state: Record<string, unknown> = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
    shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineDash: [], fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, ...initial,
  };
  const stack: Record<string, unknown>[] = [], fills: Fill[] = [], texts: Text[] = [];
  const paint = (): Paint => ({
    globalAlpha: state.globalAlpha as number, globalCompositeOperation: state.globalCompositeOperation as string,
    filter: state.filter as string, shadowColor: state.shadowColor as string, shadowBlur: state.shadowBlur as number,
    shadowOffsetX: state.shadowOffsetX as number, shadowOffsetY: state.shadowOffsetY as number,
    lineDash: [...state.lineDash as number[]],
  });
  const gradient = () => ({ addColorStop: () => undefined });
  const methods: Record<string, unknown> = {
    canvas: { width: 1280, height: 720 },
    save: () => stack.push({ ...state, lineDash: [...state.lineDash as number[]] }),
    restore: () => { state = stack.pop() ?? state; },
    fillRect: (...rect: number[]) => fills.push({ ...paint(), fillStyle: state.fillStyle, rect }),
    fillText: (value: string, x: number, y: number) => texts.push({ value, x, y, opacity: state.globalAlpha as number }),
    getLineDash: () => [...state.lineDash as number[]],
    setLineDash: (segments: number[]) => { state.lineDash = [...segments]; },
    createLinearGradient: gradient, createRadialGradient: gradient, createConicGradient: gradient,
    measureText: (text: string) => ({ width: text.length * 7 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  const noop = () => undefined;
  const ctx = new Proxy({}, {
    get: (_target, key) => typeof key === 'string' ? methods[key] ?? state[key] ?? noop : undefined,
    set: (_target, key, value) => { state[String(key)] = value; return true; },
  }) as CanvasRenderingContext2D;
  return { ctx, fills, texts, stack };
}
