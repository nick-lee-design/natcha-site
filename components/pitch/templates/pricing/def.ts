import { packagesTable, stagesTable } from '@/lib/pitch/tables';
import { sample } from '../samples';
import { slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const pricing: TemplateDef = {
  id: 'pricing',
  name: 'Pricing',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title', 'subtitle'], max: 2, text: true },
    { name: 'stages', label: 'Stage table', accepts: ['label', 'table'], max: 2 },
    { name: 'packages', label: 'Packages table', accepts: ['label', 'table'], max: 2 },
    { name: 'footnote', label: 'Footnote', accepts: ['caption'], max: 1, text: true },
  ],
  variants: [
    { id: 'both', label: 'Both tables' },
    { id: 'packages', label: 'Packages only' },
  ],
  defaultSlots: () => ({
    title: [sample.title('title', 'Services package'), sample.subtitle('subtitle', 'Pricing')],
    stages: [sample.label('stages-label', 'Project fee guidelines'), { id: 'stages', type: 'table', build: 'auto', showIn: 'both', ...stagesTable() }],
    packages: [sample.label('packages-label', 'Packages'), { id: 'packages', type: 'table', build: 'auto', showIn: 'both', ...packagesTable() }],
    footnote: [sample.caption('footnote', 'All fees exclude VAT and are subject to terms and conditions.')],
  }),
  // Rows rise in one table at a time
  autoSteps: (slide) =>
    slide.variant === 'packages'
      ? [slotUnits(slide, 'title', 'packages', 'footnote')]
      : [slotUnits(slide, 'title', 'stages'), slotUnits(slide, 'packages', 'footnote')],
};
