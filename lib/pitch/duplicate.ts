import { randomBytes } from 'node:crypto';
import type { Deck } from './schema';

const slug = (s: string) =>
  s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

// Share links carry the id, so it ends in a random part that can't be guessed
export function newDeckId(company: string) {
  return `${slug(company) || 'deck'}-${randomBytes(8).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}`;
}

export function clientDeck(source: Deck, client: { company: string; name: string }): Deck {
  const deck = structuredClone(source);
  return {
    ...deck,
    id: newDeckId(client.company),
    name: client.company ? `${client.company} pitch` : `${source.name} copy`,
    client,
    date: new Date().toISOString().slice(0, 10),
    reference: '',
  };
}
