import { randomBytes } from 'node:crypto';
import { canEdit, forbidden } from '@/lib/pitch/access';
import { storage } from '@/lib/pitch/storage';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif' };
const MAX = 15 * 1024 * 1024;

// Image upload into the deck's folder
export async function POST(req: Request, ctx: RouteContext<'/api/pitch/decks/[deckId]/assets'>) {
  if (!(await canEdit())) return forbidden();
  const { deckId } = await ctx.params;
  if (!(await storage.get(deckId))) return Response.json({ error: 'Deck not found' }, { status: 404 });

  const file = (await req.formData()).get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: 'Use a JPG, PNG, WebP, GIF or SVG image' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'Images can be up to 15 MB' }, { status: 400 });

  const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
  const name = `${base}-${randomBytes(3).toString('hex')}.${ext}`;
  const url = await storage.saveAsset(deckId, name, new Uint8Array(await file.arrayBuffer()), file.type);
  return Response.json({ url });
}
