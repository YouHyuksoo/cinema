/**
 * Canvas shadows are a Gaussian blur per fill or stroke: the single most expensive 2D call, and
 * the scene renderers set `shadowBlur` in more than thirty places. Rather than thread a quality
 * flag through every renderer (and change the pinned draw-call fingerprints), the gate shadows the
 * `shadowBlur` accessor on one context instance: renderers keep writing the value they want and
 * read it back unchanged, while the native property receives 0 whenever the gate is closed.
 */
export interface FilmShadowGate {
  /** When true, every shadow paints with blur 0 (a plain offset copy, or nothing at zero offset). */
  closed: boolean;
}

function findAccessor(target: object, property: string) {
  for (let proto = Object.getPrototypeOf(target); proto; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, property);
    if (descriptor) return descriptor.get && descriptor.set ? descriptor : null;
  }
  return null;
}

const gates = new WeakMap<CanvasRenderingContext2D, FilmShadowGate>();

/**
 * One gate per context. A canvas context outlives the React effect that draws on it (Strict Mode
 * runs the effect twice, a remount runs it again), so a second call returns the gate already
 * shadowing the accessor instead of a second, disconnected one.
 */
export function createFilmShadowGate(ctx: CanvasRenderingContext2D): FilmShadowGate {
  const existing = gates.get(ctx);
  if (existing) return existing;
  const accessor = findAccessor(ctx, 'shadowBlur');
  let closed = false;
  // A context without a native accessor (a recording stub in tests) keeps its plain property.
  if (!accessor || Object.prototype.hasOwnProperty.call(ctx, 'shadowBlur')) {
    const inert = { get closed() { return closed; }, set closed(value) { closed = value; } };
    gates.set(ctx, inert);
    return inert;
  }
  const { get, set } = accessor as Required<Pick<PropertyDescriptor, 'get' | 'set'>>;
  let wanted = get.call(ctx) as number;
  Object.defineProperty(ctx, 'shadowBlur', {
    configurable: true,
    get() { return wanted; },
    set(value: number) { wanted = value; set.call(ctx, closed ? 0 : value); },
  });
  const gate: FilmShadowGate = {
    get closed() { return closed; },
    set closed(value: boolean) {
      if (value === closed) return;
      closed = value;
      set.call(ctx, closed ? 0 : wanted);
    },
  };
  gates.set(ctx, gate);
  return gate;
}
