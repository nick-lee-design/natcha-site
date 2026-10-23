import { z } from 'zod';
import { canEdit, forbidden } from '@/lib/pitch/access';
import { clientDeck } from '@/lib/pitch/duplicate';
import { storage } from '@/lib/pitch/storage';

const body = z.object({ from: z.string(), company: z.string().trim().max(120), name: z.string().trim().max(120) });

// Duplicate for client: copies a deck under a new, hard-to-guess id
export async function POST(req: Request) {
  if (!(await canEdit())) return forbidden();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Add the client’s company' }, { status: 400 });
  const source = await storage.get(parsed.data.from);
  if (!source) return Response.json({ error: 'Deck not found' }, { status: 404 });
  const deck = clientDeck(source, { company: parsed.data.company, name: parsed.data.name });
  await storage.save(deck);
  return Response.json({ id: deck.id });
}
