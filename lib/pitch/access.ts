import { cookies } from 'next/headers';
import { storage } from './storage';

export const EDIT_COOKIE = 'pitch_edit';

const dev = process.env.NODE_ENV !== 'production';

// Locally the editor always works. In production it needs hosted storage, since files
// there are read-only. Setting PITCH_EDIT_KEY puts editing behind that password;
// without it, editing is open to anyone with the URL (v1 has no accounts).
export function editingAvailable() {
  return dev || storage.hosted;
}

export async function canEdit() {
  if (dev) return true;
  if (!editingAvailable()) return false;
  if (!process.env.PITCH_EDIT_KEY) return true;
  return (await cookies()).get(EDIT_COOKIE)?.value === process.env.PITCH_EDIT_KEY;
}

export const forbidden = () => Response.json({ error: 'Editing isn’t available here.' }, { status: 403 });
