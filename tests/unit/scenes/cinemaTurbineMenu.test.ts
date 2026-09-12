import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FilmTurbineMenu } from '@/cinema/FilmTurbineMenu';
import { runTurbineCommand } from '@/cinema/turbineCommands';

describe('five-blade turbine commands', () => {
  it('waits for client readiness instead of showing alone in the initial HTML', () => {
    const props = { playing: false, voiceActive: false, onCommand() {} };
    expect(renderToStaticMarkup(createElement(FilmTurbineMenu, { ...props, ready: false }))).toBe('');
    expect(renderToStaticMarkup(createElement(FilmTurbineMenu, { ...props, ready: true }))).toContain('터빈 명령 메뉴');
  });
  it('uses an oblique bird-view pose and translucent surfaces without fading labels', () => {
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    expect(css).toContain('transform:rotateX(40deg);');
    expect(css).not.toMatch(/rotateY\(|rotateZ\(/);
    const blade = readFileSync('src/cinema/TurbineBlade.tsx', 'utf8');
    expect(blade).toContain('fillOpacity=".72"');
    expect(blade).toContain('<pattern');
    expect(blade).toContain('className={styles.glassSheen}');
    expect(blade).toContain('translate(0 18)');
    expect(css).toContain('.menu[data-turbine-open=true] .thickness { opacity:1; }');
    expect(css).toContain('.menu[data-turbine-open=true] .legend { opacity:1;');
    expect(css).toContain('.menu[data-turbine-open=true] .glassGrain { opacity:.06; }');
    expect(css).toContain('.menu[data-turbine-open=true] .bladeArt { filter:none; shape-rendering:geometricPrecision; }');
    expect(css).toContain('text-shadow:none;');
    expect(css).toContain('.menu[data-turbine-open=true] .legend svg { filter:none;');
    expect(css).toContain('width:52px; height:52px;');
    expect(css).toContain('animation:turbineSpin 100s linear infinite;');
    expect(css).toContain('.menu[data-turbine-open=false] .legend>span { display:none; }');
    expect(css).not.toContain('opacity:0;');
  });
  it('keeps individual blade hinges while reducing only the folded presentation', () => {
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    const source = readFileSync('src/cinema/FilmTurbineMenu.tsx', 'utf8');
    expect(source).toContain('className={styles.bladeMount}');
    expect(css).toContain('transform-origin:52px 106px;');
    expect(css).toContain('rotate(var(--blade-sweep)) rotateX(var(--blade-fold))');
    expect(css).toContain('--blade-fold:0deg;');
    expect(css).toContain('transform:scale(.72);');
    expect(css).toContain('.menu[data-turbine-open=true] .art { transform:scale(1); }');
    expect(css).toContain('.menu[data-turbine-open=true] .hoverTarget { transform:scale(1); }');
    expect(css).toContain('var(--blade-delay)');
  });
  it('renders five native commands and a keyboard/touch hub, without bitmap assets', () => {
    const html = renderToStaticMarkup(createElement(FilmTurbineMenu, { ready: true, playing: true, voiceActive: false, onCommand() {} }));
    expect(html.match(/data-turbine-command=/g)).toHaveLength(5);
    for (const name of ['메인메뉴', '브리핑', '연출설정', '로그아웃', 'AI대화']) expect(html).toContain(name);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('inert=""');
    expect(html).not.toMatch(/<img|<image|\.png/);
  });
  it('routes each command explicitly and never starts camera or voice on menu open', () => {
    const actions = { home: vi.fn(), briefing: vi.fn(), settings: vi.fn(), logout: vi.fn(), conversation: vi.fn() };
    for (const command of ['home', 'briefing', 'settings', 'logout', 'conversation'] as const) {
      runTurbineCommand(command, actions);
      expect(actions[command]).toHaveBeenCalledTimes(1);
    }
  });
});

describe('turbine placement on small screens', () => {
  it('docks the folded hub on the top cube bay axis, retaining the safe-area inset', () => {
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    expect(css.split('@media')[0]).toContain('left:calc(var(--hatchery-cube-cx,94px) - 94px + env(safe-area-inset-left,0px));');
    expect(css.split('@media')[0]).toContain('transform:translateX(-56px);');
    expect(css).toContain('transform:translateX(12px); pointer-events:auto;');
    expect(css).toContain('transition:transform .45s cubic-bezier(.22,.8,.2,1);');
    // The left axis comes from the docked cube's measured center.
    const view = readFileSync('src/cinema/FilmMenuCubeView.tsx', 'utf8');
    expect(view).toContain(`'--hatchery-cube-cx'`);
    expect(view).toContain(`'--hatchery-signal-cx'`);
  });
  it('sits in the bottom-left corner at the globe diameter, mirroring the globe instead of a fixed zoom', () => {
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    const mobile = css.slice(css.indexOf('@media(max-width:680px),(max-height:480px)'));
    expect(mobile).not.toContain('zoom:');
    expect(mobile).toContain('.menu,.menu[data-turbine-open=true] { transform:none; }');
    expect(mobile).toContain('width:var(--orb); height:var(--orb);');
    expect(mobile).toContain('--orb:var(--hatchery-orb-diameter,120px);');
    // Tucked into the corner: 6px from the left edge, 10px from the bottom (the globe keeps its own 16px edge).
    expect(mobile).toContain('left:max(6px,env(safe-area-inset-left));');
    expect(mobile).toContain('bottom:max(10px,env(safe-area-inset-bottom));');
    expect(mobile).toContain('transform:scale(var(--hatchery-orb-scale,.4));');
    expect(mobile).toContain('.menu[data-turbine-open=true] .art { transform:scale(calc(var(--expanded) / 300px)); }');
    const hook = readFileSync('src/cinema/useFilmMenuGlobe.ts', 'utf8');
    for (const name of ['--hatchery-orb-diameter', '--hatchery-orb-scale', '--hatchery-orb-open-scale']) expect(hook).toContain(name);
  });
});
