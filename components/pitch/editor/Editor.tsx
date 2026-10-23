'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Deck } from '@/lib/pitch/schema';
import { parseDeck } from '@/lib/pitch/validate';
import { DownloadPdf } from '../player/DownloadPdf';
import { EditCanvas } from './EditCanvas';
import { Inspector } from './Inspector';
import { locate, makeSlide, slideOf } from './ops';
import { SlideRail } from './SlideRail';
import { createEditorStore, StoreContext, useEditor, useEditorApi, useHistory } from './store';
import { TemplatePicker } from './TemplatePicker';
import { Toasts, useToast } from './Toasts';

const DRAFT_EVERY = 3000;
const draftKey = (id: string) => `pitch-draft-${id}`;

type Draft = { deck: Deck; at: number };

function readDraft(id: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

function Workspace() {
  const api = useEditorApi();
  const deck = useEditor((s) => s.deck);
  const saved = useEditor((s) => s.saved);
  const showOrder = useEditor((s) => s.showOrder);
  const setShowOrder = useEditor((s) => s.setShowOrder);
  const change = useEditor((s) => s.change);
  const selectSlide = useEditor((s) => s.selectSlide);
  const { canUndo, canRedo, undo, redo } = useHistory();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [draft, setDraft] = useState<Draft | null>(null);
  const json = useMemo(() => JSON.stringify(deck), [deck]);
  const endPreview = useCallback(() => setPreviewing(false), []);
  const dirty = json !== saved;

  const save = useCallback(async () => {
    const current = api.getState().deck;
    setStatus('saving');
    const res = await fetch(`/api/pitch/decks/${current.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
    if (!res.ok) {
      setStatus('error');
      const body = await res.json().catch(() => ({}));
      toast(body.error ? `Not saved: ${String(body.error).split('\n')[0]}` : 'Not saved. Try again.');
      return false;
    }
    api.getState().markSaved(JSON.stringify(current));
    localStorage.removeItem(draftKey(current.id));
    setStatus('idle');
    return true;
  }, [api, toast]);

  // Offer back any unsaved draft from an earlier visit
  useEffect(() => {
    const d = readDraft(deck.id);
    if (d && JSON.stringify(d.deck) !== saved) setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drafts autosave every few seconds while there are unsaved changes
  useEffect(() => {
    const t = setInterval(() => {
      const { deck: d, saved: s } = api.getState();
      try {
        if (JSON.stringify(d) !== s) localStorage.setItem(draftKey(d.id), JSON.stringify({ deck: d, at: Date.now() }));
      } catch {}
    }, DRAFT_EVERY);
    return () => clearInterval(t);
  }, [api]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(api.getState().deck) !== api.getState().saved) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [api]);

  // Undo, redo, save, delete and deselect
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        (e.shiftKey ? redo : undo)();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        api.getState().selectBlock(null);
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && api.getState().blockId) {
        e.preventDefault();
        const { blockId, slideId } = api.getState();
        change((d) => {
          const s = slideOf(d, slideId);
          const f = locate(s, blockId!);
          if (f) s.slots[f.slot].splice(f.index, 1);
        });
        api.getState().selectBlock(null);
        toast('Block deleted', { label: 'Undo', run: undo });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, change, save, undo, redo, toast]);

  // Present and Download read the saved deck, so unsaved changes are saved first
  const savedThen = async (go: () => void) => {
    if (!dirty || (await save())) go();
  };

  return (
    <div className="pitch-editor">
      <header className="ui-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/pitch" className="ui-button is-quiet">
            Decks
          </Link>
          <div className="min-w-0">
            <div className="truncate font-semibold tracking-[-.01em]">{deck.name}</div>
            <div className="text-xs text-stone-500" aria-live="polite">
              {status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : dirty ? 'Unsaved changes' : 'Saved'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="ui-button is-quiet" disabled={!canUndo} onClick={() => undo()}>
            Undo
          </button>
          <button type="button" className="ui-button is-quiet" disabled={!canRedo} onClick={() => redo()}>
            Redo
          </button>
          <span className="ui-divider" />
          <button type="button" className="ui-button is-quiet" aria-pressed={showOrder} onClick={() => setShowOrder(!showOrder)}>
            Show build order
          </button>
          <button type="button" className="ui-button is-quiet" disabled={previewing} onClick={() => setPreviewing(true)}>
            Preview builds
          </button>
          <span className="ui-divider" />
          <button type="button" className="ui-button" disabled={!dirty || status === 'saving'} onClick={save}>
            Save
          </button>
          <button type="button" className="ui-button" onClick={() => savedThen(() => window.open(`/pitch/present/${deck.id}#slide-${deck.slides.indexOf(slideOf(deck, api.getState().slideId)) + 1}`, '_blank'))}>
            Present
          </button>
          <DownloadPdf deckId={deck.id} className="ui-button is-primary" prepare={() => (dirty ? save() : Promise.resolve(true))} />
        </div>
      </header>

      {draft ? (
        <div className="ui-banner" role="status">
          <span>Unsaved changes from {new Date(draft.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.</span>
          <button
            type="button"
            className="ui-button is-quiet"
            onClick={() => {
              try {
                api.getState().replace(parseDeck(draft.deck));
              } catch {
                toast('That draft couldn’t be restored');
              }
              setDraft(null);
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="ui-button is-quiet"
            onClick={() => {
              localStorage.removeItem(draftKey(deck.id));
              setDraft(null);
            }}
          >
            Discard
          </button>
        </div>
      ) : null}

      <div className="ui-workspace">
        <SlideRail onAdd={() => setPicking(true)} />
        <EditCanvas previewing={previewing} onPreviewEnd={endPreview} />
        <Inspector />
      </div>

      <TemplatePicker
        open={picking}
        deck={deck}
        onClose={() => setPicking(false)}
        onPick={(template, variant) => {
          const slide = makeSlide(template, variant);
          const at = deck.slides.indexOf(slideOf(deck, api.getState().slideId)) + 1;
          change((d) => void d.slides.splice(at, 0, slide));
          selectSlide(slide.id);
          setPicking(false);
        }}
      />
    </div>
  );
}

export function Editor({ initial }: { initial: Deck }) {
  const [store] = useState(() => createEditorStore(initial));
  return (
    <StoreContext value={store}>
      <Toasts>
        <Workspace />
      </Toasts>
    </StoreContext>
  );
}
