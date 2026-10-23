import { canEdit } from '@/lib/pitch/access';
import { storage } from '@/lib/pitch/storage';
import { DeckList } from '@/components/pitch/home/DeckList';

export const dynamic = 'force-dynamic';

export default async function PitchHome() {
  const [decks, editable] = await Promise.all([storage.list(), canEdit()]);
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-8">
      <h1 className="mb-10 text-2xl font-semibold tracking-[-.02em]">Pitch</h1>
      {decks.length ? (
        <DeckList decks={decks} editable={editable} />
      ) : (
        <p className="text-stone-500">Nothing here yet.</p>
      )}
    </main>
  );
}
