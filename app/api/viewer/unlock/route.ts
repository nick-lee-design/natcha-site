import { cookies } from 'next/headers';
import { cookieName, passwordMatches, token } from '@/lib/viewer-access';
import { PROJECTS } from '@/lib/viewer-projects';

// Exchanges a project's password for a cookie that opens it, and its model files, for 30 days
export async function POST(req: Request) {
  const form = await req.formData();
  const p = PROJECTS.find((x) => x.id === String(form.get('project') ?? ''));
  if (!p) return Response.redirect(new URL('/viewer', req.url), 303);
  const target = new URL(`/viewer/${p.id}`, req.url);
  if (passwordMatches(p, String(form.get('password') ?? ''))) {
    (await cookies()).set(cookieName(p), token(p), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    target.searchParams.set('wrong', '1');
  }
  return Response.redirect(target, 303);
}
