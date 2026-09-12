# Stream Card Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every direct card in the left and right Jarvis streams open as a readable central enlarged panel while preserving all original nested control behavior.

**Architecture:** `JarvisMain` owns one selected source element. `JarvisStream` decorates and delegates activation for its direct section children, while `JarvisCardFocus` portals a sanitized visual clone to `document.body`. Pure clone helpers isolate ID rewriting and control deactivation; `useDriftScroll` receives an external suspension flag without changing the user's pause choice.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Vitest, in-app browser verification.

---

## File map

- Create `src/cinema/jarvisCardFocusUtils.ts`: title extraction, interactive-target detection, clone sanitizing, ID/reference rewriting, canvas copying, theme variable extraction.
- Create `src/cinema/JarvisCardFocus.tsx`: portal lifecycle, modal accessibility, FLIP animation, focus and inert restoration.
- Create `src/cinema/jarvisCardFocus.module.css`: backdrop, central panel, responsive sizing and reduced-motion behavior.
- Modify `src/cinema/JarvisStream.tsx`: direct-card decoration and delegated pointer/keyboard activation.
- Modify `src/cinema/useDriftScroll.ts`: external `suspended` state kept separate from user pause state.
- Modify `src/cinema/JarvisMain.tsx`: stable left-card title markers, selected-card state, both stream callbacks, one focus layer.
- Create `tests/unit/scenes/cinemaStreamCardFocus.test.ts`: focused unit and markup/source contract tests.
- Modify `tests/unit/scenes/cinemaIdleLoops.test.ts`: external suspension contract.
- Modify `DESIGN.md`: record the shared interaction and impact path.

### Task 1: Clone and activation helpers

**Files:**
- Create: `src/cinema/jarvisCardFocusUtils.ts`
- Create: `tests/unit/scenes/cinemaStreamCardFocus.test.ts`

- [ ] **Step 1: Write failing helper contract tests**

Test exported constants and pure decisions without a browser DOM. Cover the interactive selector, ID-reference attribute list, theme variable allowlist, and title fallback normalization.

```ts
import { describe, expect, it } from 'vitest';
import { CARD_FOCUS_INTERACTIVE, CARD_FOCUS_THEME_VARS, fallbackCardLabel } from '@/cinema/jarvisCardFocus';

it('excludes every nested interactive control from card activation', () => {
  for (const selector of ['button', 'a', 'input', 'select', 'textarea', 'summary', 'label', '[role="button"]'])
    expect(CARD_FOCUS_INTERACTIVE).toContain(selector);
});

it('creates a stable fallback label', () => {
  expect(fallbackCardLabel('DATA / ANALYSIS', 2)).toBe('DATA / ANALYSIS 카드 3');
});
```

- [ ] **Step 2: Run the new test and verify it fails because the module is missing**

Run: `npx vitest run tests/unit/scenes/cinemaStreamCardFocus.test.ts`

Expected: FAIL resolving `@/cinema/jarvisCardFocus`.

- [ ] **Step 3: Implement focused helpers**

Export:

```ts
export const CARD_FOCUS_INTERACTIVE = 'button,a,input,select,textarea,summary,label,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="switch"],[contenteditable="true"]';
export const CARD_FOCUS_THEME_VARS = ['--film-accent', '--film-accent-soft', '--film-panel', '--film-line', '--film-ink', '--film-muted', '--film-bg', '--font-korean', '--font-label', '--font-mono'] as const;
export const fallbackCardLabel = (streamTitle: string, index: number) => `${streamTitle} 카드 ${index + 1}`;
```

Add DOM helpers that:

1. Prefer `aria-label`, then `[data-card-title]`, `h2`, `summary`, then the fallback for the card label. Add `data-card-title` to the existing left-card title elements in `JarvisMain`; never depend on a CSS Module's emitted class text.
2. Clone the source section.
3. Prefix every cloned ID with `card-focus-${openId}-`.
4. Rewrite whitespace-separated ARIA references, `for`, `href`, `xlink:href`, every SVG `url(#id)` attribute, and inline styles through the same map.
5. Disable native controls, remove cloned link destinations, set interactive nodes to `tabIndex=-1`, `aria-disabled=true`, and `pointer-events:none`.
6. Copy corresponding source canvases into clone canvases with `drawImage`, swallowing only per-canvas copy failure.
7. Return the clone plus an inline theme-variable object read from the source's computed style.

- [ ] **Step 4: Extend tests with source contract checks for ID remapping, control disabling, canvas copy, and theme variables**

Use the repository's existing `readFileSync` contract-test pattern because the Vitest environment has no DOM implementation.

- [ ] **Step 5: Run the focused test**

Run: `npx vitest run tests/unit/scenes/cinemaStreamCardFocus.test.ts`

Expected: PASS.

### Task 2: Externally suspend stream drift

**Files:**
- Modify: `src/cinema/useDriftScroll.ts`
- Modify: `tests/unit/scenes/cinemaIdleLoops.test.ts`

- [ ] **Step 1: Add a failing source contract test**

Require `DriftScrollOptions` to expose `suspended?: boolean`, require the stopped condition to include it, and require the return value to expose `stopped: paused || suspended`.

- [ ] **Step 2: Run the test and verify the missing suspension contract fails**

Run: `npx vitest run tests/unit/scenes/cinemaIdleLoops.test.ts`

Expected: FAIL on missing `suspended` source text.

- [ ] **Step 3: Implement suspension without overwriting user pause state**

Add `suspended = false` to the options, include it in the frame-loop stopped condition and effect dependencies, and return:

```ts
return { hostRef, viewportRef, paused, stopped: paused || suspended, toggle: () => setPaused(value => !value) };
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/scenes/cinemaIdleLoops.test.ts`

Expected: PASS.

