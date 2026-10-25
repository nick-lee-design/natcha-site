import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import '@/styles/beta.css';

export const metadata: Metadata = { title: 'Beta · TALO Engine' };

// Features still being explored. Each entry is a working prototype.
const FEATURES = [
  {
    href: '/beta/building-manager',
    title: 'Building manager',
    text: 'The coordination model, read by the people who run the building.',
    parts: [
      { approach: 'situations', name: 'Situations', text: 'Start from what is happening' },
      { approach: 'systems', name: 'Systems', text: 'Follow what is connected' },
      { approach: 'timeline', name: 'Timeline', text: 'See how it got here and what changes next' },
    ],
  },
];

export default function Beta() {
  return (
    <div className="beta beta-index">
      <Header solid />
      <main className="beta-wrap">
        <h1>Beta</h1>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.href} className="feature">
              <Link href={f.href} className="feature-head">
                <h2>{f.title}</h2>
                <p>{f.text}</p>
              </Link>
              <ol className="feature-parts">
                {f.parts.map((p, k) => (
                  <li key={p.approach}>
                    <Link href={`${f.href}?approach=${p.approach}`}>
                      <span className="mono">{k + 1}</span>
                      <span><strong>{p.name}</strong>{p.text}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
