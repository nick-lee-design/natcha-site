import { sample } from '../samples';
import { sequence, slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const cover: TemplateDef = {
  id: 'cover',
  name: 'Cover',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title'], max: 1, text: true },
    { name: 'subtitle', label: 'Subtitle', accepts: ['subtitle'], max: 1, text: true },
    { name: 'client', label: 'Client line', accepts: ['label'], max: 1, text: true },
    { name: 'date', label: 'Date', accepts: ['label'], max: 1, text: true },
    { name: 'media', label: 'Image', accepts: ['image'], max: 1 },
  ],
  variants: [
    { id: 'gradient', label: 'Gradient' },
    { id: 'image', label: 'Image background' },
    { id: 'split', label: 'Split with image' },
    { id: 'assembly', label: 'Living assembly' },
  ],
  defaultSlots: () => ({
    title: [sample.title('title', 'Talo Engine')],
    client: [sample.label('client', 'Prepared for {{client.company}} · {{date}}')],
    media: [sample.image('media', 'plant-room-ambient-loop.jpg', 3000, 1510)],
  }),
  // Background settles, then the title rises in, then the client line
  autoSteps: (slide) => {
    const media = slide.variant === 'image' || slide.variant === 'split' ? slotUnits(slide, 'media') : [];
    const lines = slotUnits(slide, 'client', 'date');
    return [['@bg', ...media, ...sequence(slide, ['title', 'subtitle']).flat()], lines];
  },
};
