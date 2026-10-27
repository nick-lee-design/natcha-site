import { createHmac, timingSafeEqual } from 'node:crypto';
import { PROJECTS, type Project } from './viewer-projects';

// Each project opens with its own password, set as VIEWER_PASSWORD_<ID> (VIEWER_PASSWORD_BUILDING).
// Unlocking stores a token derived from it, so changing the password locks everyone out again.
// Without a password the project stays closed in production and open locally.
const dev = process.env.NODE_ENV !== 'production';

export const cookieName = (p: Project) => `talo_viewer_${p.id}`;

const password = (p: Project) => process.env[`VIEWER_PASSWORD_${p.id.toUpperCase()}`] || '';

export const token = (p: Project) => createHmac('sha256', password(p)).update(`talo-viewer:${p.id}`).digest('hex');

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const passwordMatches = (p: Project, given: string) => !!password(p) && same(given, password(p));

export function unlocked(p: Project, cookie: string | undefined) {
  if (!password(p)) return dev;
  return !!cookie && same(cookie, token(p));
}

// The project whose model package a public path belongs to
export const projectForPath = (path: string) =>
  PROJECTS.find((p) => path.startsWith(`/experiments/${p.package.split('/')[0]}/`));
