import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Deck } from '../schema';
import { parseDeck } from '../validate';
import { SAFE_ID, SAFE_KEY, type PdfMeta, type StorageAdapter } from './types';

const ROOT = process.cwd();
// Serverless file systems are read-only apart from /tmp
const ARCHIVE = process.env.VERCEL ? path.join(os.tmpdir(), 'pitch-archive') : path.join(ROOT, '.pitch-archive');

const checkId = (id: string) => {
  if (!SAFE_ID.test(id)) throw new Error(`Invalid deck id “${id}”`);
  return id;
};

// Decks as JSON files in /decks. Publishing a change means committing the file.
export class FileAdapter implements StorageAdapter {
  readonly hosted = false;

  constructor(private dir = path.join(ROOT, 'decks')) {}

  private file(id: string) {
    return path.join(this.dir, `${checkId(id)}.json`);
  }

  async list() {
    const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'));
    const decks = await Promise.all(files.map((f) => this.get(f.replace(/\.json$/, ''))));
    return decks
      .filter((d): d is Deck => d !== null)
      .map((d) => ({ id: d.id, name: d.name, client: d.client.company, slides: d.slides.filter((s) => !s.hidden).length }));
  }

  async get(id: string) {
    if (!SAFE_ID.test(id)) return null;
    try {
      return parseDeck(JSON.parse(await readFile(this.file(id), 'utf8')));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async save(deck: Deck) {
    const valid = parseDeck(deck);
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(valid.id), `${JSON.stringify(valid, null, 2)}\n`);
  }

  async saveAsset(deckId: string, name: string, data: Uint8Array) {
    const dir = path.join(ROOT, 'public', 'decks', checkId(deckId), 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), data);
    return `/decks/${deckId}/uploads/${name}`;
  }

  private pdfDir(deckId: string) {
    return path.join(ARCHIVE, checkId(deckId));
  }

  async getPdf(deckId: string, key: string) {
    if (!SAFE_KEY.test(key)) return null;
    try {
      return new Uint8Array(await readFile(path.join(this.pdfDir(deckId), `${key}.pdf`)));
    } catch {
      return null;
    }
  }

  async putPdf(deckId: string, data: Uint8Array, meta: PdfMeta) {
    const dir = this.pdfDir(deckId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${meta.key}.pdf`), data);
    const index = [meta, ...(await this.listPdfs(deckId)).filter((m) => m.key !== meta.key)];
    await writeFile(path.join(dir, 'index.json'), JSON.stringify(index, null, 2));
  }

  async listPdfs(deckId: string): Promise<PdfMeta[]> {
    try {
      return JSON.parse(await readFile(path.join(this.pdfDir(deckId), 'index.json'), 'utf8'));
    } catch {
      return [];
    }
  }
}
