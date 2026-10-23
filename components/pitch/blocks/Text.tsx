'use client';

import type { CSSProperties } from 'react';
import type { Block, BlockMotion, BlockOf } from '@/lib/pitch/schema';
import { resolveText } from '@/lib/pitch/variables';
import { Build } from '../canvas/Build';
import { useEdit } from '../canvas/EditContext';
import { useBlocks, useMode } from '../canvas/ModeProvider';
import { AddBlock } from './AddBlock';
import { PlainEditable, RichEditable } from './Editable';
import { RichText } from './RichText';

type TextBlockType = Extract<Block, { content: string }>;

const ROLE: Partial<Record<Block['type'], string>> = {
  title: 'd-title',
  subtitle: 'd-subtitle',
  paragraph: 'd-body',
  caption: 'd-caption',
  label: 'd-label',
};

export function TextBlock({
  block,
  className,
  style,
  fallback,
}: {
  block: TextBlockType;
  className?: string;
  style?: CSSProperties;
  fallback?: BlockMotion;
}) {
  const { deck, mode } = useMode();
  const edit = useEdit();
  const text = resolveText(block.content, deck);
  if (mode === 'edit' && edit) {
    const commit = (value: string) =>
      edit.updateBlock(block.id, (b) => {
        if ('content' in b) b.content = value;
      });
    return (
      <Build unit={block.id} motion={block.motion} fallback={fallback} className={className ?? ROLE[block.type]} style={style}>
        {block.type === 'paragraph' ? (
          <RichEditable id={block.id} content={block.content} onCommit={commit} />
        ) : (
          <PlainEditable content={block.content} resolved={text} onCommit={commit} />
        )}
        {block.type === 'label' && block.note ? <small>{block.note}</small> : null}
      </Build>
    );
  }
  if (text === null) return null;
  return (
    <Build
      unit={block.id}
      motion={block.motion}
      fallback={fallback}
      className={className ?? ROLE[block.type]}
      style={style}
    >
      {block.type === 'paragraph' ? <RichText html={text} /> : text}
      {block.type === 'label' && block.note ? <small>{block.note}</small> : null}
    </Build>
  );
}

// Every text block in a slot, in order. `roles` restyles a block type for this template.
export function TextBlocks({
  slot,
  roles,
  fallback,
}: {
  slot: string;
  roles?: Partial<Record<Block['type'], string>>;
  fallback?: BlockMotion;
}) {
  const blocks = useBlocks(slot);
  return (
    <>
      {blocks.map((b) =>
        'content' in b ? (
          <TextBlock key={b.id} block={b} className={roles?.[b.type] ?? ROLE[b.type]} fallback={fallback} />
        ) : b.type === 'list' ? (
          <ListBlock key={b.id} block={b} fallback={fallback} />
        ) : null,
      )}
      <AddBlock slot={slot} />
    </>
  );
}

// Each item builds on its own
export function ListBlock({ block, fallback }: { block: BlockOf<'list'>; fallback?: BlockMotion }) {
  const { deck, mode } = useMode();
  const edit = useEdit();
  return (
    <ul className="d-list">
      {block.items.map((item) => (
        <Build key={item.id} as="li" unit={`${block.id}/${item.id}`} motion={block.motion} fallback={fallback}>
          {mode === 'edit' && edit ? (
            <PlainEditable
              content={item.content}
              resolved={resolveText(item.content, deck)}
              onCommit={(value) =>
                edit.updateBlock(block.id, (b) => {
                  if (b.type === 'list') b.items = b.items.map((i) => (i.id === item.id ? { ...i, content: value } : i));
                })
              }
            />
          ) : (
            resolveText(item.content, deck)
          )}
        </Build>
      ))}
    </ul>
  );
}
