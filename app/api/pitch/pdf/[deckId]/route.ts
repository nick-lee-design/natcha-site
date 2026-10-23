import { deckPdf, pdfFilename } from '@/lib/pitch/pdf';
import { storage } from '@/lib/pitch/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const pdfResponse = (data: Uint8Array, filename: string, cache: string) =>
  new Response(Buffer.from(data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Pitch-Pdf': cache,
    },
  });

// The current PDF (made on first request, then reused), or ?version=<key> from the archive
export async function GET(req: Request, ctx: RouteContext<'/api/pitch/pdf/[deckId]'>) {
  const { deckId } = await ctx.params;
  const deck = await storage.get(deckId);
  if (!deck) return Response.json({ error: 'Deck not found' }, { status: 404 });

  const url = new URL(req.url);
  const version = url.searchParams.get('version');
  if (version) {
    const data = await storage.getPdf(deck.id, version);
    const meta = (await storage.listPdfs(deck.id)).find((m) => m.key === version);
    return data ? pdfResponse(data, meta?.filename ?? pdfFilename(deck), 'archive') : Response.json({ error: 'Version not found' }, { status: 404 });
  }

  try {
    const pdf = await deckPdf(deck, url.origin);
    return pdfResponse(pdf.data, pdf.filename, pdf.cached ? 'hit' : 'miss');
  } catch (e) {
    console.error('[pitch] PDF failed', e);
    return Response.json({ error: 'The PDF couldn’t be made. Please try again.' }, { status: 500 });
  }
}
