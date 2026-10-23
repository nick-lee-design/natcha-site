import { cookies } from 'next/headers';
import { storage } from './storage';

export const EDIT_COOKIE = 'pitch_edit';

const dev = process.env.NODE_ENV !== 'production';

// Locally the editor always works. In production it needs hosted storage (files there
// are read-only) and PITCH_EDIT_KEY, since v1 has no accounts.
export function editingAvailable() {
  return dev || (storage.hosted && !!process.env.PITCH_EDIT_KEY);
}

export async function canEdit() {
  if (dev) return true;
  if (!editingAvailable()) return false;
  return (await cookies()).get(EDIT_COOKIE)?.value === process.env.PITCH_EDIT_KEY;
}

export const forbidden = () => Response.json({ error: 'Editing isn’t available here.' }, { status: 403 });
