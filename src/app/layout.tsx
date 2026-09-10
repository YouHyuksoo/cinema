import type { Metadata } from 'next';
// Self-hosted typefaces (scripts/fetch-fonts.mjs): no Google Fonts fetch at build time, so an offline
// dev machine or a blocked CI runner cannot break the layout.
import './fonts/fonts.css';
import './globals.css';

export const metadata: Metadata = { title: 'HATCHERY HUD' };

/**
 * Runs before the first paint: the boot gate ships in the server HTML so the HUD is covered from the
 * start, and this marks the document when the gate must not show (already played this tab session,
 * or reduced motion) so its CSS can hide it without a flash. Mirrors shouldPlayIntro's gate.
 */
const INTRO_SEEN_SCRIPT = `try{if(!/[?&]intro=/.test(location.search)&&(sessionStorage.getItem('hatchery.intro.v1')==='1'||matchMedia('(prefers-reduced-motion: reduce)').matches))document.documentElement.dataset.hatcheryIntroSeen='1'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head><script dangerouslySetInnerHTML={{ __html: INTRO_SEEN_SCRIPT }} /></head>
      <body>{children}</body>
    </html>
  );
}
