import { storage } from '@/lib/pitch/storage';

// Every PDF made for this deck, newest first
export async function GET(_: Request, ctx: RouteContext<'/api/pitch/pdf/[deckId]/archive'>) {
  const { deckId } = await ctx.params;
  return Response.json(await storage.listPdfs(deckId));
}
