import type { Metadata, Viewport } from 'next';
import { display } from '../fonts';
import { mono, sans } from './fonts';
import './pitch.css';

export const metadata: Metadata = {
  title: 'Pitch · TALO Engine',
  icons: { icon: '/logo.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Pitch has its own root layout, so deck styles never reach the main site
export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
