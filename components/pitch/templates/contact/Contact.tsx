'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { box } from '../../canvas/geometry';
import { useBlock, useMode } from '../../canvas/ModeProvider';
import { ContactDetails } from '../../blocks/ContactDetails';
import { EnquiryForm } from '../../blocks/EnquiryForm';
import { EnquiryQr } from '../../blocks/EnquiryQr';
import { PrintEnquiry } from '../../blocks/PrintEnquiry';
import { SlideTitle } from '../shared';
import type { TemplateProps } from '../types';

export function Contact(_: TemplateProps) {
  const { mode } = useMode();
  const details = useBlock('details', 'contact-details');
  const form = useBlock('form', 'enquiry-form');
  return (
    <ContentFrame>
      <SlideTitle width={380} />
      <div className="absolute" style={box(84, 168, 400)}>
        {details ? <ContactDetails block={details} /> : null}
      </div>
      {form ? (
        <div className="absolute" style={box(84, 600, 400)}>
          <EnquiryQr block={form} />
        </div>
      ) : null}
      {form ? (
        <div className="absolute" style={box(524, 58, 992, 762)}>
          {/* Live form on screen; in print, boxes the PDF turns into fillable fields */}
          {mode === 'print' ? <PrintEnquiry block={form} email={details?.email} /> : <EnquiryForm block={form} contact={details} />}
        </div>
      ) : null}
    </ContentFrame>
  );
}
