'use client';

import type { ReactNode } from 'react';
import type { Block, BlockMotion, BlockOf, BlockType, Deck, Icon, Slide } from '@/lib/pitch/schema';
import { BLOCK_LABELS } from '../blocks/AddBlock';
import { templates } from '../templates';
import { editors } from './EditCanvas';
import { Field, Section, Select, TextInput, Toggle } from './fields';
import { ImageField } from './ImageField';
import { defaultBlock, locate, newId, slideOf } from './ops';
import { parseDeck } from '@/lib/pitch/validate';
import { useEditor, useEditorApi, useHistory } from './store';
import { useToast } from './Toasts';

const STYLES = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'pop', label: 'Pop' },
  { value: 'slide', label: 'Slide' },
  { value: 'draw', label: 'Draw' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'none', label: 'None' },
] as const;
const SPEEDS = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'normal', label: 'Normal' },
  { value: 'brisk', label: 'Brisk' },
] as const;
const STAGGERS = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'loose', label: 'Loose' },
] as const;
const TRANSITIONS = [
  { value: 'fade', label: 'Fade' },
  { value: 'push', label: 'Push' },
  { value: 'none', label: 'None' },
] as const;
const DIRECTIONS = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
] as const;
const ICONS: { value: Icon; label: string }[] = [
  { value: 'document', label: 'Document' },
  { value: 'layers', label: 'Layers' },
  { value: 'forward', label: 'Forward' },
  { value: 'clock', label: 'Clock' },
  { value: 'cube', label: 'Cube' },
];

// "Default" options inherit from the level above
const inherit = <T extends string>(opts: readonly { value: T; label: string }[], label = 'Deck default') => [{ value: '' as T, label }, ...opts];

function useChange() {
  return useEditor((s) => s.change);
}

function DeckPanel({ deck }: { deck: Deck }) {
  const change = useChange();
  const set = (recipe: (d: Deck) => void) => change(recipe);
  return (
    <>
      <Section title="Deck">
        <Field label="Name">
          <TextInput value={deck.name} onCommit={(v) => set((d) => void (d.name = v))} />
        </Field>
        <Field label="Client company" hint="Used on the cover, the form and the PDF name">
          <TextInput value={deck.client.company} onCommit={(v) => set((d) => void (d.client.company = v))} />
        </Field>
        <Field label="Client name">
          <TextInput value={deck.client.name} onCommit={(v) => set((d) => void (d.client.name = v))} />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={deck.date} onCommit={(v) => v && set((d) => void (d.date = v))} />
        </Field>
        <Field label="Reference">
          <TextInput value={deck.reference} onCommit={(v) => set((d) => void (d.reference = v))} />
        </Field>
        <Field label="Theme">
          <Select value={deck.theme} options={[{ value: 'talo', label: 'TALO Engine' }]} onChange={(v) => set((d) => void (d.theme = v))} />
        </Field>
      </Section>
      <Section title="Motion">
        <Field label="Style">
          <Select value={deck.motion.style} options={[...STYLES]} onChange={(v) => set((d) => void (d.motion.style = v))} />
        </Field>
        <Field label="Speed">
          <Select value={deck.motion.speed} options={[...SPEEDS]} onChange={(v) => set((d) => void (d.motion.speed = v))} />
        </Field>
        <Field label="Stagger">
          <Select value={deck.motion.stagger} options={[...STAGGERS]} onChange={(v) => set((d) => void (d.motion.stagger = v))} />
        </Field>
        <Field label="Transition">
          <Select value={deck.motion.transition} options={[...TRANSITIONS]} onChange={(v) => set((d) => void (d.motion.transition = v))} />
        </Field>
        <Toggle label="Builds in share view" checked={deck.motion.buildsInShare} onChange={(v) => set((d) => void (d.motion.buildsInShare = v))} />
      </Section>
      <DeckFile deck={deck} />
    </>
  );
}

// Moves a deck between machines as JSON
function DeckFile({ deck }: { deck: Deck }) {
  const api = useEditorApi();
  const { undo } = useHistory();
  const toast = useToast();
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: `${deck.id}.json` }).click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (file: File) => {
    try {
      const next = parseDeck(JSON.parse(await file.text()));
      api.getState().replace({ ...next, id: deck.id });
      toast('Deck imported', { label: 'Undo', run: undo });
    } catch (e) {
      toast(`That file isn’t a deck: ${(e as Error).message.split('\n')[0]}`);
    }
  };
  return (
    <Section title="Deck file">
      <div className="flex gap-2">
        <label className="ui-button flex-1 cursor-pointer text-center">
          Import JSON
          <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </label>
        <button type="button" className="ui-button flex-1" onClick={exportJson}>
          Export JSON
        </button>
      </div>
    </Section>
  );
}

