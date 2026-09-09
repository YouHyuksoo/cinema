import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DIALOGUE_PAGE_SIZE, JarvisDialogue } from '@/cinema/JarvisDialogue';

const css = readFileSync(new URL('../../../src/cinema/jarvis.module.css', import.meta.url), 'utf8');

describe('center reply stage', () => {
  it('shows several lines per page instead of a single 72-character strip', () => {
    expect(DIALOGUE_PAGE_SIZE).toBeGreaterThanOrEqual(180);
    const html = renderToStaticMarkup(createElement(JarvisDialogue, { text: '가'.repeat(DIALOGUE_PAGE_SIZE + 1), source: 'ai' }));
    expect(html).toContain('1 / 2');
    expect(html).toContain('가'.repeat(DIALOGUE_PAGE_SIZE));
    expect(css).toMatch(/\.dialogue p\s*{[^}]*min-height:\s*(6\.4em|7\.2em|8em)/);
  });
  it('gives the reply a grid share instead of letting the reactor eat leftover height', () => {
    expect(css).toMatch(/\.center\s*{[^}]*grid-template-areas:\s*"stage" "reply" "input"/);
    expect(css).toMatch(/\.center\s*{[^}]*grid-template-rows:\s*minmax\([^,]+,\s*1fr\) minmax\([^,]+,\s*[\d.]+fr\) auto/);
  });
  it('frames the center while keeping side streams readable without hovering', () => {
    expect(css).toMatch(/\.center\s*{[^}]*clip-path:\s*polygon\(/);
    expect(css).toMatch(/\.body\s*>\s*:not\(\.center\)\s*{[^}]*opacity:\s*1;/);
    expect(css).toMatch(/\.body\s*>\s*:not\(\.center\)\s*{[^}]*filter:\s*none;/);
    expect(css).toMatch(/\.wave::before\s*{[^}]*border-radius:\s*50%/);
  });
});
