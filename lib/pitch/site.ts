// The public address used in links printed into PDFs
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://taloengine.com').replace(/\/$/, '');

export const enquireUrl = (deckId: string) => `${SITE_URL}/pitch/enquire/${deckId}`;
export const shareUrl = (deckId: string) => `${SITE_URL}/pitch/d/${deckId}`;
