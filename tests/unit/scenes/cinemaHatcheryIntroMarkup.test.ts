import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HatcheryIntro, HatcheryIntroGate } from '@/cinema/HatcheryIntro';

const OBJECTS = ['floor', 'ceiling', 'wing-left', 'wing-right', 'frame', 'ring', 'labels'];

describe('boot gate markup', () => {
  it('renders the seven 3D objects, extruded frame and ring, wing segments, labels and a skip control', () => {
    const html = renderToStaticMarkup(createElement(HatcheryIntroGate, { pass: 0, skipped: false, onSkip() {} }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="HATCHERY 시작"');
    for (const name of OBJECTS) expect(html).toContain(`data-hud-object="${name}"`);
    expect((html.match(/<rect /g) ?? []).length).toBe(10);
    // Three ring slices and two gyros, four circles each; three frame slices.
    expect((html.match(/<circle /g) ?? []).length).toBe(20);
    expect((html.match(/--i:2/g) ?? []).length).toBe(2);
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
  it('places objects in 3D: receding grids, angled wings, extruded slices, gyro rings, camera drift and pointer parallax', () => {
    const css = readFileSync('src/cinema/hatcheryIntro.module.css', 'utf8');
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/backdrop-filter/);
    expect(css).not.toMatch(/purple|violet|#8b5cf6|#a855f7/i);
    expect(css).toContain('rotateX(76deg)');
    expect(css).toContain('rotateY(44deg)');
    expect(css).toContain('rotateY(-44deg)');
    expect(css).toMatch(/\.slice \{[^}]*translateZ\(/);
    expect(css).toMatch(/@keyframes gyroA/);
    expect(css).toMatch(/@keyframes yawDrift/);
    expect(css).toContain('var(--px)');
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

describe('boot gate first paint', () => {
  it('is part of the server HTML so the HUD is covered before any script runs', () => {
    const html = renderToStaticMarkup(createElement(HatcheryIntro));
    expect(html).toContain('data-intro-stage');
    expect(html).toContain('--pass:0');
  });
  it('lets the layout hide an already-seen gate before paint', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain("sessionStorage.getItem('hatchery.intro.v1')==='1'");
    expect(layout).toContain('prefers-reduced-motion: reduce');
    expect(layout).toContain("dataset.hatcheryIntroSeen='1'");
    expect(layout).toContain('/[?&]intro=/.test(location.search)');
    const css = readFileSync('src/cinema/hatcheryIntro.module.css', 'utf8');
    expect(css).toContain(':global(:root[data-hatchery-intro-seen]) .stage { display: none; }');
  });
});
