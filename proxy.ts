import type { NextRequest } from 'next/server';
import { cookieName, projectForPath, unlocked } from '@/lib/viewer-access';

// The model packages sit in public/, so the files themselves are kept behind each project's password
export function proxy(req: NextRequest) {
  const p = projectForPath(req.nextUrl.pathname);
  if (p && !unlocked(p, req.cookies.get(cookieName(p))?.value)) {
    return new Response('Unlock this project in the TALO Viewer first.', { status: 401 });
  }
}

export const config = {
  matcher: ['/experiments/ncw-corridor/:path*', '/experiments/ncw-building/:path*'],
};
