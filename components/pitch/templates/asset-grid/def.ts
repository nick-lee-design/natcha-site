import { sample, SAMPLE_GRID } from '../samples';
import { slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const GRID_SIZES: Record<string, number> = { '5x5': 5, '4x4': 4, '3x3': 3 };

export const assetGrid: TemplateDef = {
  id: 'asset-grid',
  name: 'Asset grid',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title'], max: 1, text: true },
    { name: 'grid', label: 'Grid', accepts: ['image-grid'], max: 1 },
    { name: 'caption', label: 'Caption', accepts: ['caption', 'paragraph'], max: 2, text: true },
  ],
  variants: [
    { id: '5x5', label: '5 × 5' },
    { id: '4x4', label: '4 × 4' },
    { id: '3x3', label: '3 × 3 large' },
  ],
  defaultSlots: () => ({
    title: [sample.title('title')],
    grid: [{ id: 'grid', type: 'image-grid', build: 'auto', showIn: 'both', items: SAMPLE_GRID }],
    caption: [sample.caption('caption')],
  }),
  // The grid cascades in as one build, then the caption
  autoSteps: (slide) => [slotUnits(slide, 'title', 'grid'), slotUnits(slide, 'caption')],
};
