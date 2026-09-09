/**
 * Shared scalar helpers for scene geometry and drawing. Every scene used to carry its own copy of
 * these; keep them here so easing and clamping behave identically across films.
 */

/** Clamp to [min, max]. NaN passes through unchanged (Math.min/max semantics). */
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/** Clamp to [0, 1]. NaN passes through unchanged. */
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** Clamp to [0, 1], treating NaN/Infinity as 0 so a broken reading never poisons a layout. */
export const finiteUnit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
/** Linear interpolation from `a` to `b` by `t`. */
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Hermite smoothstep of a unit value; see `smooth(a, b, t)` in filmDrawing for the two-bound form. */
export const smoothstep = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t); };
/** Two-digit zero-padded index, the HUD's universal counter format. */
export const pad2 = (value: number | string) => String(value).padStart(2, '0');
