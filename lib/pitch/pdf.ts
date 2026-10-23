import { readFileSync } from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import type { Deck } from './schema';

const words = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1));

// Talo-Engine-Acme-Hotels-2026-10.pdf
export function pdfFilename(deck: Deck) {
  return [...words('Talo Engine'), ...words(deck.client.company), deck.date.slice(0, 7)].join('-') + '.pdf';
}

async function launch() {
  const { chromium } = await import('playwright-core');
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const serverless = (await import('@sparticuz/chromium')).default;
    return chromium.launch({ executablePath: await serverless.executablePath(), args: serverless.args, headless: true });
  }
  return chromium.launch({ executablePath: process.env.PITCH_CHROMIUM_PATH || undefined });
}

// A box the print route marked with data-pdf-field, in CSS pixels on its 1600 × 900 page
type FieldBox = { name: string; kind: 'text' | 'multiline' | 'checkbox'; value: string; page: number; x: number; y: number; w: number; h: number };

// Headless Chromium prints the print route, so the PDF is the same render the browser shows
async function render(origin: string, deckId: string, access: Record<string, string>) {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, extraHTTPHeaders: access });
    await page.goto(`${origin}/pitch/print/${deckId}`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForSelector('[data-print-ready]', { timeout: 30_000 });
    const fields = await page.$$eval('[data-pdf-field]', (els) => {
      const pages = [...document.querySelectorAll('.pitch-page')];
      return els.map((el) => {
        const host = el.closest('.pitch-page')!;
        const r = el.getBoundingClientRect();
        const p = host.getBoundingClientRect();
        const d = (el as HTMLElement).dataset;
        return { name: d.pdfField!, kind: d.pdfKind, value: d.pdfValue ?? '', page: pages.indexOf(host), x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
      });
    });
    const pdf = new Uint8Array(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
    return fields.length ? addFormFields(pdf, fields as FieldBox[]) : pdf;
  } finally {
    await browser.close();
  }
}

const INK = rgb(0.176, 0.176, 0.176);

// Lays real form fields over the printed boxes, so the PDF can be filled in and saved in any viewer.
// The boxes stay drawn by the page; the fields are transparent and set 1px inside them.
async function addFormFields(pdf: Uint8Array, boxes: FieldBox[]) {
  const doc = await PDFDocument.load(pdf);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(readFileSync(path.join(process.cwd(), 'lib/pitch/fonts/Inter-Regular.ttf')), { subset: false });
  const form = doc.getForm();
  for (const b of boxes) {
    const page = doc.getPage(b.page);
    const scale = page.getWidth() / 1600;
    const at = {
      x: (b.x + 1) * scale,
      y: page.getHeight() - (b.y + b.h - 1) * scale,
      width: (b.w - 2) * scale,
      height: (b.h - 2) * scale,
      borderWidth: 0,
      borderColor: undefined,
      backgroundColor: undefined,
      textColor: INK,
    };
    if (b.kind === 'checkbox') {
      form.createCheckBox(b.name).addToPage(page, at);
      continue;
    }
    const field = form.createTextField(b.name);
    if (b.kind === 'multiline') field.enableMultiline();
    if (b.value) field.setText(b.value);
    // Inset to the live inputs' 10px side padding (and 8px top on the message box)
    const top = b.kind === 'multiline' ? 7 * scale : 0;
    field.addToPage(page, { ...at, x: at.x + 9 * scale, width: at.width - 18 * scale, height: at.height - top, font });
    field.setFontSize(10.5);
  }
  form.updateFieldAppearances(font);
  return doc.save();
}

// Made fresh for each download and never stored
export async function deckPdf(deck: Deck, origin: string, access: Record<string, string> = {}) {
  return { data: await render(origin, deck.id, access), filename: pdfFilename(deck) };
}

// What lets the request through Vercel's deployment protection (previews sit behind a login),
// so headless Chromium sees the print page and not the login screen
export function accessHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const cookie = req.headers.get('cookie');
  const bypass = req.headers.get('x-vercel-protection-bypass');
  if (cookie) out.cookie = cookie;
  if (bypass) out['x-vercel-protection-bypass'] = bypass;
  return out;
}
