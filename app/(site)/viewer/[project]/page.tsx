import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import { cookieName, unlocked } from '@/lib/viewer-access';
import { PROJECTS } from '@/lib/viewer-projects';
import '@/styles/beta.css';

export async function generateMetadata({ params }: PageProps<'/viewer/[project]'>): Promise<Metadata> {
  const { project } = await params;
  const p = PROJECTS.find((x) => x.id === project);
  return { title: `${p?.name ?? 'Viewer'} · TALO Viewer`, robots: { index: false, follow: false } };
}

// The viewer is a standalone page, framed under the site header and pointed at the project's package.
// Until the project's password is given, the page asks for it instead.
export default async function ProjectViewer({ params, searchParams }: PageProps<'/viewer/[project]'>) {
  const { project } = await params;
  const p = PROJECTS.find((x) => x.id === project);
  if (!p) notFound();

  if (!unlocked(p, (await cookies()).get(cookieName(p))?.value)) {
    const { wrong } = await searchParams;
    return (
      <div className="beta beta-index">
        <Header solid />
        <main className="beta-wrap unlock">
          <span className="project-name">{p.name}</span>
          <h1>{p.title}</h1>
          <form action="/api/viewer/unlock" method="post">
            <input type="hidden" name="project" value={p.id} />
            <label>
              <span>Password</span>
              <input name="password" type="password" required autoFocus autoComplete="current-password" />
            </label>
            {wrong ? <p className="unlock-wrong">That password didn’t match.</p> : null}
            <button className="btn-p">Open</button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="experiment">
      <Header solid />
      <iframe className="experiment-frame" src={`/experiments/ncw-corridor.html?package=${p.package}`} title={`${p.title}, model viewer`} />
    </div>
  );
}
