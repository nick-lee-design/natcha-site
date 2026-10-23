'use client';

import type { BlockOf } from '@/lib/pitch/schema';
import { resolveText } from '@/lib/pitch/variables';
import { Build } from '../canvas/Build';
import { useEdit } from '../canvas/EditContext';
import { useMode } from '../canvas/ModeProvider';
import { PlainEditable } from './Editable';

const rise = { style: 'gentle' } as const;
const ROLE = { text: '', key: 'is-key', name: 'is-name', fee: 'is-fee' } as const;

// A table the deck holds itself. In the editor every heading and cell is typed into on the slide.
export function PricingTable({ block, width }: { block: BlockOf<'table'>; width: number }) {
  const { deck, mode } = useMode();
  const edit = useEdit();
  const editing = mode === 'edit' && !!edit;
  const cols = block.columns.map((c) => `${c.width}fr`).join(' ');

  const cell = (content: string, commit: (value: string) => void) =>
    editing ? <PlainEditable content={content} resolved={resolveText(content, deck) ?? ''} onCommit={commit} /> : (resolveText(content, deck) ?? '');

  return (
    <div className="d-table" style={{ width }}>
      <Build unit={`${block.id}/head`} motion={block.motion} fallback={rise} className="d-table-head" style={{ gridTemplateColumns: cols }}>
        {block.columns.map((c, j) => (
          <div key={c.id}>
            {cell(c.label, (v) => edit?.updateBlock(block.id, (b) => void (b.type === 'table' && (b.columns[j].label = v))))}
          </div>
        ))}
      </Build>
      {block.rows.map((r, i) => (
        <Build
          key={r.id}
          unit={`${block.id}/${r.id}`}
          motion={block.motion}
          fallback={rise}
          className={`d-table-row${i % 2 === 0 ? ' is-shaded' : ''}`}
          style={{ gridTemplateColumns: cols }}
        >
          {block.columns.map((c, j) => (
            <div key={c.id} className={ROLE[c.role]}>
              {cell(r.cells[j] ?? '', (v) =>
                edit?.updateBlock(block.id, (b) => {
                  if (b.type !== 'table') return;
                  const row = b.rows[i];
                  while (row.cells.length < b.columns.length) row.cells.push('');
                  row.cells[j] = v;
                }),
              )}
            </div>
          ))}
        </Build>
      ))}
    </div>
  );
}
