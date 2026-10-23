import { sample } from '../samples';
import { sequence } from '../recipe';
import type { TemplateDef } from '../types';

export const textOnly: TemplateDef = {
  id: 'text-only',
  name: 'Text',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title', 'subtitle'], max: 2, text: true },
    { name: 'body', label: 'Text', accepts: ['paragraph', 'list', 'subtitle', 'caption', 'label'], max: 10, text: true },
  ],
  variants: [
    { id: 'one-column', label: 'One column' },
    { id: 'two-columns', label: 'Two columns' },
  ],
  defaultSlots: () => ({ title: [sample.title('title')], body: [sample.paragraph('p1'), sample.paragraph('p2')] }),
  // Title, then each block
  autoSteps: (slide) => sequence(slide, ['title', 'body']),
};
