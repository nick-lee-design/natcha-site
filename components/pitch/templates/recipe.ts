import type { Block, Slide } from '@/lib/pitch/schema';

// A unit is anything that builds on its own: a block, an item inside a block
// (`block/item`), or a part of the template itself (`@name`).
export const unit = (blockId: string, part: string) => `${blockId}/${part}`;

export function unitsOf(block: Block): string[] {
  switch (block.type) {
    case 'image-grid':
    case 'list':
      return block.items.map((i) => unit(block.id, i.id));
    case 'table':
      return [unit(block.id, 'head'), ...block.rows.map((r) => unit(block.id, r.id))];
    case 'key-list':
      return [...block.items.map((i) => unit(block.id, i.id)), ...block.markers.map((m) => unit(block.id, m.id))];
    case 'hub-diagram':
      return [
        unit(block.id, 'centre'),
        ...block.benefits.map((b) => unit(block.id, b.id)),
        ...block.roles.map((r) => unit(block.id, r.id)),
      ];
    default:
      return [block.id];
  }
}

// Blocks that play in present mode
export function blocks(slide: Slide, slot: string): Block[] {
  return (slide.slots[slot] ?? []).filter((b) => b.showIn !== 'print');
}

export function slotUnits(slide: Slide, ...slots: string[]) {
  return slots.flatMap((s) => blocks(slide, s).flatMap(unitsOf));
}

// The default walk: a title takes its subtitle with it, list items arrive one
// at a time, and every other block is its own step.
export function sequence(slide: Slide, slots: string[]): string[][] {
  const steps: string[][] = [];
  let prev: Block | undefined;
  for (const b of slots.flatMap((s) => blocks(slide, s))) {
    if (b.type === 'subtitle' && prev?.type === 'title') steps[steps.length - 1].push(b.id);
    else if (b.type === 'list') steps.push(...unitsOf(b).map((u) => [u]));
    else steps.push(unitsOf(b));
    prev = b;
  }
  return steps;
}
