'use client';

import { qrPath } from '@/lib/pitch/qr';
import type { BlockOf } from '@/lib/pitch/schema';
import { enquireUrl } from '@/lib/pitch/site';
import { Build } from '../canvas/Build';
import { useMode } from '../canvas/ModeProvider';

const QUIET = 2;

// Under the contact details: scan to fill the enquiry form in on a phone
export function EnquiryQr({ block }: { block: BlockOf<'enquiry-form'> }) {
  const { deck } = useMode();
  const url = enquireUrl(deck.id);
  const { d, size } = qrPath(url);
  const view = size + QUIET * 2;
  return (
    <Build unit={block.id} motion={block.motion} badge={false} className="d-enquiry-qr">
      <svg viewBox={`${-QUIET} ${-QUIET} ${view} ${view}`} width={132} height={132} shapeRendering="crispEdges" aria-label="QR code for the enquiry form">
        <rect x={-QUIET} y={-QUIET} width={view} height={view} fill="#fff" />
        <path d={d} fill="var(--deck-ink)" />
      </svg>
      <div>
        <div className="d-qr-lead">Scan to fill in online</div>
        <a className="d-qr-link" href={url}>
          {url.replace(/^https?:\/\//, '')}
        </a>
      </div>
    </Build>
  );
}
