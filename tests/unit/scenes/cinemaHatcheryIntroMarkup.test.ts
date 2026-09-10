import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HatcheryIntroGate } from '@/cinema/HatcheryIntro';

describe('boot gate markup', () => {
  it('renders the five depth layers, the reticle ring, ten wing segments, labels and a skip control', () => {
    const html = renderToStaticMarkup(createElement(HatcheryIntroGate, { pass: 0, skipped: false, onSkip() {} }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="HATCHERY 시작"');
    for (const layer of ['depth', 'frame', 'wings', 'ring', 'labels']) expect(html).toContain(`data-hud-layer="${layer}"`);
    expect((html.match(/<rect /g) ?? []).length).toBe(10);
    expect((html.match(/<circle /g) ?? []).length).toBe(4);
    expect(html).toContain('HATCHERY');
    expect(html).toContain('GATE // STANDBY');
    expect(html).toContain('건너뛰기');
    expect(html).toContain('--pass:0');
    expect(html).toContain('data-online="false"');
  });
  it('switches the gate label online as soon as the rig starts passing', () => {
    const html = renderToStaticMarkup(createElement(HatcheryIntroGate, { pass: .2, skipped: true, onSkip() {} }));
    expect(html).toContain('GATE // ONLINE');
    expect(html).toContain('data-online="true"');
    expect(html).toContain('data-skipped="true"');
  });
  it('draws the gate without images, glass or purple, in 3D, above the HUD and below the cube', () => {
    const css = readFileSync('src/cinema/hatcheryIntro.module.css', 'utf8');
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/backdrop-filter/);
    expect(css).not.toMatch(/purple|violet|#8b5cf6|#a855f7/i);
    expect(css).toContain('perspective: 900px');
    expect(css).toContain('--pass');
    expect(css).toContain('z-index: 8');
    expect(css).toContain('[data-cube-layer]');
  });
  it('is mounted beside the film on the cinema page', () => {
    const page = readFileSync('src/app/cinema/page.tsx', 'utf8');
    expect(page).toContain("import { HatcheryIntro } from '@/cinema/HatcheryIntro';");
    expect(page).toContain('<HatcheryIntro />');
  });
});
