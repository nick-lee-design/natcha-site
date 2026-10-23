'use client';

import { serviceOptions } from '@/lib/pitch/enquiry';
import type { BlockOf } from '@/lib/pitch/schema';
import { Build } from '../canvas/Build';
import { useMode } from '../canvas/ModeProvider';

// The contact slide's form in print. Each box carries data-pdf-field, and the PDF generator
// lays a real form field over it, so the PDF can be filled in, saved and emailed back.
// Field names match the online form's.
export function PrintEnquiry({ block, email }: { block: BlockOf<'enquiry-form'>; email?: string }) {
  const { deck } = useMode();
  const box = (name: string, kind: 'text' | 'multiline' = 'text', value = '') => (
    <span className={`d-pdf-box${kind === 'multiline' ? ' is-multiline' : ''}`} data-pdf-field={name} data-pdf-kind={kind} data-pdf-value={value || undefined} />
  );
  const field = (name: string, label: string, wide = false, required = false, value = '') => (
    <div className={`d-field${wide ? ' is-wide' : ''}`}>
      <span>
        {label}
        {required ? <abbr title="required"> *</abbr> : null}
      </span>
      {box(name, 'text', value)}
    </div>
  );

  return (
    <Build unit={block.id} motion={block.motion} className="d-form-card">
      <div className="d-form-heading">{block.heading}</div>
      <p className="d-form-intro">{block.intro}</p>
      <div className="d-form">
        {field('name', 'Full name', false, true)}
        {field('position', 'Position / job title')}
        {field('company', 'Company', false, true, deck.client.company)}
        {field('phone', 'Phone')}
        {field('email', 'Email', false, true)}
        {field('source', 'How did you hear about us?')}
        <div className="d-field is-wide">
          <span>Services of interest</span>
          <div className="d-checks">
            {serviceOptions(deck).map((s) => (
              <div key={s} className="d-check">
                <span className="d-pdf-check" data-pdf-field={`services: ${s}`} data-pdf-kind="checkbox" />
                {s}
              </div>
            ))}
          </div>
        </div>
        {field('project', 'Project type / location', true)}
        {field('start', 'Preferred start date')}
        {field('duration', 'Estimated duration')}
        <div className="d-field is-wide">
          <span>Project details / message</span>
          {box('details', 'multiline')}
        </div>
        {email ? (
          <div className="d-form-foot is-wide">
            <span className="d-pdf-return">
              Fill in, save and email to{' '}
              <a href={`mailto:${email}?subject=${encodeURIComponent(`Enquiry${deck.client.company ? ` from ${deck.client.company}` : ''}`)}`}>{email}</a>
            </span>
          </div>
        ) : null}
      </div>
    </Build>
  );
}
