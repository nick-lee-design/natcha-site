'use client';

import { useState, type FormEvent } from 'react';

// FormSubmit forwards each enquiry to Natcha's inbox; the "email" field becomes the reply-to.
const ENDPOINT = 'https://formsubmit.co/ajax/natcha@taloengine.com';

export default function ContactForm() {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const field = (name: string) => String(new FormData(form).get(name) ?? '').trim();
    const name = field('name');
    const surname = field('surname');
    const email = field('email');
    const company = field('company');
    const enquiry = field('enquiry');

    if (!name || !surname || !email || !enquiry) {
      setNote('Please fill in your name, surname, email and enquiry.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNote('Please enter a valid email address.');
      return;
    }

    setSending(true);
    setNote('Sending…');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Enquiry from ${name} ${surname}`,
          _template: 'table',
          _honey: field('_honey'),
          name,
          surname,
          email,
          company: company || '—',
          enquiry,
        }),
      });
      const data = await res.json();
      if (!res.ok || String(data.success) !== 'true') throw new Error(data.message);
      form.reset();
      setNote('Thanks, your enquiry has been sent.');
    } catch {
      setNote('Sorry, that didn’t send. Please email natcha@taloengine.com.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="contact-form" id="contact-form" noValidate onSubmit={onSubmit}>
      <div className="cf-row">
        <label htmlFor="cf-name">Name</label>
        <input type="text" id="cf-name" name="name" autoComplete="given-name" required />
      </div>
      <div className="cf-row">
        <label htmlFor="cf-surname">Surname</label>
        <input type="text" id="cf-surname" name="surname" autoComplete="family-name" required />
      </div>
      <div className="cf-row">
        <label htmlFor="cf-company">Company</label>
        <input type="text" id="cf-company" name="company" autoComplete="organization" />
      </div>
      <div className="cf-row">
        <label htmlFor="cf-email">Email</label>
        <input type="email" id="cf-email" name="email" autoComplete="email" required />
      </div>
      <input type="text" name="_honey" className="cf-honey" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="cf-row cf-row--full">
        <label htmlFor="cf-enquiry">Enquiries</label>
        <textarea id="cf-enquiry" name="enquiry" rows={5} required />
      </div>
      <div className="cf-row cf-row--full cf-submit">
        <button type="submit" className="btn" disabled={sending}>Send enquiry</button>
        <p className="cf-note" aria-live="polite">{note}</p>
      </div>
    </form>
  );
}
