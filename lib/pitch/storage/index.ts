import { BlobAdapter } from './blob-adapter';
import { FileAdapter } from './file-adapter';
import type { StorageAdapter } from './types';

export type { DeckSummary, StorageAdapter } from './types';

// Vercel Blob when a store is connected, otherwise JSON files in the repo
export const storage: StorageAdapter = process.env.BLOB_READ_WRITE_TOKEN ? new BlobAdapter() : new FileAdapter();
