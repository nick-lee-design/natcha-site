import { sample } from '../samples';
import { blocks, slotUnits, unit } from '../recipe';
import type { TemplateDef } from '../types';

export const multiViewCaseStudy: TemplateDef = {
  id: 'multi-view-case-study',
  name: 'Case study, plan with views',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title'], max: 1, text: true },
    { name: 'plan', label: 'Plan', accepts: ['image'], max: 1 },
    { name: 'plan-label', label: 'Plan label', accepts: ['label'], max: 1, text: true },
    { name: 'key', label: 'Equipment key', accepts: ['key-list'], max: 1 },
    { name: 'view', label: '3D view', accepts: ['image'], max: 1 },
    { name: 'view-label', label: '3D view label', accepts: ['label'], max: 1, text: true },
    { name: 'section', label: 'Section view', accepts: ['image'], max: 1 },
    { name: 'section-label', label: 'Section label', accepts: ['label'], max: 1, text: true },
    { name: 'text', label: 'Text', accepts: ['paragraph'], max: 3, text: true },
  ],
  variants: [{ id: 'standard', label: 'As the PDF' }],
  defaultSlots: () => ({
    title: [sample.title('title')],
    plan: [sample.image('plan', 'kitchen-plan.jpg', 448, 1658, 'contain')],
    'plan-label': [sample.label('plan-label', 'Plan view', 'Scale: NTS')],
    key: [
      {
        id: 'key',
        type: 'key-list',
        build: 'auto',
        showIn: 'both',
        heading: 'Key',
        items: [
          { id: 'k1', number: 1, content: 'First item' },
          { id: 'k2', number: 2, content: 'Second item' },
        ],
        markers: [],
      },
    ],
    view: [sample.image('view', 'kitchen-3d.jpg', 2384, 1614, 'contain')],
    'view-label': [sample.label('view-label', '3D view', 'Scale: NTS')],
    section: [sample.image('section', 'kitchen-section.jpg', 2400, 951, 'contain')],
    'section-label': [sample.label('section-label', 'Section view', 'Scale: NTS')],
    text: [sample.paragraph('text')],
  }),
  // Plan, then the key with its plan markers, then 3D, then section (with its markers), then text
  autoSteps: (slide) => {
    const key = blocks(slide, 'key').find((b) => b.type === 'key-list');
    const items = key?.type === 'key-list' ? key : undefined;
    const markers = (view: string) =>
      items ? items.markers.filter((m) => m.view === view).map((m) => unit(items.id, m.id)) : [];
    return [
      slotUnits(slide, 'title', 'plan', 'plan-label'),
      [...(items ? items.items.map((i) => unit(items.id, i.id)) : []), ...markers('plan')],
      slotUnits(slide, 'view', 'view-label'),
      [...slotUnits(slide, 'section', 'section-label'), ...markers('section')],
      slotUnits(slide, 'text'),
    ];
  },
};
