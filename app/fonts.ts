import { Bricolage_Grotesque, Literata, Outfit } from 'next/font/google';

export const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz', 'wdth'], variable: '--font-display' });
export const text = Literata({ subsets: ['latin'], axes: ['opsz'], variable: '--font-text' });
// Kinetic hero wordmark and tagline
export const outfit = Outfit({ subsets: ['latin'], weight: ['300', '500', '800'], variable: '--font-outfit' });
