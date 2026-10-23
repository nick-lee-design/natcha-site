import { readFileSync } from 'node:fs';
import path from 'node:path';

// Decks the tests cover, read straight from /decks
export function visibleSlides(deckId: string): { id: string }[] {
  const deck = JSON.parse(readFileSync(path.join(process.cwd(), 'decks', `${deckId}.json`), 'utf8'));
  return deck.slides.filter((s: { hidden?: boolean }) => !s.hidden);
}
