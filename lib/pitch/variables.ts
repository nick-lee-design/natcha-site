import type { Deck } from './schema';

const PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function lookup(deck: Deck, key: string): string | undefined {
  switch (key) {
    case 'client.company': return deck.client.company;
    case 'client.name': return deck.client.name;
    case 'date': return formatDate(deck.date);
    case 'reference': return deck.reference;
  }
}

// Fills deck variables. Returns null when any variable is empty, so a line like
// "Prepared for {{client.company}}" disappears until the deck names a client.
export function resolveText(text: string, deck: Deck): string | null {
  let empty = false;
  const out = text.replace(PATTERN, (match, key: string) => {
    const value = lookup(deck, key);
    if (value === undefined) return match;
    if (!value.trim()) empty = true;
    return value;
  });
  return empty ? null : out;
}
