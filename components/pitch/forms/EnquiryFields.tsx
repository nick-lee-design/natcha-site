'use client';

import { useState } from 'react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { emptyEnquiry, enquirySchema, type Enquiry } from '@/lib/pitch/enquiry';

const resolver: Resolver<Enquiry> = async (values) => {
  const result = enquirySchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };
  const errors: FieldErrors<Enquiry> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof Enquiry;
    if (!errors[key]) Object.assign(errors, { [key]: { type: issue.code, message: issue.message } });
  }
  return { values: {}, errors };
};

export type Contact = { name: string; phone: string; email: string };

export function EnquiryFields({
  deckId,
  company,
  contact,
  services,
  disabled,
}: {
  deckId: string;
  company: string;
  services: string[];
  contact?: Contact;
  disabled?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const { register, handleSubmit, formState } = useForm<Enquiry>({ resolver, defaultValues: emptyEnquiry(deckId, company) });
  const { errors } = formState;

  const submit = handleSubmit(async (values) => {
    setState('sending');
    try {
      const res = await fetch('/api/pitch/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Sorry, that didn’t send.');
      setState('sent');
    } catch (e) {
      setMessage((e as Error).message);
      setState('error');
    }
  });

  if (state === 'sent') {
    return (
      <div className="d-thanks" role="status">
        <div className="d-form-heading">Thank you</div>
        <p>{contact ? `${contact.name.split(' ')[0]} will be in touch soon.` : 'We will be in touch soon.'}</p>
        {contact ? (
          <p>
            <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
            <br />
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        ) : null}
      </div>
    );
  }

  const field = (name: keyof Enquiry, label: string, type = 'text', wide = false, required = false) => (
    <label className={`d-field${wide ? ' is-wide' : ''}`}>
      <span>
        {label}
        {required ? <abbr title="required"> *</abbr> : null}
      </span>
      <input type={type} aria-invalid={errors[name] ? true : undefined} {...register(name)} />
      {errors[name] ? <em className="d-field-error">{errors[name]?.message}</em> : null}
    </label>
  );

  return (
    <form className="d-form" onSubmit={submit} noValidate>
      <fieldset disabled={disabled || state === 'sending'} className="contents">
        {field('name', 'Full name', 'text', false, true)}
        {field('position', 'Position / job title')}
        {field('company', 'Company', 'text', false, true)}
        {field('phone', 'Phone', 'tel')}
        {field('email', 'Email', 'email', false, true)}
        {field('source', 'How did you hear about us?')}
        <fieldset className="d-field is-wide">
          <legend>Services of interest</legend>
          <div className="d-checks">
            {services.map((s) => (
              <label key={s} className="d-check">
                <input type="checkbox" value={s} {...register('services')} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        {field('project', 'Project type / location', 'text', true)}
        {field('start', 'Preferred start date', 'date')}
        {field('duration', 'Estimated duration')}
        <label className="d-field is-wide">
          <span>Project details / message</span>
          <textarea {...register('details')} />
        </label>
        <label className="d-honeypot" aria-hidden>
          Website
          <input tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
        <div className="d-form-foot is-wide">
          {state === 'error' ? <span className="d-form-error" role="alert">{message}</span> : null}
          <button type="submit" className="d-button">
            {state === 'sending' ? 'Sending…' : 'Send enquiry'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
