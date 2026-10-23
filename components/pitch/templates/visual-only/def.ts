import { sample } from '../samples';
import { slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const visualOnly: TemplateDef = {
  id: 'visual-only',
  name: 'Visual',
  slots: [
    { name: 'media', label: 'Image', accepts: ['image'], max: 1 },
    { name: 'caption', label: 'Caption', accepts: ['caption'], max: 1, text: true },
  ],
  variants: [
    { id: 'full-bleed', label: 'Full bleed' },
    { id: 'framed', label: 'Framed' },
  ],
  defaultSlots: () => ({ media: [sample.image('media', 'plant-room-ambient-loop.jpg', 3000, 1510)], caption: [] }),
  // Image reveal, then caption
  autoSteps: (slide) => [slotUnits(slide, 'media'), slotUnits(slide, 'caption')],
};
