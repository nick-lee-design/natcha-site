import type { Enquiry } from './enquiry';
import { SITE_URL } from './site';

const TO = process.env.PITCH_ENQUIRY_TO ?? 'natcha@taloengine.com';
const FROM = process.env.PITCH_EMAIL_FROM ?? 'TALO Engine <enquiries@taloengine.com>';

const rows = (e: Enquiry): [string, string][] => [
  ['Full name', e.name],
  ['Position / job title', e.position],
  ['Company', e.company],
  ['Phone', e.phone],
  ['Email', e.email],
  ['How did you hear about us?', e.source],
  ['Services of interest', e.services.join(', ')],
  ['Project type / location', e.project],
  ['Preferred start date', e.start],
  ['Estimated duration', e.duration],
  ['Project details', e.details],
  ['Deck', e.deckId],
];

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function enquiryText(e: Enquiry) {
  return rows(e)
    .map(([k, v]) => `${k}: ${v || '–'}`)
    .join('\n');
}

function enquiryHtml(e: Enquiry) {
  const body = rows(e)
    .map(([k, v]) => `<tr><th align="left" valign="top" style="padding:4px 16px 4px 0">${escape(k)}</th><td style="padding:4px 0;white-space:pre-wrap">${escape(v || '–')}</td></tr>`)
    .join('');
  return `<table style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#2d2d2d">${body}</table>`;
}

async function resend(apiKey: string, message: Record<string, unknown>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// Sends the enquiry to Natcha and a short confirmation to the enquirer.
// Resend when RESEND_API_KEY is set; otherwise FormSubmit, which the site's contact form already uses.
export async function sendEnquiry(e: Enquiry) {
  const subject = `Enquiry from ${e.name}, ${e.company}`;
  if (process.env.PITCH_EMAIL_DRY_RUN) {
    console.info(`[pitch] dry run, not sent: ${subject}\n${enquiryText(e)}`);
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (key) {
    await resend(key, { from: FROM, to: TO, reply_to: e.email, subject, text: enquiryText(e), html: enquiryHtml(e) });
    await resend(key, {
      from: FROM,
      to: e.email,
      reply_to: TO,
      subject: 'Thanks for your enquiry',
      text: `Hi ${e.name},\n\nThanks for getting in touch with TALO Engine. Natcha will reply shortly.\n\n${SITE_URL}`,
    });
    return;
  }
  const res = await fetch(`https://formsubmit.co/ajax/${TO}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: `${SITE_URL}/pitch` },
    body: JSON.stringify({
      ...Object.fromEntries(rows(e)),
      email: e.email,
      _subject: subject,
      _template: 'table',
      _captcha: 'false',
      _autoresponse: `Thanks for getting in touch with TALO Engine. Natcha will reply shortly.`,
    }),
  });
  if (!res.ok) throw new Error(`FormSubmit ${res.status}: ${await res.text()}`);
}