### Task 3: Central focus portal

**Files:**
- Create: `src/cinema/JarvisCardFocus.tsx`
- Create: `src/cinema/jarvisCardFocus.module.css`
- Modify: `tests/unit/scenes/cinemaStreamCardFocus.test.ts`

- [ ] **Step 1: Add failing component and CSS contract tests**

Require a body portal, modal dialog, close button, `Escape` and Tab handling, body-child inert preservation, capture-phase activation suppression scoped to the clone content, a 280ms FLIP animation, and reduced-motion CSS.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run tests/unit/scenes/cinemaStreamCardFocus.test.ts`

Expected: FAIL because `JarvisCardFocus` and its CSS do not exist.

- [ ] **Step 3: Implement the portal lifecycle**

Use a client component with these props:

```ts
interface JarvisCardFocusProps {
  source: HTMLElement;
  label: string;
  openId: number;
  onClose(): void;
}
```

Create one direct `body` portal root. Preserve and set `inert=true` on all other direct body HTMLElement children. Append the sanitized clone directly under a wrapper carrying `jarvisStream.module.css`'s `content` class. Copy allowed theme variables onto the portal panel.

Maintain a transition lock ref with `opening`, `open`, and `closing` phases. Ignore repeated open/close requests while opening or closing; advance phases only from the animation's `finished` promise or its cancellation cleanup.

After layout, animate the panel from the source rect to the central rect. If the source is disconnected or its rect has zero width or height, skip FLIP and open directly at the central rect. While open, observe the owning document for source disconnection and close immediately without a return animation when it disappears. On ordinary close, reverse the animation when motion is allowed, remove the portal, restore all saved inert values, then focus the source only when it is still connected and visible.

The clone-content wrapper must capture and prevent `click`, `pointerdown`, `keydown`, `input`, `change`, `toggle`, and `submit`. Do not attach these handlers to the close button or backdrop. Trap `Tab` and `Shift+Tab` on the close button and close on `Escape`.

- [ ] **Step 4: Implement visual styling**

Use a dark HUD backdrop and central panel sized to `min(760px, calc(100vw - 32px))` with `max-height: calc(100dvh - 40px)`. Remove stream perspective and mask from the clone, allow vertical scrolling inside the card, retain theme border and cut corners, and disable transition movement under `prefers-reduced-motion`.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/unit/scenes/cinemaStreamCardFocus.test.ts`

Expected: PASS.

### Task 4: Integrate every direct stream card

**Files:**
- Modify: `src/cinema/JarvisStream.tsx`
- Modify: `src/cinema/JarvisMain.tsx`
- Modify: `tests/unit/scenes/cinemaStreamCardFocus.test.ts`
- Modify: `DESIGN.md`

- [ ] **Step 1: Add failing integration contract tests**

Require `JarvisStream` props for `suspended` and `onFocusCard`, direct-child decoration with a mutation observer, delegated click and keyboard handlers, the interactive-target exclusion, and both `JarvisMain` streams sharing one selected state and one `JarvisCardFocus`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/unit/scenes/cinemaStreamCardFocus.test.ts`

Expected: FAIL on the missing integration.

- [ ] **Step 3: Decorate and activate stream cards**

In `JarvisStream`, keep a content ref and decorate each direct section with `data-stream-card`, `tabIndex=0`, and an extracted accessible label. Observe direct-child changes so conditionally rendered history cards are also decorated. Delegate click and keydown from the content wrapper. Ignore events originating in `CARD_FOCUS_INTERACTIVE` descendants. For keyboard activation, require `event.target === card` as well as `Enter` or `Space`, then prevent the Space scroll default. Pass the source element, resolved label, side, and index to the callback.

Pass `suspended` into `useDriftScroll`; use `stopped` for `data-paused` while leaving the header toggle text based on the user's `paused` state.

- [ ] **Step 4: Own focus state in `JarvisMain`**

Add `data-card-title` to the `SESSION / CONNECTIONS`, `AI / 모델 선택`, `VOICE / 대화 설정`, and conditional `HISTORY / 이전 대화` title elements. Store `{ source, label, openId } | null`, pass `suspended={focus !== null}` and the same focus callback to both streams, and render one `JarvisCardFocus` after the body. Clear focus on close and unmount.

- [ ] **Step 5: Record the interaction rule**

Add a concise `DESIGN.md` entry covering target scope, internal-control exclusion, read-only clone, portal theme variables, modal accessibility, and impact path.

- [ ] **Step 6: Run related tests and static checks**

Run:

```powershell
npx vitest run tests/unit/scenes/cinemaStreamCardFocus.test.ts tests/unit/scenes/cinemaIdleLoops.test.ts
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 7: Verify in the live browser**

At `http://localhost:3010/cinema`, verify:

1. Left help and settings card backgrounds open centrally.
2. Right production and quality card backgrounds open centrally.
3. Original model buttons, selects, summary, and analysis buttons execute without opening the focus layer.
4. Expanded copies are readable and cannot activate controls.
5. Both streams stop while open and preserve a manually paused stream after close.
6. Backdrop, close button, and Escape close and restore source focus.
7. No duplicate IDs exist while open.
8. Desktop and a narrow portrait viewport keep the panel inside the screen.

- [ ] **Step 8: Inspect only the intended diff**

Run:

```powershell
git diff --check -- src/cinema/jarvisCardFocusUtils.ts src/cinema/JarvisCardFocus.tsx src/cinema/jarvisCardFocus.module.css src/cinema/JarvisStream.tsx src/cinema/useDriftScroll.ts src/cinema/JarvisMain.tsx tests/unit/scenes/cinemaStreamCardFocus.test.ts tests/unit/scenes/cinemaIdleLoops.test.ts DESIGN.md
```

Expected: no whitespace errors.
