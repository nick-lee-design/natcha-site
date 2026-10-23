import { storage } from '@/lib/pitch/storage';

// Uploaded images from the private Blob store. Names are unique, so they cache for good.
export async function GET(_req: Request, ctx: RouteContext<'/api/pitch/decks/[deckId]/assets/[name]'>) {
  const { deckId, name } = await ctx.params;
  const asset = await storage.getAsset?.(deckId, name);
  if (!asset) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(asset.data), {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // SVG uploads can carry script; this keeps them inert if opened directly
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
