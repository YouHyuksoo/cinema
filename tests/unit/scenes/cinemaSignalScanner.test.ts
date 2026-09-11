import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisMetricCards } from '@/cinema/JarvisMetricCards';
import { JarvisSignalScanner } from '@/cinema/JarvisSignalScanner';


/** The strip's right bay holds a spinning signal scanner, mirroring the cube bay on the left; SVG/CSS only. */
describe('signal scanner bay', () => {
  it('rounds computed metal panel coordinates to avoid server/client trig differences', () => {
    const html=renderToStaticMarkup(createElement(JarvisSignalScanner));
    const paths=[...html.matchAll(/data-pedestal-panel="\d+"[^>]* d="([^"]+)"/g)];
    expect(paths).toHaveLength(7);
    for (const path of paths) expect(path[1]).not.toMatch(/\.\d{4}/);
  });
  it('shows four evidence-backed states and suppresses pretend detections while disconnected', () => {
    const html=renderToStaticMarkup(createElement(JarvisSignalScanner));
    expect(html).toContain('data-signal-active="false"');
    for (const id of ['db','mq','sensor','feed']) expect(html).toContain(`data-connection="${id}"`);
    expect(html).toContain('MQ 미연결');
    expect(html).toContain('SENSOR 미연결');
    expect(html).toContain('DB 미확인');
    const css=readFileSync('src/cinema/jarvisSignalScanner.module.css','utf8');
    expect(css).toContain('.scanner[data-signal-active=false] :is(.ping,.blip)');
  });
  it('sits in the strip inside a mirrored bay frame, drawn without bitmaps', () => {
    const html = renderToStaticMarkup(createElement(JarvisMetricCards));
    const bay = html.match(/<div class="[^"]*signalBay[^"]*" data-signal-bay="true">[\s\S]*?<\/div><div class="[^"]*stripBar/)?.[0];
    expect(bay).toBeDefined();
    expect(bay).toContain('data-cube-bay-frame="true"');
    expect(bay).toContain('data-signal-scanner="true"');
    expect(html).not.toMatch(/<img|<image|\.png/);
  });
  it('draws ring, pedestal disc, sweep and pings, and announces itself as one decorative image', () => {
    const html = renderToStaticMarkup(createElement(JarvisSignalScanner));
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="신호 감지기 상태 공전 실행"');
    expect(html).toContain('data-scanner-tesla="true" data-active="false"');
    expect(html).toContain('aria-label="신호 감지기 연출');
    expect(html).toContain('SIGNAL / SCAN');
    expect(html).toContain('<animateTransform attributeName="transform" type="rotate"');
    expect(html.match(/animation-delay/g)!.length).toBeGreaterThanOrEqual(8);
    // The disc sits on the rim's perspective: same ry/rx ratio as the drum top, inside a squashed group.
    expect(html).toMatch(/transform="translate\(100 57\) scale\(1 0\.31\d*\)"/);
    // Depth cues of the drum: shadow, shaded front wall, base band, panel seams, light strips, bevelled rim and lip.
    for (const part of ['hatchery-scan-shadow', 'hatchery-scan-wall', 'hatchery-scan-rim', 'hatchery-scan-lip', 'hatchery-scan-front']) expect(html).toContain(part);
    expect(html.match(/<line /g)!.length).toBeGreaterThanOrEqual(12);
    // The drum turns: the plate group and the sweep each carry a SMIL rotation (14s and 3.2s).
    expect(html.match(/<animateTransform /g)).toHaveLength(2);
    expect(html).toContain('dur="14s"'); expect(html).toContain('dur="3.2s"');
  });
  it('replaces the gyro with four status-colored orbiting spheres and preserves the pedestal', () => {
    const html = renderToStaticMarkup(createElement(JarvisSignalScanner));
    expect(html).not.toContain('data-gyro-axis');
    expect(html.match(/data-status-orb=/g)).toHaveLength(4);
    for (const id of ['db','mq','sensor','feed']) expect(html).toContain(`data-status-orb="${id}"`);
    expect(html.match(/data-pedestal-panel=/g)).toHaveLength(7);
    const orbs = readFileSync('src/cinema/scannerStatusOrbs.module.css', 'utf8');
    expect(orbs).toContain('transform-style:preserve-3d');
    expect(orbs).toContain('rotateX(65deg)');
    expect(orbs).toContain('rotateZ(1turn)');
    expect(orbs).toContain('rotateX(-65deg)');
    expect(orbs).toContain('[data-state=on] { --orb-color:#329dff; }');
    expect(orbs).toContain('[data-state=off] { --orb-color:#ff454f; }');
    expect(orbs).toContain('@media(prefers-reduced-motion:reduce)');
    expect(orbs).toContain('[data-still=true]');
    const css = readFileSync('src/cinema/jarvisSignalScanner.module.css', 'utf8');
    expect(css).toContain('@keyframes signalPing');
    // Floating: the drum bobs while its shadow shrinks; the wall bands slide to show the turn.
    expect(css).toContain('.drum { animation:signalFloat 4.2s ease-in-out infinite alternate; }');
    expect(css).toContain('@keyframes signalShadow');
    expect(css).toContain('.seamRing { fill:none; stroke:#03070a; stroke-width:9; stroke-dasharray:2 34; opacity:.9; animation:signalWall 14s linear infinite; }');
    expect(css).toContain('.scanner[data-still=true] :is(.ping,.blip,.beam,.wallLights,.seamRing,.drum,.shadow) { animation:none; }');
  });
  it('takes the cube bay width from the card rail on the right, but not on phones', () => {
    const css = readFileSync('src/cinema/jarvisMetricCards.module.css', 'utf8').replace(/\r\n/g, '\n');
    expect(css).toContain('.signalBay { display:none; position:absolute; right:0; top:0; bottom:0; width:var(--hatchery-cube-bay,0px);');
    expect(css).toContain('.signalBay .bayFrame { display:block; left:auto; right:0; transform:scaleX(-1); }');
    expect(css).toContain(':global(:root[data-cube-docked="true"]) .strip { padding-right:calc(var(--hatchery-cube-bay,0px) + 36px); }');
    expect(css).toContain(':global(:root[data-cube-docked="true"]) .strip::after { right:calc(var(--hatchery-cube-bay,0px) + 36px); }');
    const mobile = css.slice(css.indexOf('@media(max-width:680px)'));
    expect(mobile).toContain(':global(:root[data-cube-docked="true"]) .signalBay { display:none; }');
    expect(mobile).toContain(':global(:root[data-cube-docked="true"]) .strip { padding-right:0; }');
  });
});
