'use client';

import type { BlockOf } from '@/lib/pitch/schema';
import { Build } from '../canvas/Build';

export function ContactDetails({ block }: { block: BlockOf<'contact-details'> }) {
  return (
    <Build unit={block.id} motion={block.motion} className="d-contact">
      <div className="d-contact-name">{block.name}</div>
      <div className="d-contact-role">{block.role}</div>
      <div className="d-contact-key">Phone</div>
      <a className="d-contact-value" href={`tel:${block.phone.replace(/\s/g, '')}`}>{block.phone}</a>
      <div className="d-contact-key">Email</div>
      <a className="d-contact-value" href={`mailto:${block.email}`}>{block.email}</a>
    </Build>
  );
}
