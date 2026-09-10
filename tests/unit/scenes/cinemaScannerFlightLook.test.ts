import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('scanner flight sphere look-up', () => {
  it('resolves colour, label and detail per connection state instead of per frame', () => {
    const source = readFileSync('src/cinema/ScannerTeslaEffect.tsx', 'utf8');
    expect(source).toContain('const looks=new Map<string,');
    expect(source).toContain('return {...pose,...look(index)};');
    expect(source).not.toContain('getComputedStyle(sources[index])');
    expect(source).not.toContain("sources[index].title.split");
  });
});

describe('reactor prank accent look-up', () => {
  it('reads the theme accent once per discharge instead of per frame', () => {
    const source = readFileSync('src/cinema/ReactorMenuPrank.tsx', 'utf8');
    expect(source).toContain("let started = 0, accent = '#5fe3ff';");
    expect(source).toContain("accent = getComputedStyle(root).getPropertyValue('--film-accent').trim() || '#5fe3ff';");
    expect(source).not.toContain("const accent = getComputedStyle(root)");
    expect(source.indexOf("accent = getComputedStyle(root)")).toBeGreaterThan(source.indexOf('const start = () => {'));
  });
});
