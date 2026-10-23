import type { Deck } from '../schema';

export type DeckSummary = { id: string; name: string; client: string; slides: number };

// Slide code only ever talks to this, so a hosted store can replace the file adapter
export interface StorageAdapter {
  readonly hosted: boolean;
  list(): Promise<DeckSummary[]>;
  get(id: string): Promise<Deck | null>;
  save(deck: Deck): Promise<void>;
  // Uploaded images; returns the URL to put in the deck
  saveAsset(deckId: string, name: string, data: Uint8Array, contentType: string): Promise<string>;
  // Hosted stores serve uploaded images through the app (local ones are plain files in /public)
  getAsset?(deckId: string, name: string): Promise<{ data: Uint8Array; contentType: string } | null>;
}

export const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
export const SAFE_ASSET = /^[a-z0-9][a-z0-9-]{0,60}\.(jpg|png|webp|svg|gif)$/;
