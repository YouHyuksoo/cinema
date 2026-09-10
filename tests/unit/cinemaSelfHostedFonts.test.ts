import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FONTS_DIR = join('src', 'app', 'fonts');
const FAMILIES: [string, string, string[]][] = [
  ['--font-display', 'Orbitron', ['500', '700']],
  ['--font-label', 'Rajdhani', ['500', '600']],
  ['--font-mono', 'Share Tech Mono', ['400']],
  ['--font-korean', 'Noto Sans KR', ['500']],
];

/** Weights declared for a family's upright faces. */
function declaredWeights(css: string, family: string) {
  const pattern = new RegExp(`font-family: '${family}';\\s*font-style: normal;\\s*font-weight: (\\d+);`, 'g');
  return new Set([...css.matchAll(pattern)].map(match => match[1]));
}

describe('self-hosted HUD typefaces', () => {
  it('declares the four families and their CSS variables without Google Fonts', () => {
    const css = readFileSync(join(FONTS_DIR, 'fonts.css'), 'utf8');
    for (const [variable, family, weights] of FAMILIES) {
      expect(css).toContain(`${variable}: '${family}';`);
      expect(declaredWeights(css, family)).toEqual(new Set(weights));
    }
    expect(css).not.toContain('googleapis');
    expect(css).not.toContain('gstatic');
  });
  it('ships every referenced woff2 file and keeps the Korean unicode-range splits', () => {
    const css = readFileSync(join(FONTS_DIR, 'fonts.css'), 'utf8');
    const files = [...css.matchAll(/url\('\.\/files\/([^']+)'\)/g)].map(match => match[1]);
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) expect(existsSync(join(FONTS_DIR, 'files', file)), file).toBe(true);
    expect((css.match(/unicode-range:/g) ?? []).length).toBeGreaterThan(100);
  });
  it('is what the root layout loads instead of next/font/google', () => {
    const layout = readFileSync(join('src', 'app', 'layout.tsx'), 'utf8');
    expect(layout).not.toContain('next/font/google');
    expect(layout).toContain("import './fonts/fonts.css';");
    expect(layout).not.toContain('.variable');
  });
});
