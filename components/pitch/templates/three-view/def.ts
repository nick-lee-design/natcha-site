import { sample } from '../samples';
import { slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const threeView: TemplateDef = {
  id: 'three-view',
  name: 'Three views',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title'], max: 1, text: true },
    { name: 'view-1', label: 'First view', accepts: ['image'], max: 1 },
    { name: 'view-1-label', label: 'First view label', accepts: ['label'], max: 1, text: true },
    { name: 'view-2', label: 'Second view', accepts: ['image'], max: 1 },
    { name: 'view-2-label', label: 'Second view label', accepts: ['label'], max: 1, text: true },
    { name: 'view-3', label: 'Third view', accepts: ['image'], max: 1 },
    { name: 'view-3-label', label: 'Third view label', accepts: ['label'], max: 1, text: true },
    { name: 'text', label: 'Text', accepts: ['paragraph'], max: 3, text: true },
  ],
  variants: [
    { id: 'three', label: 'Three views' },
    { id: 'two', label: 'Two views' },
  ],
  defaultSlots: () => ({
    title: [sample.title('title')],
    'view-1': [sample.image('view-1', 'ffe-plan.jpg', 1514, 1515, 'contain')],
    'view-1-label': [sample.label('view-1-label', 'Plan view', 'Scale: NTS')],
    'view-2': [sample.image('view-2', 'ffe-3d.jpg', 1085, 2150, 'contain')],
    'view-2-label': [sample.label('view-2-label', '3D view', 'Scale: NTS')],
    'view-3': [sample.image('view-3', 'ffe-render.jpg', 1160, 2235, 'contain')],
    'view-3-label': [sample.label('view-3-label', 'Render image')],
    text: [sample.paragraph('text')],
  }),
  // Plan line work, then the 3D view, then the render, then text
  autoSteps: (slide) => [
    slotUnits(slide, 'title', 'view-1', 'view-1-label'),
    slide.variant === 'two' ? [] : slotUnits(slide, 'view-2', 'view-2-label'),
    slotUnits(slide, 'view-3', 'view-3-label'),
    slotUnits(slide, 'text'),
  ],
};
