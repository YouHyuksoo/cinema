# Mistral Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mistral as a selectable, testable CINEMA text-chat provider without changing the OpenAI Realtime voice path.

**Architecture:** Extend the existing provider catalog and server request adapter. Reuse the current key vault, masking, admin API, and selector components; add only the Mistral wire format and response normalization.

**Tech Stack:** Next.js 16 route handlers, React 19, TypeScript, Vitest, Mistral Chat Completions REST API

---

### Task 1: Provider contract and tests

**Files:**
- Modify: `tests/unit/scenes/cinemaAiConfig.test.ts`
- Modify: `tests/unit/scenes/cinemaAiServer.test.ts`

- [ ] Add failing assertions for provider order, Mistral model catalog, readiness, key retention, masked status, request URL/header/body, string response, and text-block response.
- [ ] Run `npx vitest run tests/unit/scenes/cinemaAiConfig.test.ts tests/unit/scenes/cinemaAiServer.test.ts` and confirm failures are specific to missing Mistral support.

### Task 2: Provider catalog and key readiness

**Files:**
- Modify: `src/cinema/aiConfig.ts`
- Modify: `src/cinema/screenCommands.ts`

- [ ] Add `mistral` to `AiProviderId` and `AI_PROVIDERS` with `mistral-small-latest`, `mistral-medium-latest`, and `mistral-large-latest`; use Small as the first/default suggestion.
- [ ] Add Mistral readiness from the existing key vault and add its ID to the screen-command provider options.
- [ ] Run the focused tests and confirm catalog, parsing, key switching, masking, and readiness pass.

### Task 3: Mistral request adapter

**Files:**
- Modify: `src/server/cinema/aiProviders.ts`

- [ ] Add a request-builder branch for `https://api.mistral.ai/v1/chat/completions` with Bearer authentication and `{ model, messages, temperature, max_tokens }`.
- [ ] Prefix the conversation with a system message and preserve user/assistant history.
- [ ] Normalize `choices[0].message.content` when it is a string or an array of text blocks.
- [ ] Run the focused tests and confirm request and extraction assertions pass.

### Task 4: Documentation and verification

**Files:**
- Modify: `DESIGN.md`
- Modify: `README.md`

- [ ] Add Mistral to the supported text providers and document that it does not replace OpenAI Realtime voice.
- [ ] Run `npm run typecheck`, `npm run test:unit`, and `npm run build`.
- [ ] Commit source, tests, and docs as `feat(cinema): add Mistral chat provider`.

### Task 5: Secret configuration and deployment

**Files:**
- Server-only configuration under `D:\Project\cinema`; never stage or print the key.

- [ ] Push the local commits to `origin/main`.
- [ ] On JSIDC2, pull with `git pull --ff-only`, build, restart PM2 service `cinema`, and save PM2 state.
- [ ] Record the current ChatGPT provider/model, store and select Mistral through the server AI settings API, then run the live connection and chat checks without exposing the key.
- [ ] Restore the recorded ChatGPT provider/model and verify the external assistant status still reports Mistral as ready through the key vault.
