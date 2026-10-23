import { sample } from '../samples';
import { sequence, slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const splitImage: TemplateDef = {
  id: 'split-image',
  name: 'Text and image',
  slots: [
    { name: 'text', label: 'Text', accepts: ['title', 'subtitle', 'paragraph', 'list', 'caption', 'label'], max: 8, text: true },
    { name: 'media', label: 'Image', accepts: ['image'], max: 1 },
  ],
  variants: [
    { id: 'image-right', label: 'Image right' },
    { id: 'image-left', label: 'Image left' },
    { id: 'visual-only', label: 'Visual only' },
  ],
  defaultSlots: () => ({
    text: [sample.title('title'), sample.paragraph('p1')],
    media: [sample.image('media')],
  }),
  // Image panel wipes in, then the title, then each paragraph
  autoSteps: (slide) =>
    slide.variant === 'visual-only' || slide.hideText
      ? [slotUnits(slide, 'media')]
      : [slotUnits(slide, 'media'), ...sequence(slide, ['text'])],
};
