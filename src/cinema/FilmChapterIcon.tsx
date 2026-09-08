import type { ReactNode } from 'react';
import type { FilmId } from './filmProgram';

const CHAPTER_ICONS: Record<FilmId, ReactNode> = {
  wave: <>
    <path d="M7 19V6a3 3 0 0 1 6 0v13a6 6 0 1 1-6 0Z" />
    <path d="M10 10v13m3-15h3m-3 5h3" />
    <circle cx="10" cy="24" r="2" />
    <path d="M24 8s-6 8-6 12a6 6 0 0 0 12 0c0-4-6-12-6-12Z" />
    <path d="M22 23c2 1 4 0 5-2" opacity=".5" />
  </>,
  gears: <>
    <path d="m10 3 3-.2.7 2.4 2.2.9 2.1-1.2 2 2.2-1.4 2 .7 2.3 2.3.8-.2 3-2.5.4-1.1 2.1.9 2.3-2.4 1.7-1.8-1.6-2.4.3-1.1 2.2-2.9-.6-.1-2.5-1.9-1.4-2.4.6-1.3-2.7 1.9-1.6.1-2.4-2-1.4 1-2.8 2.5.2L8 6.9 8.3 4.4Z" />
    <circle cx="11.9" cy="12.4" r="3.4" />
    <path d="m22 18 2-.4.9 1.8 1.8.6 1.6-1.1 1.3 1.6-1.3 1.6.1 1.8 1.5 1.3-.9 1.8-1.9-.5-1.6.9-.2 1.9-2 .2-.7-1.8-1.8-.6-1.6 1-1.3-1.5 1.2-1.6-.1-1.9-1.4-1.2.8-1.8 2 .4 1.5-.9Z" />
    <circle cx="23.9" cy="24" r="2.2" />
  </>,
  scan: <>
    <path d="M4 11V5h6m12 0h6v6m0 10v6h-6m-12 0H4v-6M2 16h28" />
    <path d="M11 21V11h10v10M11 13h10m-6 4h2" />
    <circle cx="16" cy="16" r="10" strokeDasharray="2 4" />
  </>,
  unfold: <>
    <path d="M3 5h8l-6 12M4 25h25m-9 0v-9h3v9m3 0V9h3v16M12 11l4 4-4 4m-4-4h8" />
    <path d="M12 25v-4h3v4" opacity=".6" />
  </>,
  trace: <>
    <path d="M3 3h8v9H3Zm2 3h4M7 12v6h6m6 0h9m-3-3 3 3-3 3" />
    <rect x="13" y="14" width="6" height="8" rx="1" />
    <path d="M16 22v6h9m-3-3 3 3-3 3" opacity=".6" />
    <circle cx="29" cy="28" r="1.5" />
  </>,
  console: <>
    <path d="M7 5h18l3 3v17l-3 3H7l-3-3V8Z M4 11h24" />
    <path d="M8 8h1m3 0h1m3 0h1M8 15l3 2-3 2m6-3h9M8 23h7m3 0h5" />
  </>,
  visor: <>
    <path d="M3 5h26v22H3ZM10 11h12v10H10ZM3 5l7 6m19-6-7 6M3 27l7-6m19 6-7-6" />
    <circle cx="16" cy="16" r="3" />
    <path d="M16 11v2m0 6v2m-6-5h3m6 0h3" />
  </>,
  visorPan: <>
    <path d="M9 6h14v20H9ZM12 10h8m-8 12h8M2 16h10m-10 0 3-3m-3 3 3 3m15-3h10m-3-3 3 3-3 3" />
    <circle cx="16" cy="16" r="3" />
  </>,
  bars: <>
    <path d="M4 27h25M6 27V17h4v10m4 0V11h4v16m4 0V5h4v22M4 9h6m10 0h9" />
    <path d="m6 17 2-2h4v10l-2 2m8-16 2-2v16l-2 2m8-22 2-2v22l-2 2" opacity=".55" />
  </>,
  pie: <>
    <path d="M16 9c-6.1 0-11 3.1-11 7s4.9 7 11 7c5.8 0 10.5-2.8 11-6.4L16 16Z" />
    <path d="M5 16v4c0 3.9 4.9 7 11 7 5.8 0 10.5-2.8 11-6.4v-4M16 23v4" />
    <path d="M19 5v7l10 .7C28.5 8.9 24.3 5.7 19 5Zm0 7v3l10 .7v-3" />
  </>,
  corners: <>
    <path d="M3 10V3h7m12 0h7v7m0 12v7h-7m-12 0H3v-7" />
    <path d="m19 13 6-6m-6 12 6 6M13 13 7 7m6 12-6 6" opacity=".6" />
    <path d="m16 10 6 6-6 6-6-6Z" />
    <circle cx="16" cy="16" r="2" />
  </>,
  machine: <>
    <rect x="7" y="2" width="18" height="28" rx="4" />
    <path d="M12 6h8M10 21h12m-12 4h12m-9-4v4m4-4v4m4-4v4" opacity=".6" />
    <rect x="12" y="10" width="8" height="7" rx="1" />
    <path d="M10 12h2m8 0h2m-12 3h2m8 0h2m-7-7v2m3-2v2m-3 7v2m3-2v2" />
  </>,
  network: <>
    <path d="m5 8 10 8 12-9M15 16l12 10M5 25l10-9M5 8v17m22-18v19" opacity=".5" />
    <circle cx="5" cy="8" r="3" /><circle cx="5" cy="25" r="2.5" />
    <circle cx="15" cy="16" r="4" /><circle cx="27" cy="7" r="3" /><circle cx="27" cy="26" r="3" />
  </>,
  energy: <>
    <path d="M2 12h5l4-8 6 16 5-12 4 4h4" />
    <path d="M3 25h26v5H3Zm4 0v5m4-5v5m4-5v5m4-5v5m4-5v5" />
    <path d="M3 20h5m17 0h4" opacity=".45" />
  </>,
  product: <>
    <ellipse cx="7" cy="16" rx="4" ry="9" /><ellipse cx="25" cy="16" rx="4" ry="9" />
    <path d="M7 7h9m4 0h5M7 25h9m4 0h5M4 16h24M15 5v22" opacity=".55" />
    <path d="m20 12-3 4 3 4m-8-7 3 3-3 3M3 29h26" />
  </>,
  spc: <>
    <path d="M3 5h26M3 15h26" opacity=".35" strokeDasharray="2 3" />
    <path d="m3 12 5-3 5 3 5-9 5 7 6-2" />
    <circle cx="18" cy="3" r="2" />
    <path d="M3 29h26M6 28v-5h4v5m4 0V18h4v10m4 0v-8h4v8" />
  </>,
};

export function FilmChapterIcon({ id, className }: { id: FilmId; className?: string }) {
  return (
    <svg className={className} width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor"
      strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {CHAPTER_ICONS[id]}
    </svg>
  );
}
