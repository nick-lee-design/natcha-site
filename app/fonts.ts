import { Bricolage_Grotesque, Inter, JetBrains_Mono, Literata, Outfit } from 'next/font/google';

export const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz', 'wdth'], variable: '--font-display' });
export const text = Literata({ subsets: ['latin'], axes: ['opsz'], variable: '--font-text' });
// Kinetic hero wordmark and tagline
export const outfit = Outfit({ subsets: ['latin'], weight: ['300', '500', '800'], variable: '--font-outfit' });
// Services section
export const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
export const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-mono' });
