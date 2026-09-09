import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FilmTurbineMenu } from '@/cinema/FilmTurbineMenu';
import { runTurbineCommand } from '@/cinema/turbineCommands';

describe('five-blade turbine commands', () => {
  it('uses an oblique bird-view pose and translucent surfaces without fading labels', () => {
    const css = readFileSync('src/cinema/filmTurbineMenu.module.css', 'utf8');
    expect(css).toContain('transform:rotateX(40deg);');
    expect(css).not.toMatch(/rotateY\(|rotateZ\(/);
    const blade = readFileSync('src/cinema/TurbineBlade.tsx', 'utf8');
    expect(blade).toContain('fillOpacity=".72"');
    expect(blade).toContain('<pattern');
    expect(blade).toContain('translate(0 18)');
    expect(css).toContain('.menu[data-turbine-open=true] .thickness { opacity:1; }');
    expect(css).toContain('.menu[data-turbine-open=true] .legend { opacity:1;');
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
    for (const name of ['메인메뉴', '브리핑', '정지', '시작', 'AI대화']) expect(html).toContain(name);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('inert=""');
    expect(html).not.toMatch(/<img|<image|\.png/);
  });
  it('routes each command explicitly and never starts camera or voice on menu open', () => {
    const actions = { home: vi.fn(), briefing: vi.fn(), pause: vi.fn(), play: vi.fn(), conversation: vi.fn() };
    for (const command of ['home', 'briefing', 'pause', 'play', 'conversation'] as const) {
      runTurbineCommand(command, actions);
      expect(actions[command]).toHaveBeenCalledTimes(1);
    }
  });
});
