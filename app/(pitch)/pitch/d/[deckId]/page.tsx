import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Player } from '@/components/pitch/player/Player';
import { storage } from '@/lib/pitch/storage';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export async function generateStaticParams() {
  return (await storage.list()).map((d) => ({ deckId: d.id }));
}

// The client-facing player
export default async function SharePage({ params }: PageProps<'/pitch/d/[deckId]'>) {
  const deck = await storage.get((await params).deckId);
  if (!deck) notFound();
  return <Player deck={deck} share />;
}
