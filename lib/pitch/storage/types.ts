import type { Deck } from '../schema';

export type DeckSummary = { id: string; name: string; client: string; slides: number };

export type PdfMeta = { key: string; filename: string; createdAt: string; size: number };

// Slide code only ever talks to this, so a hosted store can replace the file adapter
export interface StorageAdapter {
  readonly hosted: boolean;
  list(): Promise<DeckSummary[]>;
  get(id: string): Promise<Deck | null>;
  save(deck: Deck): Promise<void>;
  // Uploaded images; returns the URL to put in the deck
  saveAsset(deckId: string, name: string, data: Uint8Array, contentType: string): Promise<string>;
  // Every generated PDF is kept, so any version a client received can be found again
  getPdf(deckId: string, key: string): Promise<Uint8Array | null>;
  putPdf(deckId: string, data: Uint8Array, meta: PdfMeta): Promise<void>;
  listPdfs(deckId: string): Promise<PdfMeta[]>;
}

export const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
export const SAFE_KEY = /^[a-f0-9]{8,64}$/;
