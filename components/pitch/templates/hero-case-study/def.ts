import { sample } from '../samples';
import { slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const heroCaseStudy: TemplateDef = {
  id: 'hero-case-study',
  name: 'Case study, one view',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title'], max: 1, text: true },
    { name: 'media', label: 'Image', accepts: ['image'], max: 1 },
    { name: 'view', label: 'View label', accepts: ['label'], max: 1, text: true },
    { name: 'heading', label: 'Case title', accepts: ['subtitle'], max: 1, text: true },
    { name: 'text', label: 'Text', accepts: ['paragraph'], max: 3, text: true },
  ],
  variants: [
    { id: 'full-width', label: 'Full width' },
    { id: 'side-text', label: 'Image with side text' },
  ],
  defaultSlots: () => ({
    title: [sample.title('title')],
    media: [sample.image('media', 'plant-room-ambient-loop.jpg', 3000, 1510, 'contain')],
    view: [sample.label('view', '3D view', 'Scale: NTS')],
    heading: [sample.subtitle('heading', 'Project name | RIBA stage')],
    text: [sample.paragraph('text')],
  }),
  // The image reveals with a mask wipe, then the caption block
  autoSteps: (slide) => [slotUnits(slide, 'title', 'media'), slotUnits(slide, 'view', 'heading', 'text')],
};
