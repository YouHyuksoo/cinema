/**
 * Browser-side path builder for the HATCHERY API routes. Every client call used to hardcode
 * `/api/cinema/...`, which breaks under a non-root `NEXT_PUBLIC_BASE_PATH`; the admin screen alone
 * handled it. Route through here so the base path is applied once.
 */
export const CINEMA_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** `cinemaApiUrl('assistant')` → `${basePath}/api/cinema/assistant`. Query strings pass through. */
export const cinemaApiUrl = (path: string) => `${CINEMA_BASE_PATH}/api/cinema/${path.replace(/^\/+/, '')}`;

/** Fetch an API route with JSON headers and no HTTP caching; `init` overrides both. */
export function cinemaApi(path: string, init?: RequestInit) {
  return fetch(cinemaApiUrl(path), {
    cache: 'no-store', ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}
