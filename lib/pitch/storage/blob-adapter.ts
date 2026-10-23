import { get, list, put } from '@vercel/blob';
import type { Deck } from '../schema';
import { parseDeck } from '../validate';
import { FileAdapter } from './file-adapter';
import { SAFE_ID, SAFE_KEY, type PdfMeta, type StorageAdapter } from './types';

const P = 'pitch';

async function readPrivate(pathname: string) {
  const res = await get(pathname, { access: 'private' }).catch(() => null);
  if (!res || res.statusCode !== 200) return null;
  return new Uint8Array(await new Response(res.stream).arrayBuffer());
}

const text = (data: Uint8Array | null) => (data ? new TextDecoder().decode(data) : null);

// Vercel Blob, so decks can be edited in production. Decks and PDFs are private;
// images are public because browsers load them. Decks committed to /decks are the
// fallback, so the base deck works before anything is saved here.
export class BlobAdapter implements StorageAdapter {
  readonly hosted = true;
  private files = new FileAdapter();

  async list() {
    const [bundled, { blobs }] = await Promise.all([this.files.list(), list({ prefix: `${P}/decks/` })]);
    const ids = new Set([...bundled.map((d) => d.id), ...blobs.map((b) => b.pathname.slice(`${P}/decks/`.length, -'.json'.length))]);
    const decks = await Promise.all([...ids].map((id) => this.get(id)));
    return decks
      .filter((d): d is Deck => d !== null)
      .map((d) => ({ id: d.id, name: d.name, client: d.client.company, slides: d.slides.filter((s) => !s.hidden).length }));
  }

  async get(id: string) {
    if (!SAFE_ID.test(id)) return null;
    const raw = text(await readPrivate(`${P}/decks/${id}.json`));
    return raw ? parseDeck(JSON.parse(raw)) : this.files.get(id);
  }

  async save(deck: Deck) {
    const valid = parseDeck(deck);
    await put(`${P}/decks/${valid.id}.json`, JSON.stringify(valid, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }

  async saveAsset(deckId: string, name: string, data: Uint8Array, contentType: string) {
    const blob = await put(`${P}/assets/${deckId}/${name}`, Buffer.from(data), { access: 'public', contentType, addRandomSuffix: true });
    return blob.url;
  }

  async getPdf(deckId: string, key: string) {
    if (!SAFE_ID.test(deckId) || !SAFE_KEY.test(key)) return null;
    return readPrivate(`${P}/pdf/${deckId}/${key}.pdf`);
  }

  async putPdf(deckId: string, data: Uint8Array, meta: PdfMeta) {
    await put(`${P}/pdf/${deckId}/${meta.key}.pdf`, Buffer.from(data), {
      access: 'private',
      contentType: 'application/pdf',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    await put(`${P}/pdf/${deckId}/${meta.key}.json`, JSON.stringify(meta), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }

  async listPdfs(deckId: string) {
    const { blobs } = await list({ prefix: `${P}/pdf/${deckId}/` });
    const metas = await Promise.all(
      blobs.filter((b) => b.pathname.endsWith('.json')).map(async (b) => JSON.parse(text(await readPrivate(b.pathname)) ?? 'null') as PdfMeta | null),
    );
    return metas.filter((m): m is PdfMeta => m !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
