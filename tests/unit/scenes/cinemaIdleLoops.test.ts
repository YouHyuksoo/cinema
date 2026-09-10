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
  });
});
