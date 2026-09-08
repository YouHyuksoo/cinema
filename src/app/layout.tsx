import type { Metadata } from 'next';
import { Orbitron, Rajdhani, Share_Tech_Mono, Noto_Sans_KR } from 'next/font/google';
import './globals.css';

const display = Orbitron({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display' });
const label = Rajdhani({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-label' });
const mono = Share_Tech_Mono({ subsets: ['latin'], weight: '400', variable: '--font-mono' });
const korean = Noto_Sans_KR({ subsets: ['latin'], weight: ['500'], variable: '--font-korean' });

export const metadata: Metadata = { title: 'JARVIS HUD' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} ${label.variable} ${mono.variable} ${korean.variable}`}>
      <body>{children}</body>
    </html>
  );
}
