import { accessHeaders, deckPdf } from '@/lib/pitch/pdf';
import { storage } from '@/lib/pitch/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

// The deck as a PDF, made on request and sent straight to the browser as a download
export async function GET(req: Request, ctx: RouteContext<'/api/pitch/pdf/[deckId]'>) {
  const { deckId } = await ctx.params;
  const deck = await storage.get(deckId);
  if (!deck) return Response.json({ error: 'Deck not found' }, { status: 404 });

  try {
    const pdf = await deckPdf(deck, new URL(req.url).origin, accessHeaders(req));
    return new Response(Buffer.from(pdf.data), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdf.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[pitch] PDF failed', e);
    return Response.json({ error: 'The PDF couldn’t be made. Please try again.' }, { status: 500 });
  }
}
