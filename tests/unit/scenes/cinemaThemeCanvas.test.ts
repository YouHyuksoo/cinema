import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFilmColorMapper, createFilmThemeContext, getFilmContextTheme } from '@/cinema/filmThemeCanvas';
import { FILM_THEMES, type FilmThemeId } from '@/cinema/filmThemes';

function rgb(color: string) {
  if (color.startsWith('#')) return [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
  return color.slice(color.indexOf('(') + 1, color.lastIndexOf(')')).split(',').slice(0, 3).map(Number);
}

class NativeGradientFixture {
  #stops: [number, string][] = [];
  addColorStop(offset: number, color: string) { this.#stops.push([offset, color]); }
  get stops() { return this.#stops; }
}
class NativePatternFixture {}
class NativeContextFixture {
  #fill: string | NativeGradientFixture | NativePatternFixture = '#000';
  #draws = 0;
  strokeStyle = '#000';
  shadowColor = 'transparent';
  lastGradient?: NativeGradientFixture;
  get fillStyle() { return this.#fill; }
  set fillStyle(value: string | NativeGradientFixture | NativePatternFixture) {
    if (typeof value !== 'string' && !(value instanceof NativeGradientFixture) && !(value instanceof NativePatternFixture)) {
      throw new TypeError('A native gradient or pattern is required');
    }
    this.#fill = value;
  }
  fillRect() { this.#draws++; }
  get draws() { return this.#draws; }
  createLinearGradient() { this.#draws++; return this.lastGradient = new NativeGradientFixture(); }
  createRadialGradient() { this.#draws++; return this.lastGradient = new NativeGradientFixture(); }
  createConicGradient() { this.#draws++; return this.lastGradient = new NativeGradientFixture(); }
  createPattern() { this.#draws++; return new NativePatternFixture(); }
}

afterEach(() => vi.restoreAllMocks());

describe('film palette conversion', () => {
  it('keeps offscreen surfaces in the current parent palette when the theme changes', () => {
    const parent = createFilmThemeContext(new NativeContextFixture() as unknown as CanvasRenderingContext2D);
    const child = createFilmThemeContext(new NativeContextFixture() as unknown as CanvasRenderingContext2D);
    for (const theme of FILM_THEMES) {
      parent.setTheme(theme.id);
      child.setTheme(getFilmContextTheme(parent.ctx));
      parent.ctx.fillStyle = '#5fe3ff'; child.ctx.fillStyle = '#5fe3ff';
      expect(child.ctx.fillStyle).toBe(parent.ctx.fillStyle);
      expect(rgb(child.ctx.fillStyle as string)).toEqual(rgb(theme.accent));
    }
  });

  it('leaves every color string untouched in the default theme', () => {
    const map = createFilmColorMapper('cyan');
    for (const color of ['#5fe3ff', 'rgba(95,227,255,.035)', '#ffc16880', '#fff', 'transparent', 'color(display-p3 1 0 0)']) {
      expect(map(color)).toBe(color);
    }
  });

  it('matches the UI accent and warning swatches exactly for every theme', () => {
    for (const theme of FILM_THEMES) {
      const map = createFilmColorMapper(theme.id);
      expect(rgb(map('#5fe3ff')), theme.id).toEqual(rgb(theme.accent));
      expect(rgb(map('#ffc168')), theme.id).toEqual(rgb(theme.warning));
    }
  });

  it('preserves alpha across hex, legacy RGB and modern RGB syntax', () => {
    const map = createFilmColorMapper('emerald');
    expect(map('rgba(95,227,255,.035)')).toBe('rgba(95,255,180,0.035)');
    expect(map('rgb(95 227 255 / 25%)')).toBe('rgba(95,255,180,0.25)');
    expect(map('#5fe3ff80')).toBe(`rgba(95,255,180,${128 / 255})`);
    expect(map('#0ff8')).toMatch(/,0\.5333333333333333\)$/);
    expect(map('rgb(0% 100% 100% / 0)')).toMatch(/,0\)$/);
  });

  it('keeps true greys and unsupported or invalid CSS values unchanged', () => {
    const map = createFilmColorMapper('rose');
    for (const color of ['#fff', '#000', '#777', '#eeeeeeee', 'rgba(128,128,128,.2)', 'rgb(17.5 17.5 17.5)',
      'transparent', 'hsl(190 100% 60%)', 'var(--color)', '#ggg', 'rgb(1,2)', 'rgba(1,2,3,no)', 'rgb(10%,20,30)']) {
      expect(map(color), color).toBe(color);
    }
  });

  it('preserves warning tint variations outside the amber theme', () => {
    for (const theme of ['emerald', 'blue', 'rose'] as FilmThemeId[]) {
      const map = createFilmColorMapper(theme);
      for (const color of ['#ffc168', '#ffdda3', 'rgba(242,209,153,.018)']) expect(map(color)).toBe(color);
    }
  });

  it('retains light and dark variations and changes heat blends continuously', () => {
    for (const theme of ['emerald', 'blue', 'amber', 'rose'] as FilmThemeId[]) {
      const map = createFilmColorMapper(theme);
      const lightness = (color: string) => { const channels = rgb(color); return (Math.min(...channels) + Math.max(...channels)) / 2; };
      expect(lightness(map('#c4e7f0'))).toBeGreaterThan(lightness(map('#398698')));
      let previous: number[] | undefined;
      for (let step = 0; step <= 200; step++) {
        const amount = step / 200;
        const source = [95 + 160 * amount, 227 - 34 * amount, 255 - 151 * amount].map(Math.round);
        const current = rgb(map(`rgb(${source.join(',')})`));
        if (previous) expect(Math.max(...current.map((channel, index) => Math.abs(channel - previous![index]))), `${theme}/${step}`).toBeLessThan(16);
        previous = current;
      }
    }
  });
});

describe('Canvas theme adapter', () => {
  it('binds native methods and getters to the original context and caches the bound function', () => {
    const raw = new NativeContextFixture();
    const { ctx } = createFilmThemeContext(raw as unknown as CanvasRenderingContext2D, 'emerald');
    expect(ctx.fillRect).toBe(ctx.fillRect);
    const draw = ctx.fillRect;
    draw(0, 0, 1, 1);
    expect(raw.draws).toBe(1);
    ctx.fillStyle = '#5fe3ff';
    expect(ctx.fillStyle).toBe('rgb(95,255,180)');
    ctx.strokeStyle = '#5fe3ff'; ctx.shadowColor = 'rgba(95,227,255,.5)';
    expect(raw.strokeStyle).toBe('rgb(95,255,180)');
    expect(raw.shadowColor).toBe('rgba(95,255,180,0.5)');
  });

  it('retains native gradient and pattern identity while converting all gradient kinds', () => {
    const raw = new NativeContextFixture();
    const adapter = createFilmThemeContext(raw as unknown as CanvasRenderingContext2D, 'emerald');
    for (const gradient of [adapter.ctx.createLinearGradient(0, 0, 1, 1),
      adapter.ctx.createRadialGradient(0, 0, 0, 0, 0, 10), adapter.ctx.createConicGradient(0, 0, 0)]) {
      expect(gradient).toBeInstanceOf(NativeGradientFixture);
      gradient.addColorStop(.5, '#5fe3ff');
      expect((gradient as unknown as NativeGradientFixture).stops).toEqual([[.5, 'rgb(95,255,180)']]);
      adapter.ctx.fillStyle = gradient;
      expect(raw.fillStyle).toBe(gradient);
    }
    const pattern = adapter.ctx.createPattern({} as CanvasImageSource, 'repeat')!;
    adapter.ctx.fillStyle = pattern;
    expect(raw.fillStyle).toBe(pattern);
    expect(pattern).toBeInstanceOf(NativePatternFixture);
  });

  it('switches themes for later writes and gradient stops, then restores exact default strings', () => {
    const raw = new NativeContextFixture();
    const adapter = createFilmThemeContext(raw as unknown as CanvasRenderingContext2D, 'emerald');
    const gradient = adapter.ctx.createLinearGradient(0, 0, 1, 1);
    adapter.setTheme('amber');
    gradient.addColorStop(0, '#ffc168');
    expect(raw.lastGradient!.stops).toEqual([[0, 'rgb(255,105,120)']]);
    adapter.ctx.fillStyle = '#5fe3ff';
    expect(raw.fillStyle).toBe('rgb(255,209,95)');
    adapter.setTheme('cyan');
    adapter.ctx.fillStyle = 'rgba(95,227,255,.035)';
    expect(raw.fillStyle).toBe('rgba(95,227,255,.035)');
  });

  it('retains the color cache when the playback loop repeats the current theme', () => {
    const raw = new NativeContextFixture();
    const adapter = createFilmThemeContext(raw as unknown as CanvasRenderingContext2D, 'rose');
    adapter.ctx.fillStyle = '#79b7a9';
    const parse = vi.spyOn(Number, 'parseInt');
    const round = vi.spyOn(Math, 'round');
    for (let frame = 0; frame < 10; frame++) {
      adapter.setTheme('rose');
      adapter.ctx.fillStyle = '#79b7a9';
    }
    expect(parse).not.toHaveBeenCalled();
    expect(round).not.toHaveBeenCalled();
  });
});
