'use client';

import { serviceOptions } from '@/lib/pitch/enquiry';
import type { BlockOf } from '@/lib/pitch/schema';
import { Build } from '../canvas/Build';
import { useMode } from '../canvas/ModeProvider';
import { EnquiryFields } from '../forms/EnquiryFields';

export function EnquiryForm({ block, contact }: { block: BlockOf<'enquiry-form'>; contact?: BlockOf<'contact-details'> }) {
  const { deck, mode } = useMode();
  return (
    <Build unit={block.id} motion={block.motion} className="d-form-card">
      <div className="d-form-heading">{block.heading}</div>
      <p className="d-form-intro">{block.intro}</p>
      <EnquiryFields
        key={deck.client.company}
        deckId={deck.id}
        company={deck.client.company}
        contact={contact}
        services={serviceOptions(deck)}
        disabled={mode !== 'present'}
      />
    </Build>
  );
}
