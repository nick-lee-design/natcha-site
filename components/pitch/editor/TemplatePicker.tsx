'use client';

import { useMemo } from 'react';
import type { Deck } from '@/lib/pitch/schema';
import { templates } from '../templates';
import { Dialog } from '../ui/Dialog';
import { makeSlide } from './ops';
import { Thumb } from './Thumb';

// Every template and variant, previewed live with its starter content
export function TemplatePicker({ open, deck, onClose, onPick }: { open: boolean; deck: Deck; onClose: () => void; onPick: (template: string, variant: string) => void }) {
  const previews = useMemo(
    () => Object.values(templates).flatMap((t) => t.variants.map((v) => ({ t, v, slide: makeSlide(t.id, v.id) }))),
    [],
  );
  return (
    <Dialog open={open} onClose={onClose} title="Add a slide" wide>
      <div className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-auto pr-1 sm:grid-cols-3">
        {previews.map(({ t, v, slide }) => (
          <div
            key={`${t.id}-${v.id}`}
            role="button"
            tabIndex={0}
            className="ui-template cursor-pointer"
            onClick={() => onPick(t.id, v.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(t.id, v.id))}
          >
            <Thumb deck={deck} slide={slide} index={0} total={1} />
            <span className="mt-2 block text-left text-sm font-medium">{t.name}</span>
            {t.variants.length > 1 ? <span className="block text-left text-xs text-stone-500">{v.label}</span> : null}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
