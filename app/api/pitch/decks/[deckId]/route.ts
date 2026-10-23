import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { canEdit, forbidden } from '@/lib/pitch/access';
import { storage } from '@/lib/pitch/storage';
import { parseDeck } from '@/lib/pitch/validate';

export async function GET(_: Request, ctx: RouteContext<'/api/pitch/decks/[deckId]'>) {
  const deck = await storage.get((await ctx.params).deckId);
  return deck ? Response.json(deck) : Response.json({ error: 'Deck not found' }, { status: 404 });
}

// Save. Validated against the schema and every template before it's written.
export async function PUT(req: Request, ctx: RouteContext<'/api/pitch/decks/[deckId]'>) {
  if (!(await canEdit())) return forbidden();
  const { deckId } = await ctx.params;
  try {
    const deck = parseDeck(await req.json());
    if (deck.id !== deckId) return Response.json({ error: 'Deck id doesn’t match' }, { status: 400 });
    await storage.save(deck);
    for (const route of ['present', 'd', 'print', 'enquire', 'presenter']) revalidatePath(`/pitch/${route}/${deckId}`);
    revalidatePath('/pitch');
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof ZodError ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n') : (e as Error).message;
    return Response.json({ error: message }, { status: 400 });
  }
}
