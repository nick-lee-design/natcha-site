import { notFound } from 'next/navigation';
import { Player } from '@/components/pitch/player/Player';
import { storage } from '@/lib/pitch/storage';

export async function generateStaticParams() {
  return (await storage.list()).map((d) => ({ deckId: d.id }));
}

export default async function PresentPage({ params }: PageProps<'/pitch/present/[deckId]'>) {
  const deck = await storage.get((await params).deckId);
  if (!deck) notFound();
  return <Player deck={deck} exitHref="/pitch" />;
}
