'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DeckSummary } from '@/lib/pitch/storage/types';
import { Dialog } from '../ui/Dialog';

const noop = () => () => {};
const action = 'rounded-lg px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-stone-900';

export function DeckList({ decks, editable }: { decks: DeckSummary[]; editable: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<DeckSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const origin = useSyncExternalStore(noop, () => location.origin, () => '');

  const copy = async (id: string) => {
    await navigator.clipboard.writeText(`${location.origin}/pitch/d/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  };

  const duplicate = async (form: FormData) => {
    if (!duplicating) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/pitch/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: duplicating.id, company: form.get('company'), name: form.get('name') }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? 'That didn’t work. Try again.');
    router.push(`/pitch/edit/${body.id}`);
  };

  return (
    <>
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm">
        {decks.map((d) => (
          <li key={d.id} className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.name}</div>
                <div className="font-mono text-xs text-stone-500">
                  {d.client || 'No client'} · {d.slides} slides
                </div>
              </div>
              {editable ? (
                <Link className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm font-medium hover:bg-stone-100" href={`/pitch/edit/${d.id}`}>
                  Edit
                </Link>
              ) : null}
              <Link className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700" href={`/pitch/present/${d.id}`}>
                Present
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="min-w-0 flex-1 truncate rounded-lg bg-stone-100 px-3 py-1.5 text-left font-mono text-xs text-stone-600 hover:bg-stone-200 hover:text-stone-900"
                title="Copy share link"
                onClick={() => copy(d.id)}
              >
                {copied === d.id ? 'Copied' : `${origin}/pitch/d/${d.id}`}
              </button>
              <Link className={action} href={`/pitch/archive/${d.id}`}>
                PDFs
              </Link>
              <DeckMenu
                items={[
                  ...(editable ? [{ label: 'Duplicate for client', run: () => setDuplicating(d) }] : []),
                  { label: 'Presenter view', href: `/pitch/presenter/${d.id}` },
                ]}
              />
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!duplicating} onClose={() => setDuplicating(null)} title="Duplicate for client">
        <form action={duplicate} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Client company</span>
            <input name="company" required autoFocus className="ui-input" placeholder="Acme Hotels" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Client name</span>
            <input name="name" className="ui-input" />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="ui-button" onClick={() => setDuplicating(null)}>
              Cancel
            </button>
            <button type="submit" className="ui-button is-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create and edit'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

type MenuItem = { label: string; href?: string; run?: () => void };

// The less used actions, behind •••
function DeckMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" className={action} aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        •••
      </button>
      {open ? (
        <div className="ui-menu absolute top-full right-0 z-20 mt-1 w-48" role="menu">
          {items.map((item) =>
            item.href ? (
              <Link key={item.label} role="menuitem" href={item.href}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.run?.();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
