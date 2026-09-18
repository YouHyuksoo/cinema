import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/cinema/useFilmMenuGlobe.ts', 'utf8');

describe('open orbit ring stays anchored', () => {
  it('re-centres the globe on every resize while the ring is open, not only on a viewport change', () => {
    // The docked axis (--hatchery-signal-cx) is republished whenever the top strip re-measures, which
    // calls resize() without a viewport change; measure() re-docks to the corner, so the open ring
    // must claim its centre back afterwards or the eighteen tiles orbit a corner, half off screen.
    expect(source).toContain('if (orbit) {\n        if (viewportChanged) orbitCenter = orbitCenterFor(');
    expect(source).toContain('if (input.menuOpen) {\n          // The open ring owns its centre.');
    expect(source).toMatch(/if \(input\.menuOpen\) \{[\s\S]{0,400}globeCenter = \{ \.\.\.orbitCenter \};/);
    expect(source).not.toContain('if (orbit && viewportChanged) {');
  });
  it('writes a face transform only when it changes so the idle spin stays cheap', () => {
    expect(source).toContain('if (written.faces[index] !== transform)');
    expect(source).toContain('if (written.opacity[index] !== opacity)');
    expect(source).toContain('if (written.button !== buttonTransform)');
    expect(source).toContain('if (written.perspective !== origin)');
  });
});
