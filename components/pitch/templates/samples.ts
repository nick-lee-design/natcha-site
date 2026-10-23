import type { Block } from '@/lib/pitch/schema';

// Starter content for new slides and the template picker's previews
const IMG = '/decks/talo-base/';
const base = { build: 'auto', showIn: 'both' } as const;

export const sample = {
  title: (id: string, content = 'Add a title'): Block => ({ ...base, id, type: 'title', content }),
  subtitle: (id: string, content = 'Add a subtitle'): Block => ({ ...base, id, type: 'subtitle', content }),
  paragraph: (id: string, content = 'Add a paragraph. Click any text on the slide to edit it.'): Block => ({
    ...base,
    id,
    type: 'paragraph',
    content,
  }),
  caption: (id: string, content = 'Add a caption'): Block => ({ ...base, id, type: 'caption', content }),
  label: (id: string, content = 'View', note?: string): Block => ({ ...base, id, type: 'label', content, note }),
  image: (id: string, src = 'plant-room-iso.jpg', width = 2000, height = 2647, fit: 'contain' | 'cover' = 'cover'): Block => ({
    ...base,
    id,
    type: 'image',
    src: src.startsWith('/') ? src : IMG + src,
    alt: '',
    width,
    height,
    fit,
  }),
};

export const SAMPLE_GRID = Array.from({ length: 25 }, (_, i) => ({ id: `a${i + 1}`, src: `${IMG}assets/asset-${i + 1}.jpg`, alt: '' }));
