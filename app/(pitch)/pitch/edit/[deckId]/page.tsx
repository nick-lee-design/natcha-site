import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Editor } from '@/components/pitch/editor/Editor';
import { canEdit, editingAvailable } from '@/lib/pitch/access';
import { storage } from '@/lib/pitch/storage';

export const dynamic = 'force-dynamic';

export default async function EditPage({ params, searchParams }: PageProps<'/pitch/edit/[deckId]'>) {
  const { deckId } = await params;
  if (!(await canEdit())) {
    const wrong = (await searchParams).wrong;
    return (
      <main className="mx-auto max-w-sm px-4 py-24">
        <h1 className="mb-2 text-xl font-semibold tracking-[-.02em]">Editing</h1>
        {editingAvailable() ? (
          <form action="/api/pitch/unlock" method="post" className="space-y-3">
            <input type="hidden" name="back" value={`/pitch/edit/${deckId}`} />
            <label className="block">
              <span className="mb-1 block text-sm text-stone-600">Edit key</span>
              <input name="key" type="password" required autoFocus className="ui-input" />
            </label>
            {wrong ? <p className="text-sm text-red-700">That key didn’t match.</p> : null}
            <button className="ui-button is-primary w-full">Unlock</button>
          </form>
        ) : (
          <p className="text-stone-600">
            Editing is off on this server. Edit locally, or connect hosted storage.{' '}
            <Link href="/pitch" className="underline">
              Back to decks
            </Link>
          </p>
        )}
      </main>
    );
  }
  const deck = await storage.get(deckId);
  if (!deck) notFound();
  return <Editor initial={deck} />;
}
