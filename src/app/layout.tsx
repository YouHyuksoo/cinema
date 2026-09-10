import type { Metadata } from 'next';
// Self-hosted typefaces (scripts/fetch-fonts.mjs): no Google Fonts fetch at build time, so an offline
// dev machine or a blocked CI runner cannot break the layout.
import './fonts/fonts.css';
import './globals.css';

export const metadata: Metadata = { title: 'HATCHERY HUD' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