function SlidePanel({ slide }: { slide: Slide }) {
  const change = useChange();
  const selectBlock = useEditor((s) => s.selectBlock);
  const template = templates[slide.template];
  const set = (recipe: (s: Slide) => void) => change((d) => recipe(slideOf(d, slide.id)));
  const motion = (key: 'style' | 'speed' | 'stagger', v: string) =>
    set((s) => {
      s.motion = { ...s.motion, [key]: v || undefined };
    });
  const hasText = template?.slots.some((s) => s.text);

  return (
    <>
      <Section title={template?.name ?? slide.template}>
        {template && template.variants.length > 1 ? (
          <Field label="Layout">
            <Select value={slide.variant ?? template.variants[0].id} options={template.variants.map((v) => ({ value: v.id, label: v.label }))} onChange={(v) => set((s) => void (s.variant = v))} />
          </Field>
        ) : null}
        {hasText ? <Toggle label="Hide text" checked={slide.hideText} onChange={(v) => set((s) => void (s.hideText = v))} /> : null}
        <Toggle label="Hide slide" checked={slide.hidden} onChange={(v) => set((s) => void (s.hidden = v))} />
      </Section>
      <Section title="Builds">
        <Field label="Build mode">
          <Select
            value={slide.buildMode}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' },
              { value: 'none', label: 'All at once' },
            ]}
            onChange={(v) => set((s) => void (s.buildMode = v))}
          />
        </Field>
        <Field label="Style">
          <Select value={slide.motion?.style ?? ''} options={inherit(STYLES)} onChange={(v) => motion('style', v)} />
        </Field>
        <Field label="Speed">
          <Select value={slide.motion?.speed ?? ''} options={inherit(SPEEDS)} onChange={(v) => motion('speed', v)} />
        </Field>
        <Field label="Stagger">
          <Select value={slide.motion?.stagger ?? ''} options={inherit(STAGGERS)} onChange={(v) => motion('stagger', v)} />
        </Field>
        <Field label="Transition">
          <Select value={slide.transition ?? ''} options={inherit(TRANSITIONS)} onChange={(v) => set((s) => void (s.transition = v || undefined))} />
        </Field>
      </Section>
      <Section title="Content">
        {template?.slots.map((def) => {
          const blocks = slide.slots[def.name] ?? [];
          const full = !!def.max && blocks.length >= def.max;
          return (
            <div key={def.name} className="ui-slot">
              <div className="ui-slot-name">{def.label}</div>
              {blocks.length ? (
                blocks.map((b) => (
                  <button key={b.id} type="button" className="ui-slot-block" onClick={() => selectBlock(b.id)}>
                    <span>{BLOCK_LABELS[b.type]}</span>
                    <span className="truncate text-stone-500">{'content' in b ? b.content.replace(/<[^>]+>/g, '') : ''}</span>
                  </button>
                ))
              ) : (
                <div className="text-xs text-stone-400">Empty</div>
              )}
              {full ? null : (
                <select
                  className="ui-slot-add"
                  value=""
                  aria-label={`Add to ${def.label}`}
                  onChange={(e) => {
                    const block = defaultBlock(e.target.value as BlockType);
                    set((s) => void (s.slots[def.name] ??= []).push(block));
                    selectBlock(block.id);
                  }}
                >
                  <option value="">+ Add</option>
                  {def.accepts.map((t) => (
                    <option key={t} value={t}>
                      Add a {BLOCK_LABELS[t]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </Section>
      <Section title="Speaker notes">
        <TextInput multiline value={slide.notes} placeholder="Shown in the presenter view" onCommit={(v) => set((s) => void (s.notes = v))} />
      </Section>
    </>
  );
}

function ItemList<T extends { id: string }>({
  items,
  min = 0,
  max = 99,
  render,
  onChange,
  make,
  addLabel,
  reorder = false,
}: {
  items: T[];
  min?: number;
  max?: number;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  onChange: (items: T[]) => void;
  make: () => T;
  addLabel: string;
  reorder?: boolean;
}) {
  const swap = (i: number, j: number) => {
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.id} className="ui-item">
          <div className="min-w-0 flex-1 space-y-1.5">{render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
          {reorder ? (
            <>
              <button type="button" className="ui-icon-button" aria-label="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                ↑
              </button>
              <button type="button" className="ui-icon-button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => swap(i, i + 1)}>
                ↓
              </button>
            </>
          ) : null}
          <button type="button" className="ui-icon-button" aria-label="Remove" disabled={items.length <= min} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      {items.length < max ? (
        <button type="button" className="ui-button w-full" onClick={() => onChange([...items, make()])}>
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

const COLUMN_STYLES = [
  { value: 'text', label: 'Plain' },
  { value: 'key', label: 'Accent' },
  { value: 'name', label: 'Bold' },
  { value: 'fee', label: 'Price' },
] as const;

// Cells are typed into on the slide. Here: rows and columns, their order, widths and styles.
function TableSettings({ block, update }: { block: BlockOf<'table'>; update: (recipe: (b: BlockOf<'table'>) => void) => void }) {
  const setColumns = (columns: BlockOf<'table'>['columns']) =>
    update((b) => {
      const at = new Map(b.columns.map((c, i) => [c.id, i]));
      b.rows = b.rows.map((r) => ({ ...r, cells: columns.map((c) => (at.has(c.id) ? r.cells[at.get(c.id)!] ?? '' : '')) }));
      b.columns = columns;
    });
  return (
    <>
      <Field label="Rows" hint="Click a cell on the slide to edit it">
        <ItemList
          items={block.rows}
          reorder
          addLabel="Add a row"
          onChange={(rows) => update((b) => void (b.rows = rows))}
          make={() => ({ id: newId('r'), cells: block.columns.map(() => '') })}
          render={(row, patch) => (
            <TextInput
              value={row.cells[block.columns.findIndex((c) => c.role !== 'text')] ?? row.cells[0] ?? ''}
              placeholder="Empty row"
              onCommit={(v) => {
                const j = Math.max(0, block.columns.findIndex((c) => c.role !== 'text'));
                patch({ cells: block.columns.map((_, k) => (k === j ? v : row.cells[k] ?? '')) });
              }}
            />
          )}
        />
      </Field>
      <Field label="Columns" hint="Style, and width as a share of the table">
        <ItemList
          items={block.columns}
          min={1}
          max={6}
          reorder
          addLabel="Add a column"
          onChange={setColumns}
          make={() => ({ id: newId('c'), label: 'Column', width: 20, role: 'text' as const })}
          render={(col, patch) => (
            <>
              <TextInput value={col.label} placeholder="Heading" onCommit={(v) => patch({ label: v })} />
              <div className="flex gap-2">
                <Select<typeof col.role> value={col.role} options={[...COLUMN_STYLES]} onChange={(v) => patch({ role: v })} />
                <TextInput
                  type="number"
                  value={String(col.width)}
                  onCommit={(v) => {
                    const n = Number(v);
                    if (n > 0) patch({ width: n });
                  }}
                />
              </div>
            </>
          )}
        />
      </Field>
      <Toggle label="Offer rows in the enquiry form" checked={block.services} onChange={(v) => update((b) => void (b.services = v))} />
    </>
  );
}

function TypeSettings({ block, deckId, update }: { block: Block; deckId: string; update: (recipe: (b: Block) => void) => void }) {
  const as = <T extends BlockType>(recipe: (b: BlockOf<T>) => void) => update((b) => recipe(b as BlockOf<T>));
  switch (block.type) {
    case 'paragraph': {
      const run = (cmd: 'toggleBold' | 'toggleItalic') => editors.get(block.id)?.chain().focus()[cmd]().run();
      return (
        <Field label="Text style" hint="Select text on the slide first">
          <div className="flex gap-2">
            <button type="button" className="ui-button font-bold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('toggleBold')}>
              Bold
            </button>
            <button type="button" className="ui-button italic" onMouseDown={(e) => e.preventDefault()} onClick={() => run('toggleItalic')}>
              Italic
            </button>
            <button
              type="button"
              className="ui-button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const editor = editors.get(block.id);
                if (!editor) return;
                const href = prompt('Link address', editor.getAttributes('link').href ?? 'https://');
                if (href === null) return;
                const chain = editor.chain().focus().extendMarkRange('link');
                (href ? chain.setLink({ href }) : chain.unsetLink()).run();
              }}
            >
              Link
            </button>
          </div>
        </Field>
      );
    }
    case 'label':
      return (
        <Field label="Note">
          <TextInput value={block.note ?? ''} placeholder="Scale: NTS" onCommit={(v) => as<'label'>((b) => void (b.note = v || undefined))} />
        </Field>
      );
    case 'image':
      return (
        <>
          <ImageField deckId={deckId} src={block.src} onPick={(p) => as<'image'>((b) => Object.assign(b, p))} />
          <Field label="Description" hint="Read by screen readers">
            <TextInput value={block.alt} onCommit={(v) => as<'image'>((b) => void (b.alt = v))} />
          </Field>
        </>
      );
    case 'image-grid':
      return (
        <ItemList
          items={block.items}
          max={25}
          addLabel="Add an image"
          onChange={(items) => as<'image-grid'>((b) => void (b.items = items))}
          make={() => ({ id: newId('a'), src: '/decks/talo-base/assets/asset-1.jpg', alt: '' })}
          render={(item, patch) => <ImageField deckId={deckId} src={item.src} onPick={(p) => patch({ src: p.src })} />}
        />
      );
    case 'list':
      return (
        <ItemList
          items={block.items}
          min={1}
          addLabel="Add a point"
          onChange={(items) => as<'list'>((b) => void (b.items = items))}
          make={() => ({ id: newId('i'), content: 'New point' })}
          render={(item, patch) => <TextInput value={item.content} onCommit={(v) => patch({ content: v })} />}
        />
      );
    case 'table':
      return <TableSettings block={block} update={(recipe) => as<'table'>(recipe)} />;
    case 'key-list':
      return (
        <>
          <Field label="Heading">
            <TextInput value={block.heading} onCommit={(v) => as<'key-list'>((b) => void (b.heading = v))} />
          </Field>
          <Field label="Items" hint="Drag markers on the drawings to place them">
            <ItemList
              items={block.items}
              addLabel="Add an item"
              onChange={(items) => as<'key-list'>((b) => void (b.items = items.map((x, i) => ({ ...x, number: i + 1 }))))}
              make={() => ({ id: newId('k'), number: block.items.length + 1, content: 'New item' })}
              render={(item, patch) => (
                <>
                  <TextInput value={item.content} onCommit={(v) => patch({ content: v })} />
                  <div className="flex gap-2">
                    {['plan', 'section'].map((view) => {
                      const has = block.markers.some((m) => m.view === view && m.items.includes(item.id));
                      return (
                        <button
                          key={view}
                          type="button"
                          className="ui-chip"
                          aria-pressed={has}
                          onClick={() =>
                            as<'key-list'>((b) => {
                              b.markers = has
                                ? b.markers.filter((m) => !(m.view === view && m.items.includes(item.id)))
                                : [...b.markers, { id: newId('m'), view, x: 50, y: 50, label: String(item.number), items: [item.id] }];
                            })
                          }
                        >
                          {has ? `On ${view}` : `Mark on ${view}`}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            />
          </Field>
        </>
      );
    case 'hub-diagram':
      return (
        <>
          <Field label="Centre">
            <TextInput value={block.centre} onCommit={(v) => as<'hub-diagram'>((b) => void (b.centre = v))} />
          </Field>
          <Field label="Benefits">
            <ItemList
              items={block.benefits}
              min={3}
              max={6}
              addLabel="Add a benefit"
              onChange={(items) => as<'hub-diagram'>((b) => void (b.benefits = items))}
              make={() => ({ id: newId('b'), content: 'New benefit', icon: 'cube' as Icon })}
              render={(item, patch) => (
                <>
                  <TextInput value={item.content} onCommit={(v) => patch({ content: v })} />
                  <Select value={item.icon} options={ICONS} onChange={(v) => patch({ icon: v })} />
                </>
              )}
            />
          </Field>
          <Field label="Roles">
            <ItemList
              items={block.roles}
              max={6}
              addLabel="Add a role"
              onChange={(items) => as<'hub-diagram'>((b) => void (b.roles = items))}
              make={() => ({ id: newId('r'), content: 'New role' })}
              render={(item, patch) => <TextInput value={item.content} onCommit={(v) => patch({ content: v })} />}
            />
          </Field>
        </>
      );
    case 'contact-details':
      return (
        <>
          {(['name', 'role', 'phone', 'email'] as const).map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
              <TextInput value={block[k]} onCommit={(v) => as<'contact-details'>((b) => void (b[k] = v))} />
            </Field>
          ))}
        </>
      );
    case 'enquiry-form':
      return (
        <>
          <Field label="Heading">
            <TextInput value={block.heading} onCommit={(v) => as<'enquiry-form'>((b) => void (b.heading = v))} />
          </Field>
          <Field label="Intro">
            <TextInput multiline value={block.intro} onCommit={(v) => as<'enquiry-form'>((b) => void (b.intro = v))} />
          </Field>
        </>
      );
    default:
      return null;
  }
}

function BlockPanel({ slide, block, deckId }: { slide: Slide; block: Block; deckId: string }) {
  const change = useChange();
  const selectBlock = useEditor((s) => s.selectBlock);
  const { undo } = useHistory();
  const toast = useToast();
  const found = locate(slide, block.id)!;
  const siblings = slide.slots[found.slot];

  const update = (recipe: (b: Block) => void) =>
    change((d) => {
      const f = locate(slideOf(d, slide.id), block.id);
      if (f) recipe(f.block);
    });
  const move = (by: number) =>
    change((d) => {
      const list = slideOf(d, slide.id).slots[found.slot];
      const [b] = list.splice(found.index, 1);
      list.splice(found.index + by, 0, b);
    });
  const remove = () => {
    change((d) => {
      const s = slideOf(d, slide.id);
      s.slots[found.slot] = s.slots[found.slot].filter((b) => b.id !== block.id);
    });
    selectBlock(null);
    toast(`${BLOCK_LABELS[block.type][0].toUpperCase()}${BLOCK_LABELS[block.type].slice(1)} deleted`, { label: 'Undo', run: undo });
  };
  const setMotion = (key: keyof BlockMotion, v: string) =>
    update((b) => {
      b.motion = { ...b.motion, [key]: v || undefined };
    });
  const buildValue = typeof block.build === 'number' ? String(block.build) : block.build;

  return (
    <>
      <Section title={BLOCK_LABELS[block.type][0].toUpperCase() + BLOCK_LABELS[block.type].slice(1)}>
        <TypeSettings block={block} deckId={deckId} update={update} />
        <div className="flex gap-2">
          <button type="button" className="ui-button flex-1" disabled={found.index === 0} onClick={() => move(-1)}>
            Move up
          </button>
          <button type="button" className="ui-button flex-1" disabled={found.index === siblings.length - 1} onClick={() => move(1)}>
            Move down
          </button>
        </div>
        <button type="button" className="ui-button is-danger w-full" onClick={remove}>
          Delete
        </button>
      </Section>
      <Section title="Build">
        <Field label="Step" hint={slide.buildMode === 'manual' ? undefined : 'Used when the slide’s build mode is Manual'}>
          <Select
            value={buildValue}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'with-previous', label: 'With previous' },
              ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Step ${i + 1}` })),
            ]}
            onChange={(v) => update((b) => void (b.build = v === 'auto' || v === 'with-previous' ? v : Number(v)))}
          />
        </Field>
        <Field label="Style">
          <Select value={block.motion?.style ?? ''} options={inherit(STYLES, 'Slide default')} onChange={(v) => setMotion('style', v)} />
        </Field>
        {block.motion?.style === 'slide' || block.motion?.style === 'wipe' ? (
          <Field label="Direction">
            <Select value={block.motion?.direction ?? 'up'} options={[...DIRECTIONS]} onChange={(v) => setMotion('direction', v)} />
          </Field>
        ) : null}
        <Field label="Stagger">
          <Select value={block.motion?.stagger ?? ''} options={inherit(STAGGERS, 'Slide default')} onChange={(v) => setMotion('stagger', v)} />
        </Field>
        <Field label="Show in">
          <Select
            value={block.showIn}
            options={[
              { value: 'both', label: 'Present and print' },
              { value: 'present', label: 'Present only' },
              { value: 'print', label: 'Print only' },
            ]}
            onChange={(v) => update((b) => void (b.showIn = v))}
          />
        </Field>
      </Section>
    </>
  );
}

export function Inspector() {
  const deck = useEditor((s) => s.deck);
  const panel = useEditor((s) => s.panel);
  const slideId = useEditor((s) => s.slideId);
  const blockId = useEditor((s) => s.blockId);
  const setPanel = useEditor((s) => s.setPanel);
  const slide = slideOf(deck, slideId);
  const block = blockId ? locate(slide, blockId)?.block : undefined;
  const view = panel === 'block' && !block ? 'slide' : panel;

  return (
    <aside className="ui-inspector" aria-label="Inspector">
      <div className="ui-tabs" role="tablist">
        {(['deck', 'slide', 'block'] as const).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={view === p} disabled={p === 'block' && !block} onClick={() => setPanel(p)}>
            {p === 'deck' ? 'Deck' : p === 'slide' ? 'Slide' : 'Block'}
          </button>
        ))}
      </div>
      <div className="ui-inspector-body">
        {view === 'deck' ? <DeckPanel deck={deck} /> : null}
        {view === 'slide' ? <SlidePanel slide={slide} /> : null}
        {view === 'block' && block ? <BlockPanel key={block.id} slide={slide} block={block} deckId={deck.id} /> : null}
      </div>
    </aside>
  );
}
