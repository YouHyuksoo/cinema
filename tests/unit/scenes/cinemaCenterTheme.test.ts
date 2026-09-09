import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createFilmThemeContext } from '@/cinema/filmThemeCanvas';
import { drawJarvisVoiceField } from '@/cinema/drawJarvisVoiceField';
import { reactorEasterEggFrame } from '@/cinema/reactorEasterEgg';
import { FILM_THEMES } from '@/cinema/filmThemes';

const source = (file: string) => readFileSync(`src/cinema/${file}`, 'utf8');
describe('central HUD theme wiring', () => {
  it('recolors the real reactor draw while preserving molten-eye and explosion colors', () => {
    const render = (theme: typeof FILM_THEMES[number]['id'], time: number) => {
      const colors: string[] = [];
      const gradient = () => ({ addColorStop(_offset: number, color: string) { colors.push(color); } });
      const raw = new Proxy({ createLinearGradient: gradient, createRadialGradient: gradient } as unknown as CanvasRenderingContext2D, {
        get(target, key) { return Reflect.get(target, key) ?? (() => {}); },
        set(target, key, value) { if (['fillStyle', 'strokeStyle', 'shadowColor'].includes(String(key)) && typeof value === 'string') colors.push(value); return Reflect.set(target, key, value); },
      });
      const themed = createFilmThemeContext(raw, theme);
      drawJarvisVoiceField(themed.ctx, { time, phase: 'idle', level: .5, egg: reactorEasterEggFrame(time) }, raw);
      return colors;
    };
    const cyan = render('cyan', 0);
    for (const { id } of FILM_THEMES.filter(theme => theme.id !== 'cyan')) {
      expect(render(id, 0)).not.toEqual(cyan);
      for (const time of [13.5, 17.3]) {
        const warm = (colors: string[]) => colors.filter(color => /^#ff[\da-f]{4,6}$/i.test(color));
        expect(warm(render(id, time)), `${id}/${time}`).toEqual(warm(render('cyan', time)));
      }
    }
  });
  it('derives decorative CSS colors from the shared palette', () => {
    for (const file of ['jarvisCenterBackdrop.module.css', 'jarvisCenterLayout.module.css']) {
      const css = source(file);
      expect(css).toContain('var(--film-accent)');
      for (const hex of css.match(/#[\da-f]{6,8}\b/gi) ?? []) {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        expect(Math.max(r, g, b) - Math.min(r, g, b), `${file}: ${hex}`).toBeLessThan(20);
      }
    }
  });
  it('passes the selected theme to the reactor without restarting its animation effect', () => {
    expect(source('SignalFilm.tsx')).toContain('theme={player.theme}');
    expect(source('JarvisMain.tsx')).toContain('<JarvisWave theme={theme}');
    const wave = source('JarvisWave.tsx');
    expect(wave).toContain('createFilmThemeContext');
    expect(wave).toContain('setTheme(theme)');
    expect(wave).toContain('}, [audio]);');
  });
});
