import Link from 'next/link';
import { notFound } from 'next/navigation';
import { storage } from '@/lib/pitch/storage';

export const dynamic = 'force-dynamic';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Every PDF made for a deck, so any version a client received can be found again
export default async function ArchivePage({ params }: PageProps<'/pitch/archive/[deckId]'>) {
  const deck = await storage.get((await params).deckId);
  if (!deck) notFound();
  const pdfs = await storage.listPdfs(deck.id);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
      <Link href="/pitch" className="text-sm text-stone-500 hover:text-stone-900">
        Pitch
      </Link>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-[-.02em]">{deck.name} PDFs</h1>
      {pdfs.length ? (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm">
          {pdfs.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <div className="font-medium">{p.filename}</div>
                <div className="font-mono text-xs text-stone-500">
                  {when(p.createdAt)} · {size(p.size)} · {p.key}
                </div>
              </div>
              <a className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-stone-100" href={`/api/pitch/pdf/${deck.id}?version=${p.key}`}>
                Download
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-stone-500">No PDFs yet. They’re kept here each time one is downloaded.</p>
      )}
    </main>
  );
}
