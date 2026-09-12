import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('decorative loops stop when nothing moves', () => {
  it('paints the operator camera placeholder once and only loops while the camera is on', () => {
    const source = readFileSync('src/cinema/JarvisCamera.tsx', 'utf8');
    expect(source).toContain("if (camera.status === 'on') {");
    expect(source).toContain('} else paint();');
    expect(source).toContain('}, [camera.frameRef, camera.status]);');
  });
  it('drops the drift scroll frame loop while it is held and wakes it on the events that end the hold', () => {
    const source = readFileSync('src/cinema/useDriftScroll.ts', 'utf8');
    expect(source).toContain("if (stopped || !max) { position = viewport[scrollKey]; loop.stop(); last = 0;");
    expect(source).toContain('const wake = () => {');
    expect(source).toContain("viewport.addEventListener('scroll', onScroll, { passive: true });");
    expect(source).toContain('const leave = () => { hovered = false; wake(); };');
    expect(source).toContain('watchPageVisibility(hidden => { if (!hidden) wake(); })');
    expect(source).toContain('watchReducedMotion(value => { if (!value) wake(); })');
    expect(source).toContain('manualTimer = window.setTimeout(wake, manualMs);');
    expect(source).toContain('suspended?: boolean');
    expect(source).toContain('paused || suspended || hovered');
    expect(source).toContain('stopped: paused || suspended');
  });
  it('floats the management cube with CSS, measures the strip on layout, and only loops while a turn is in progress', () => {
    const source = readFileSync('src/cinema/FilmMenuCubeView.tsx', 'utf8');
    const css = readFileSync('src/cinema/filmMenuCube.module.css', 'utf8');
    expect(source).not.toContain('MEASURE_MS');
    expect(source).not.toMatch(/floatingY = 4 \* Math\.sin/);
    expect(source).toContain('new ResizeObserver');
    expect(source).toContain('[data-metric-strip]');
    expect(source).toContain('attributeFilter: [SHOCK_ATTRIBUTE]');
    expect(source).toContain('window.setTimeout(() => {');
    expect(source).toContain('CUBE_SHOWCASE_EVERY_MS');
    expect(source).toContain('if (!raf && !document.hidden && !reduced.matches && busy())');
    expect(css).toContain('@keyframes cubeFloat');
    expect(css).toMatch(/cubeFloat 4\.8s ease-in-out infinite/);
    expect(css).toContain('translateY(-4px)');
  });
});
