import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup as renderMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FilmTurbineMenu } from '@/cinema/FilmTurbineMenu';
import { runTurbineCommand } from '@/cinema/turbineCommands';
import { ScreenObjectProvider } from '@/cinema/ScreenObjectContext';
import { createScreenObjectRegistry } from '@/cinema/screenObjectRegistry';

const renderToStaticMarkup = (element: ReturnType<typeof createElement>) =>
  renderMarkup(createElement(ScreenObjectProvider, { registry: createScreenObjectRegistry(), children: element }));

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
    expect(css).toContain('.menu[data-turbine-open=false] .legendContent>span { display:none; }');
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
    expect(css).toContain('.menu[data-turbine-open=true] .art { transform:scale(calc(var(--expanded) / 300px)); }');
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
  it('opens from anywhere on the folded instrument, not only from the hub', () => {
    const source = readFileSync('src/cinema/FilmTurbineMenu.tsx', 'utf8');
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    // A click on the folded disc opens; the hub and the blades keep their own handlers.
    expect(source).toContain('if (open || !(event.target instanceof Element) || event.target.closest(\'button\')) return;');
    expect(source).toMatch(/onClick=\{event => \{[\s\S]{0,400}setMenuOpen\(true\);/);
    expect(css).toContain('.menu[data-turbine-open=false] .hoverTarget { cursor:pointer; }');
    expect(css).toContain('.hoverTarget { position:absolute; inset:0; border-radius:50%; pointer-events:auto;');
  });
  it('slightly enlarges around the same center on hover and expands the folded hub hit area', () => {
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    expect(css).toContain('.menu[data-turbine-open=false]:hover .art');
    expect(css).toContain('transform:scale(calc(var(--hatchery-orb-scale,.5333) * 1.22))');
    expect(css).toContain('.menu[data-turbine-open=false] .hub::before');
    expect(css).toContain('inset:-18px');
    expect(css).toContain('animation:turbineHoverPulse 1.5s ease-in-out infinite;');
  });
  it('plays the shared transition sound when the turbine expands', () => {
    const source = readFileSync('src/cinema/FilmTurbineMenu.tsx', 'utf8');
    expect(source).toContain("import { playFilmTransitionSound } from './filmTransitionSound'");
    expect(source).toContain('if (next && !current) playFilmTransitionSound();');
  });
  it('routes each command explicitly and never starts camera or voice on menu open', () => {
    const actions = { home: vi.fn(), briefing: vi.fn(), settings: vi.fn(), logout: vi.fn(), conversation: vi.fn() };
    for (const command of ['home', 'briefing', 'settings', 'logout', 'conversation'] as const) {
      runTurbineCommand(command, actions);
      expect(actions[command]).toHaveBeenCalledTimes(1);
    }
  });
  it('starts voice recognition from the current film without returning to the main preview', () => {
    const source = readFileSync('src/cinema/useFilmTurbine.ts', 'utf8');
    expect(source).toContain('conversation() { if (!voice.active) void voice.start(); }');
    expect(source).not.toContain('conversation() { home();');
  });
});

describe('turbine placement on small screens', () => {
  it('keeps one layout box and animates corner placement through transforms', () => {
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    expect(css).toContain('width:300px; height:300px;');
    expect(css).toContain('left:max(16px,env(safe-area-inset-left));');
    expect(css).toContain('transform:translate(calc((var(--orb) - 300px) / 2),calc((300px - var(--orb)) / 2))');
    expect(css).not.toContain('@property --turbine-spin');
    expect(css).toContain('animation:turbineCounterSpin 100s linear infinite;');
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
    expect(css).toContain('--orb:var(--hatchery-orb-diameter,120px);');
    expect(mobile).not.toContain('width:var(--expanded); height:var(--expanded);');
    // Tucked into the corner: 6px from the left edge, 10px from the bottom (the globe keeps its own 16px edge).
    expect(css).toContain('bottom:max(20px,env(safe-area-inset-bottom));');
    expect(mobile).toContain('transform:scale(var(--hatchery-orb-scale,.5333));');
    expect(mobile).toContain('.menu[data-turbine-open=true] .art { transform:scale(calc(var(--expanded) / 300px)); }');
    const hook = readFileSync('src/cinema/useFilmMenuGlobe.ts', 'utf8');
    for (const name of ['--hatchery-orb-diameter', '--hatchery-orb-scale', '--hatchery-orb-open-scale']) expect(hook).toContain(name);
  });
});
