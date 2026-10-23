import { expect, test } from '@playwright/test';
import { PDFDocument, PDFName } from 'pdf-lib';
import { visibleSlides } from '../decks';

const DECK = 'talo-base';

test('the PDF has one 16:9 page per slide, selectable text and a fillable enquiry form', async ({ request }) => {
  const res = await request.get(`/api/pitch/pdf/${DECK}`, { timeout: 120_000 });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('application/pdf');
  expect(res.headers()['content-disposition']).toMatch(/filename="Talo-Engine-\d{4}-\d{2}\.pdf"/);
  const doc = await PDFDocument.load(await res.body());
  expect(doc.getPageCount()).toBe(visibleSlides(DECK).length);
  // 1600 × 900 CSS px is 1200 × 675 pt (Chromium rounds the height to 675.12)
  const { width, height } = doc.getPage(0).getSize();
  expect(width / height).toBeCloseTo(16 / 9, 2);
  // Real text, not pictures of text
  expect(doc.getPage(0).node.Resources()?.lookup(PDFName.of('Font'))).toBeTruthy();
  // The contact slide's boxes are form fields, with the services from the packages table
  const fields = doc.getForm().getFields().map((f) => f.getName());
  expect(fields).toEqual(expect.arrayContaining(['name', 'company', 'email', 'details', 'services: BIM management']));

  const again = await request.get(`/api/pitch/pdf/${DECK}`);
  expect(again.headers()['x-pitch-pdf']).toBe('hit');
});

test('the enquiry endpoint validates, sends with the deck id, and ignores bots', async ({ request }) => {
  const enquiry = {
    name: 'Test Person',
    position: '',
    company: 'Acme Hotels',
    phone: '',
    email: 'test@example.com',
    source: '',
    services: ['BIM management'],
    project: '',
    start: '',
    duration: '',
    details: 'Automated test',
    deckId: DECK,
    website: '',
  };
  expect((await request.post('/api/pitch/enquiry', { data: { ...enquiry, email: 'nope' } })).status()).toBe(400);
  expect((await request.post('/api/pitch/enquiry', { data: enquiry })).status()).toBe(200);
  expect((await request.post('/api/pitch/enquiry', { data: { ...enquiry, website: 'spam' } })).status()).toBe(200);
});

test('the contact slide’s form fills in and sends', async ({ page }) => {
  const slides = visibleSlides(DECK);
  await page.goto(`/pitch/present/${DECK}#slide-${slides.findIndex((s) => s.id === 'contact') + 1}`);
  await page.keyboard.press('ArrowRight');
  await page.getByLabel('Full name').fill('Test Person');
  await page.getByLabel('Company').fill('Acme Hotels');
  await page.getByLabel('Email').fill('test@example.com');
  // Typing in a field doesn't move the slides
  const hash = await page.evaluate(() => location.hash);
  await page.getByLabel('Project details / message').press('ArrowRight');
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  await page.getByLabel('BIM management').check();
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByText('Thank you')).toBeVisible();
});
