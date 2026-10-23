import { z } from 'zod';
import { otherService } from '@/content/pricing';
import type { Deck } from './schema';
import { rowLabel } from './tables';

// The services the form offers: the rows of the deck's tables marked for it, then "Other"
export function serviceOptions(deck: Deck): string[] {
  const labels = deck.slides
    .filter((s) => !s.hidden)
    .flatMap((s) => Object.values(s.slots).flat())
    .flatMap((b) => (b.type === 'table' && b.services ? b.rows.map((r) => rowLabel(b, r.cells)) : []))
    .filter(Boolean);
  return [...new Set([...labels, otherService.formLabel])];
}

const text = (max: number) => z.string().trim().max(max);

// Shared by the form in the browser and /api/pitch/enquiry
export const enquirySchema = z.object({
  name: text(200).min(1, 'Please add your name'),
  position: text(200),
  company: text(200).min(1, 'Please add your company'),
  phone: text(60),
  email: z.string().trim().pipe(z.email('Please check your email address')),
  source: text(300),
  services: z.array(text(200)).max(30),
  project: text(300),
  start: text(30),
  duration: text(100),
  details: text(5000),
  deckId: text(120),
  // Honeypot: hidden from people, so anything here came from a bot
  website: z.string().max(500),
});

export type Enquiry = z.infer<typeof enquirySchema>;

export const emptyEnquiry = (deckId: string, company: string): Enquiry => ({
  name: '',
  position: '',
  company,
  phone: '',
  email: '',
  source: '',
  services: [],
  project: '',
  start: '',
  duration: '',
  details: '',
  deckId,
  website: '',
});
