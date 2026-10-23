'use client';

import { useState } from 'react';
import type { BlockType } from '@/lib/pitch/schema';
import { useEdit } from '../canvas/EditContext';
import { useMode, useSlide } from '../canvas/ModeProvider';
import { templateDefs } from '../templates/defs';

export const BLOCK_LABELS: Record<BlockType, string> = {
  title: 'title',
  subtitle: 'subtitle',
  paragraph: 'paragraph',
  caption: 'caption',
  label: 'label',
  image: 'image',
  'image-grid': 'image grid',
  list: 'list',
  table: 'pricing table',
  'key-list': 'equipment key',
  'hub-diagram': 'hub diagram',
  'contact-details': 'contact details',
  'enquiry-form': 'enquiry form',
  'qr-link': 'QR link',
};

const INLINE: BlockType[] = ['title', 'subtitle', 'paragraph', 'caption', 'label', 'list'];

// A small Add button after a text slot's last block. Zero height, so the finished layout doesn't move.
export function AddBlock({ slot }: { slot: string }) {
  const { mode } = useMode();
  const { slide } = useSlide();
  const edit = useEdit();
  const [open, setOpen] = useState(false);
  if (mode !== 'edit' || !edit) return null;
  const def = templateDefs[slide.template]?.slots.find((s) => s.name === slot);
  const blocks = slide.slots[slot] ?? [];
  // Shown for the slot being worked on, so it never sits over other content
  if (!blocks.some((b) => b.id === edit.selectedBlock)) return null;
  if (!def || (def.max && blocks.length >= def.max)) return null;
  const types = def.accepts.filter((t) => INLINE.includes(t));
  if (!types.length) return null;

  return (
    <div className="slot-add" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="slot-add-button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        + Add
      </button>
      {open ? (
        <div className="slot-add-menu" role="menu">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitem"
              onClick={() => {
                edit.addBlock(slot, t);
                setOpen(false);
              }}
            >
              Add a {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
