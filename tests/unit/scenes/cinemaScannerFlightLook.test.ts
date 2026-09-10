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
