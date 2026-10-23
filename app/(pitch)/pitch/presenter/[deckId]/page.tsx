import { notFound } from 'next/navigation';
import { Presenter } from '@/components/pitch/player/Presenter';
import { storage } from '@/lib/pitch/storage';

export async function generateStaticParams() {
  return (await storage.list()).map((d) => ({ deckId: d.id }));
}

export default async function PresenterPage({ params }: PageProps<'/pitch/presenter/[deckId]'>) {
  const deck = await storage.get((await params).deckId);
  if (!deck) notFound();
  return <Presenter deck={deck} />;
}
