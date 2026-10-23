import { cookies } from 'next/headers';
import { EDIT_COOKIE } from '@/lib/pitch/access';

// Production editing: exchanges PITCH_EDIT_KEY for a cookie
export async function POST(req: Request) {
  const form = await req.formData();
  const key = String(form.get('key') ?? '');
  const back = String(form.get('back') ?? '/pitch');
  const target = new URL(back.startsWith('/pitch') ? back : '/pitch', req.url);
  if (process.env.PITCH_EDIT_KEY && key === process.env.PITCH_EDIT_KEY) {
    (await cookies()).set(EDIT_COOKIE, key, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  } else {
    target.searchParams.set('wrong', '1');
  }
  return Response.redirect(target, 303);
}
