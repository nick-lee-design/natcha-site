import { enquirySchema } from '@/lib/pitch/enquiry';
import { sendEnquiry } from '@/lib/pitch/mail';

const WINDOW = 10 * 60 * 1000;
const LIMIT = 5;
const recent = new Map<string, number[]>();

// Basic per-address rate limiting (per server instance)
function limited(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > LIMIT;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return Response.json({ error: 'Too many enquiries. Please try again later.' }, { status: 429 });

  const parsed = enquirySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Please check the form.', issues: parsed.error.issues }, { status: 400 });
  // Bots fill the honeypot; they get a quiet success and nothing is sent
  if (parsed.data.website) return Response.json({ ok: true });

  try {
    await sendEnquiry(parsed.data);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[pitch] enquiry failed', e);
    return Response.json({ error: 'Sorry, that didn’t send. Please email natcha@taloengine.com.' }, { status: 502 });
  }
}
