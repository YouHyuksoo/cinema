import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HatcheryIntro, HatcheryIntroGate } from '@/cinema/HatcheryIntro';

const gate = (pass: number, skipped = false) =>
  renderToStaticMarkup(createElement(HatcheryIntroGate, { pass, skipped, cue: 'stage', onSkip() {}, onSolved() {}, onDocked() {} }));

describe('boot stage markup', () => {
  it('renders only the Rubik cube (26 cubies, 54 stickers) and a skip control', () => {
    const html = gate(0);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="HATCHERY 시작"');
    expect(html).toContain('data-hud-object="cube"');
    expect((html.match(/data-intro-cubie/g) ?? []).length).toBe(26);
    expect((html.match(/data-intro-sticker="/g) ?? []).length).toBe(54);
    for (const color of ['#c41e3a', '#0051ba', '#009e60', '#ff6a00', '#f3f3f3', '#ffd500']) expect(html).toContain(color);
    expect(html).toContain('--pass:0');
    expect(html).toContain('data-online="false"');
    // No copy on the stage itself: the only text is the hidden skip control.
    expect(html.replace(/<[^>]+>/g, '').trim()).toBe('건너뛰기');
  });
  it('flags the stage online and skipped as the cube leaves', () => {
    const html = gate(.2, true);
    expect(html).toContain('data-online="true"');
    expect(html).toContain('data-skipped="true"');
  });
  it('is CSS 3D and gradients only: tumble, cubie cells, six sticker axes, no images', () => {
    const css = readFileSync('src/cinema/hatcheryIntro.module.css', 'utf8');
    expect(css).not.toMatch(/url\(/);
    expect(css).not.toMatch(/backdrop-filter/);
    expect(css).toMatch(/@keyframes spin/);
    expect(css).toContain('calc(var(--cx) * var(--step))');
    for (const axis of ['front', 'back', 'right', 'left', 'top', 'bottom']) expect(css).toContain(`.tile[data-intro-sticker="${axis}"]`);
    expect(css).toContain('--pass');
    expect(css).toContain('z-index: 8');
  });
  it('drives the move engine and the return flight with the shared cube helpers', () => {
    const source = readFileSync('src/cinema/HatcheryIntro.tsx', 'utf8');
    for (const helper of ['cubeScramble(', 'cubeInvertSequence(', 'cubeComposeTurn(', 'cubeApplyMove(', 'cubeCubieTransform(', 'cubeIntroFlight(']) expect(source).toContain(helper);
    expect(source).toContain("document.querySelector('[data-cube-control]')");
    expect(source).toContain('loop.stop(); onSolved();');
    expect(source).toContain('if (pose.done) { loop.stop(); onDocked(); }');
  });
  it('is mounted beside the film on the cinema page', () => {
    const page = readFileSync('src/app/cinema/page.tsx', 'utf8');
    expect(page).toContain("import { HatcheryIntro } from '@/cinema/HatcheryIntro';");
    expect(page).toContain('<HatcheryIntro />');
  });
});

describe('boot stage first paint', () => {
  it('is part of the server HTML so the HUD is covered before any script runs', () => {
    const html = renderToStaticMarkup(createElement(HatcheryIntro));
    expect(html).toContain('data-intro-stage');
    expect(html).toContain('--pass:0');
    expect((html.match(/data-intro-cubie/g) ?? []).length).toBe(26);
  });
  it('lets the layout hide an already-seen stage before paint', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).toContain("sessionStorage.getItem('hatchery.intro.v1')==='1'");
    expect(layout).toContain('prefers-reduced-motion: reduce');
    expect(layout).toContain("dataset.hatcheryIntroSeen='1'");
    expect(layout).toContain('/[?&]intro=/.test(location.search)');
    const css = readFileSync('src/cinema/hatcheryIntro.module.css', 'utf8');
    expect(css).toContain(':global(:root[data-hatchery-intro-seen]) .stage { display: none; }');
  });
});
