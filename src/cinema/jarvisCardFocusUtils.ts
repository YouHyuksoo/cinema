export const CARD_FOCUS_INTERACTIVE = 'button,a,input,select,textarea,summary,label,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[contenteditable="true"]';

export const CARD_FOCUS_IDREF_ATTRIBUTES = [
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-details',
] as const;

export const CARD_FOCUS_THEME_VARS = [
  '--film-accent',
  '--film-accent-soft',
  '--film-panel',
  '--film-line',
  '--film-ink',
  '--film-muted',
  '--film-bg',
  '--font-korean',
  '--font-label',
  '--font-mono',
] as const;

export const fallbackCardLabel = (streamTitle: string, index: number) => `${streamTitle} 카드 ${index + 1}`;

const normalizedText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || '';

export function getStreamCardLabel(card: HTMLElement, streamTitle: string, index: number) {
  const ariaLabel = normalizedText(card.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;
  for (const selector of ['[data-card-title]', 'h2', 'summary']) {
    const title = normalizedText(card.querySelector<HTMLElement>(selector)?.textContent);
    if (title) return title;
  }
  return fallbackCardLabel(streamTitle, index);
}

export function isCardInteractiveTarget(target: EventTarget | null, card: HTMLElement) {
  if (!(target instanceof Element) || target === card) return false;
  const interactive = target.closest(CARD_FOCUS_INTERACTIVE);
  return Boolean(interactive && interactive !== card);
}

function rewriteIdReferences(clone: HTMLElement, idMap: Map<string, string>) {
  const elements = [clone, ...clone.querySelectorAll<HTMLElement>('*')];
  for (const element of elements) {
    for (const attribute of CARD_FOCUS_IDREF_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, value.split(/\s+/).map(id => idMap.get(id) ?? id).join(' '));
    }
    const htmlFor = element.getAttribute('for');
    if (htmlFor && idMap.has(htmlFor)) element.setAttribute('for', idMap.get(htmlFor)!);
    for (const attribute of ['href', 'xlink:href']) {
      const value = element.getAttribute(attribute);
      if (value?.startsWith('#') && idMap.has(value.slice(1))) element.setAttribute(attribute, `#${idMap.get(value.slice(1))}`);
    }
    for (const attribute of Array.from(element.attributes)) {
      const rewritten = attribute.value.replace(/url\(#([^)]+)\)/g, (match, id: string) => idMap.has(id) ? `url(#${idMap.get(id)})` : match);
      if (rewritten !== attribute.value) element.setAttribute(attribute.name, rewritten);
    }
  }
}

function deactivateClone(clone: HTMLElement) {
  for (const element of clone.querySelectorAll<HTMLElement>(CARD_FOCUS_INTERACTIVE)) {
    if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      element.disabled = true;
    }
    if (element instanceof HTMLAnchorElement) element.removeAttribute('href');
    element.tabIndex = -1;
    element.setAttribute('aria-disabled', 'true');
    element.style.pointerEvents = 'none';
  }
}

function copyCanvases(source: HTMLElement, clone: HTMLElement) {
  const sourceCanvases = source.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');
  sourceCanvases.forEach((canvas, index) => {
    const target = cloneCanvases.item(index);
    if (!target) return;
    try {
      target.width = canvas.width;
      target.height = canvas.height;
      target.getContext('2d')?.drawImage(canvas, 0, 0);
    } catch {
      // A canvas backed by protected media can be tainted; the rest of the card is still useful.
    }
  });
}

export function cloneStreamCard(source: HTMLElement, openId: number) {
  const clone = source.cloneNode(true) as HTMLElement;
  const idMap = new Map<string, string>();
  for (const element of [clone, ...clone.querySelectorAll<HTMLElement>('[id]')]) {
    if (!element.id) continue;
    const nextId = `card-focus-${openId}-${element.id}`;
    idMap.set(element.id, nextId);
    element.id = nextId;
  }
  rewriteIdReferences(clone, idMap);
  deactivateClone(clone);
  copyCanvases(source, clone);
  clone.removeAttribute('tabindex');
  clone.removeAttribute('data-stream-card');
  clone.setAttribute('aria-hidden', 'false');
  return clone;
}

export function readCardTheme(source: HTMLElement): Record<string, string> {
  const sourceStyle = getComputedStyle(source);
  const rootStyle = getComputedStyle(document.documentElement);
  const theme: Record<string, string> = {};
  for (const name of CARD_FOCUS_THEME_VARS) {
    const value = sourceStyle.getPropertyValue(name).trim() || rootStyle.getPropertyValue(name).trim();
    if (value) theme[name] = value;
  }
  return theme;
}
