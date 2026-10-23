import { sample } from '../samples';
import { sequence, slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const section: TemplateDef = {
  id: 'section',
  name: 'Section',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title', 'subtitle'], max: 2, text: true },
    { name: 'media', label: 'Image', accepts: ['image'], max: 1 },
  ],
  variants: [
    { id: 'plain', label: 'Plain' },
    { id: 'image', label: 'Image' },
  ],
  defaultSlots: () => ({ title: [sample.title('title', 'Section title')], media: [sample.image('media')] }),
  // Title only
  autoSteps: (slide) => [[...(slide.variant === 'image' ? slotUnits(slide, 'media') : []), ...sequence(slide, ['title']).flat()]],
};
