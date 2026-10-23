import type { Metadata, Viewport } from 'next';
import { display, inter, mono, outfit, text } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://taloengine.com'),
  title: 'TALO Engine: MEP design coordination, orchestrated',
  description: 'TALO Engine is Natcha Kucita’s direct MEP design coordination practice — implementation advice, model coordination and deliverables, backed by advanced AI and automation tools.',
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`dark ${display.variable} ${text.variable} ${outfit.variable} ${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
