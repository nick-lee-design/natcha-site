import { notFound } from 'next/navigation';
import { PrintDeck } from '@/components/pitch/print/PrintDeck';
import { storage } from '@/lib/pitch/storage';

export async function generateStaticParams() {
  return (await storage.list()).map((d) => ({ deckId: d.id }));
}

export default async function PrintPage({ params }: PageProps<'/pitch/print/[deckId]'>) {
  const deck = await storage.get((await params).deckId);
  if (!deck) notFound();
  return <PrintDeck deck={deck} />;
}
