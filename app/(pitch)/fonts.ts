import { Inter, JetBrains_Mono } from 'next/font/google';

export const sans = Inter({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-pitch-sans' });
export const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-pitch-mono' });
