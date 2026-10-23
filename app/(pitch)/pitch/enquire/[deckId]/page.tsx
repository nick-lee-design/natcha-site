import { notFound } from 'next/navigation';
import { EnquiryFields } from '@/components/pitch/forms/EnquiryFields';
import { serviceOptions } from '@/lib/pitch/enquiry';
import type { BlockOf } from '@/lib/pitch/schema';
import { storage } from '@/lib/pitch/storage';
import { getTheme, themeVars } from '@/lib/pitch/theme';

export async function generateStaticParams() {
  return (await storage.list()).map((d) => ({ deckId: d.id }));
}

// Where the PDF's QR code leads: the enquiry form, with the client's company filled in
export default async function EnquirePage({ params }: PageProps<'/pitch/enquire/[deckId]'>) {
  const deck = await storage.get((await params).deckId);
  if (!deck) notFound();
  const blocks = deck.slides.flatMap((s) => Object.values(s.slots).flat());
  const form = blocks.find((b): b is BlockOf<'enquiry-form'> => b.type === 'enquiry-form');
  const contact = blocks.find((b): b is BlockOf<'contact-details'> => b.type === 'contact-details');
  const theme = getTheme(deck.theme);

  return (
    <main className="pitch-enquire min-h-svh bg-white px-4 py-10 text-ink sm:py-16" style={themeVars(theme)}>
      <div className="mx-auto max-w-3xl">
        <div className="d-wordmark mb-8 text-accent">{theme.wordmark}</div>
        <div className="d-form-card">
          <h1 className="d-form-heading">{form?.heading ?? 'Enquiry form'}</h1>
          <p className="d-form-intro">{form?.intro}</p>
          <EnquiryFields deckId={deck.id} company={deck.client.company} contact={contact} services={serviceOptions(deck)} />
        </div>
        {contact ? (
          <p className="mt-6 text-sm text-muted">
            Or contact {contact.name} on <a className="text-accent" href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a> or{' '}
            <a className="text-accent" href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        ) : null}
      </div>
    </main>
  );
}
