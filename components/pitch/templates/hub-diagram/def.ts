import { sample } from '../samples';
import { blocks, slotUnits, unit } from '../recipe';
import type { TemplateDef } from '../types';

export const hubDiagram: TemplateDef = {
  id: 'hub-diagram',
  name: 'Hub diagram',
  slots: [
    { name: 'title', label: 'Title', accepts: ['title'], max: 1, text: true },
    { name: 'diagram', label: 'Diagram', accepts: ['hub-diagram'], max: 1 },
  ],
  variants: [
    { id: 'ring', label: 'Ring' },
    { id: 'list', label: 'Simple list' },
  ],
  defaultSlots: () => ({
    title: [sample.title('title')],
    diagram: [
      {
        id: 'hub',
        type: 'hub-diagram',
        build: 'auto',
        showIn: 'both',
        centre: 'Talo Engine',
        benefits: [
          { id: 'b1', content: 'First benefit', icon: 'document' },
          { id: 'b2', content: 'Second benefit', icon: 'layers' },
          { id: 'b3', content: 'Third benefit', icon: 'forward' },
          { id: 'b4', content: 'Fourth benefit', icon: 'clock' },
        ],
        roles: [
          { id: 'r1', content: 'Role' },
          { id: 'r2', content: 'Role' },
        ],
      },
    ],
  }),
  // The centre ring draws itself, each benefit arrives one at a time, roles last together
  autoSteps: (slide) => {
    const hub = blocks(slide, 'diagram').find((b) => b.type === 'hub-diagram');
    const title = slotUnits(slide, 'title');
    if (!hub || hub.type !== 'hub-diagram') return [title];
    return [
      [...title, unit(hub.id, 'centre')],
      ...hub.benefits.map((b) => [unit(hub.id, b.id)]),
      hub.roles.map((r) => unit(hub.id, r.id)),
    ];
  },
};
