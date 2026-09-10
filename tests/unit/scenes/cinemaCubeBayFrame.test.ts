import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisMetricCards } from '@/cinema/JarvisMetricCards';

/** The cube bay wears the same HUD frame language as the metric cards instead of a plain 1px box. */
describe('cube bay HUD frame', () => {
  it('renders the bay frame SVG inside the strip with outline, rails, highlights and plates', () => {
    const html = renderToStaticMarkup(createElement(JarvisMetricCards));
    const frame = html.match(/<svg[^>]*data-cube-bay-frame="true"[^>]*>[\s\S]*?<\/svg>/)?.[0];
    expect(frame).toBeDefined();
    expect(frame).toContain('viewBox="0 0 160 160"');
    expect(frame).toContain('preserveAspectRatio="none"');
    // Cut corners top-right and bottom-left, like the bay always had.
    expect(frame).toContain('d="M3 3H131L157 29V157H29L3 131Z"');
    expect(frame!.match(/<path /g)!.length).toBeGreaterThanOrEqual(6);
    expect(html.indexOf('data-cube-bay-frame')).toBeLessThan(html.indexOf('LIVE METRICS'));
  });
  it('shows the frame only while the cube is docked and keeps the bay fill borderless', () => {
    const css = readFileSync('src/cinema/jarvisMetricCards.module.css', 'utf8');
    expect(css).toContain('.bayFrame { display:none; position:absolute; left:0; top:0; width:var(--hatchery-cube-bay,0px); height:100%;');
    expect(css).toContain(':global(:root[data-cube-docked="true"]) .bayFrame { display:block; }');
    expect(css).toMatch(/\.strip::before \{ display:none; left:0; width:var\(--hatchery-cube-bay,0px\); border:0; box-shadow:none;/);
    expect(css).toContain('clip-path:polygon(0 0,83.75% 0,100% 16.25%,100% 100%,16.25% 100%,0 83.75%)');
  });
});
