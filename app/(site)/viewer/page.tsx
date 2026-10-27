import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import { PROJECTS } from '@/lib/viewer-projects';
import '@/styles/beta.css';

export const metadata: Metadata = { title: 'TALO Viewer · TALO Engine' };

export default function Viewer() {
  return (
    <div className="beta beta-index">
      <Header solid />
      <main className="beta-wrap">
        <h1>TALO Viewer</h1>
        <ul className="projects">
          {PROJECTS.map((p) => (
            <li key={p.id}>
              <Link href={`/viewer/${p.id}`} className="project">
                <span className="project-name">{p.name}</span>
                <h2>{p.title}</h2>
                <p>{p.text}</p>
                <dl>
                  {p.stats.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>
                  ))}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
