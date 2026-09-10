import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Files are read with CRLF folded to LF so an autocrlf checkout behaves like the LF working tree. */
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

/**
 * On phones and tablets the main menu must not scroll as a page: the header stays, the centre keeps a
 * bounded stage so the chat input is always visible, and the two streams split the rest side by side
 * and scroll inside themselves.
 */
describe('main menu layout on small screens', () => {
  const css = read('src/cinema/jarvis.module.css');
  const mobile = css.slice(css.indexOf('@media(max-width:900px) {\n  .body'));
  it('pins the body as a non-scrolling grid with the centre on top and the streams beneath', () => {
    expect(mobile).toContain('.body { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); gap:12px; overflow:hidden; }');
    expect(mobile).toContain('.body>.center { grid-column:1/-1; grid-row:1; height:auto; overflow:clip; grid-template-rows:clamp(140px,24dvh,260px) minmax(5em,.3fr) auto; }');
    expect(mobile).toContain('.main[data-external-briefing=true] .body>.center { grid-template-rows:clamp(140px,24dvh,260px) auto; }');
    expect(mobile).toContain('.body>aside { min-height:0; }');
    expect(css).not.toContain('height:480px');
  });
  it('lets each stream fill its cell and scroll inside instead of forcing a fixed height', () => {
    const stream = read('src/cinema/jarvisStream.module.css');
    expect(stream).toContain('@media(max-width:900px) { .stream { height:100%; }.stream>footer { display:none; } }');
    expect(stream).not.toMatch(/height:430px|height:390px|grid-column:1\/-1|grid-row:4/);
    expect(stream).toContain('.viewport { flex:1; min-height:0; overflow-y:auto;');
  });
});

describe('briefing and header on small screens', () => {
  it('pins the briefing into the bottom band between the corner turbine and globe', () => {
    const css = read('src/cinema/film.module.css');
    expect(css).toContain('@media(max-width:760px) { .page { --film-briefing-offset:max(8px,var(--film-dock-space)); --film-briefing-height:124px; } }');
    expect(css).not.toContain('max(228px,var(--film-dock-space))');
    const panel = read('src/cinema/filmBriefing.module.css');
    expect(panel).toContain('@media(max-width:760px) { .panel { left:calc(var(--hatchery-orb-diameter,60px) + 14px); right:calc(var(--hatchery-orb-diameter,60px) + 14px);');
  });
  it('keeps only a sliver between the cube bay and the metric rail', () => {
    const strip = read('src/cinema/jarvisMetricCards.module.css');
    const mobile = strip.slice(strip.indexOf('@media(max-width:680px)'));
    expect(mobile).toContain('.strip { padding-left:calc(var(--hatchery-cube-bay,0px) + 8px); }');
    expect(mobile).toContain('.strip::after { left:calc(var(--hatchery-cube-bay,0px) + 8px); }');
  });
});

describe('main menu layout on wide screens', () => {
  it('lets the side streams grow with the viewport instead of capping them at 200px', () => {
    const css = read('src/cinema/jarvis.module.css');
    expect(css).toContain('.body { flex:1; min-height:0; display:grid; grid-template-columns:minmax(140px,clamp(200px,18vw,440px)) minmax(480px,1fr) minmax(140px,clamp(200px,18vw,440px));');
    expect(css).toMatch(/\.main \{ position:absolute; z-index:1; inset:max\(12px,env\(safe-area-inset-top\)\) clamp\(20px,3vw,56px\)/);
  });
});
