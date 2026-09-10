import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The question input must stand out from the HUD: a slow accent pulse while empty, steady once focused or filled. */
describe('chat input glow', () => {
  const css = readFileSync('src/cinema/jarvis.module.css', 'utf8');
  it('pulses the empty input slowly in the theme accent', () => {
    expect(css).toMatch(/\.input input \{[^}]*animation:inputGlow 2\.8s ease-in-out infinite;/);
    expect(css).toContain('@keyframes inputGlow');
    expect(css).toMatch(/50% \{ border-color:var\(--film-accent\); box-shadow:0 0 14px/);
  });
  it('holds steady on focus or with text, and never animates under reduced motion', () => {
    expect(css).toContain('.input input:focus-visible,.input input:not(:placeholder-shown) { animation:none; border-color:var(--film-accent);');
    expect(css).toContain('@media(prefers-reduced-motion:reduce) { .input input { animation:none; border-color:var(--film-accent); } }');
  });
});
