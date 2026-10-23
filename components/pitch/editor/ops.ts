import type { Block, BlockType, Deck, Slide } from '@/lib/pitch/schema';
import { templateDefs } from '../templates/defs';
import { sample } from '../templates/samples';

export const newId = (prefix = 'b') => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// New ids for every block, so a copied slide never shares ids with its source
export function freshSlots(slots: Slide['slots']): Slide['slots'] {
  return Object.fromEntries(Object.entries(slots).map(([k, blocks]) => [k, blocks.map((b) => ({ ...structuredClone(b), id: newId(b.type.slice(0, 3)) }))]));
}

export function makeSlide(template: string, variant?: string): Slide {
  const def = templateDefs[template];
  return {
    id: newId('slide'),
    template,
    variant: variant ?? def.variants[0]?.id,
    hidden: false,
    buildMode: 'auto',
    hideText: false,
    notes: '',
    slots: freshSlots(def.defaultSlots()),
  };
}

export function duplicateSlide(slide: Slide): Slide {
  return { ...structuredClone(slide), id: newId('slide'), slots: freshSlots(slide.slots) };
}

export function defaultBlock(type: BlockType): Block {
  const id = newId(type.slice(0, 3));
  const base = { id, build: 'auto', showIn: 'both' } as const;
  switch (type) {
    case 'title':
    case 'subtitle':
    case 'paragraph':
    case 'caption':
      return { ...sample[type](id) };
    case 'label':
      return sample.label(id, 'Label');
    case 'image':
      return sample.image(id);
    case 'image-grid':
      return { ...base, type, items: [] };
    case 'list':
      return { ...base, type, items: [{ id: newId('i'), content: 'First point' }, { id: newId('i'), content: 'Second point' }] };
    case 'table':
      return {
        ...base,
        type,
        columns: [
          { id: newId('c'), label: 'Item', width: 40, role: 'name' },
          { id: newId('c'), label: 'Detail', width: 60, role: 'text' },
        ],
        rows: [{ id: newId('r'), cells: ['', ''] }],
        services: false,
      };
    case 'key-list':
      return { ...base, type, heading: 'Key', items: [{ id: newId('k'), number: 1, content: 'First item' }], markers: [] };
    case 'hub-diagram':
      return {
        ...base,
        type,
        centre: 'Talo Engine',
        benefits: ['document', 'layers', 'forward'].map((icon, i) => ({ id: newId('b'), content: `Benefit ${i + 1}`, icon: icon as 'document' })),
        roles: [],
      };
    case 'contact-details':
      return { ...base, type, name: 'Natcha Kucita', role: 'Director | Engineer', phone: '07850 091982', email: 'natcha@taloengine.com' };
    case 'enquiry-form':
      return { ...base, type, heading: 'Enquiry form', intro: 'Complete the form below and we will be in touch.' };
    case 'qr-link':
      return { ...base, type, content: 'Scan to send an enquiry' };
  }
}

export function locate(slide: Slide, blockId: string) {
  for (const [slot, blocks] of Object.entries(slide.slots)) {
    const index = blocks.findIndex((b) => b.id === blockId);
    if (index >= 0) return { slot, index, block: blocks[index] };
  }
  return null;
}

export const slideOf = (deck: Deck, id: string) => deck.slides.find((s) => s.id === id) ?? deck.slides[0];
