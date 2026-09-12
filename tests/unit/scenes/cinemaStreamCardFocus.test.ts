import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_FOCUS_IDREF_ATTRIBUTES, CARD_FOCUS_INTERACTIVE, CARD_FOCUS_THEME_VARS, fallbackCardLabel } from '@/cinema/jarvisCardFocusUtils';

describe('Jarvis stream card focus', () => {
  it('defines stable activation and clone contracts', () => {
    for (const selector of ['button', 'a', 'input', 'select', 'textarea', 'summary', 'label', '[role="button"]']) expect(CARD_FOCUS_INTERACTIVE).toContain(selector);
    expect(CARD_FOCUS_IDREF_ATTRIBUTES).toContain('aria-labelledby');
    expect(CARD_FOCUS_THEME_VARS).toContain('--film-accent');
    expect(fallbackCardLabel('DATA / ANALYSIS', 2)).toBe('DATA / ANALYSIS 카드 3');
    const source = readFileSync('src/cinema/jarvisCardFocusUtils.ts', 'utf8');
    expect(source).toContain("querySelectorAll<HTMLElement>('[id]')");
    expect(source).toContain("element.removeAttribute('href')");
    expect(source).toContain("getContext('2d')?.drawImage");
    expect(source).toContain('getComputedStyle(source)');
    expect(source).toContain('url\\(#([^)]+)\\)');
  });

  it('renders one inert, keyboard-contained body portal with a read-only clone', () => {
    const source = readFileSync('src/cinema/JarvisCardFocus.tsx', 'utf8');
    const css = readFileSync('src/cinema/jarvisCardFocus.module.css', 'utf8');
    expect(source).toContain('createPortal(');
    expect(source).toContain('document.body');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("event.key === 'Tab'");
    expect(source).toContain('savedInert.set(child, child.inert)');
    expect(source).toContain('cloneHost.addEventListener(type, blockCloneEvent, true)');
    expect(source).toContain('duration:280');
    expect(source).toContain('MutationObserver');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('width:min(760px,calc(100vw - 32px))');
  });

  it('decorates and delegates every direct stream card while preserving nested controls', () => {
    const stream = readFileSync('src/cinema/JarvisStream.tsx', 'utf8');
    const main = readFileSync('src/cinema/JarvisMain.tsx', 'utf8');
    expect(stream).toContain('suspended?: boolean');
    expect(stream).toContain('onFocusCard?:');
    expect(stream).toContain("child.tagName !== 'SECTION'");
    expect(stream).toContain('new MutationObserver(decorateCards)');
    expect(stream).toContain('isCardInteractiveTarget(event.target, card)');
    expect(stream).toContain('event.target !== card');
    expect(main.match(/onFocusCard={focusCard}/g)).toHaveLength(2);
    expect(main.match(/suspended={Boolean\(cardFocus\)}/g)).toHaveLength(2);
    expect(main).toContain('{cardFocus && <JarvisCardFocus');
    expect(main.match(/data-card-title/g)).toHaveLength(3);
  });
});
