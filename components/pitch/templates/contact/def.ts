import { sample } from '../samples';
import { slotUnits } from '../recipe';
import type { TemplateDef } from '../types';

export const contact: TemplateDef = {
  id: 'contact',
  name: 'Contact',
  slots: [
    { name: 'title', label: 'Heading', accepts: ['title'], max: 1, text: true },
    { name: 'details', label: 'Contact details', accepts: ['contact-details'], max: 1 },
    { name: 'form', label: 'Form', accepts: ['enquiry-form', 'qr-link'], max: 2 },
  ],
  // Live form on screen; the print render swaps in the QR card
  variants: [{ id: 'form', label: 'Form' }],
  defaultSlots: () => ({
    title: [sample.title('title', 'Contact')],
    details: [
      {
        id: 'details',
        type: 'contact-details',
        build: 'auto',
        showIn: 'both',
        name: 'Natcha Kucita',
        role: 'Director | Engineer',
        phone: '07850 091982',
        email: 'natcha@taloengine.com',
      },
    ],
    form: [
      {
        id: 'form',
        type: 'enquiry-form',
        build: 'auto',
        showIn: 'both',
        heading: 'Enquiry form',
        intro: 'Interested in working with Talo? Complete the form below and we will be in touch.',
      },
    ],
  }),
  // Details first, then the form card
  autoSteps: (slide) => [slotUnits(slide, 'title', 'details'), slotUnits(slide, 'form')],
};
