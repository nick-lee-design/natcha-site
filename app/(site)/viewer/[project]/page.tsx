import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import { PROJECTS } from '@/lib/viewer-projects';

export const dynamicParams = false;

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ project: p.id }));
}

export async function generateMetadata({ params }: PageProps<'/viewer/[project]'>): Promise<Metadata> {
  const { project } = await params;
  const p = PROJECTS.find((x) => x.id === project);
  return { title: `${p?.name ?? 'Viewer'} · TALO Viewer` };
}

// The viewer is a standalone page, framed under the site header and pointed at the project's package
export default async function ProjectViewer({ params }: PageProps<'/viewer/[project]'>) {
  const { project } = await params;
  const p = PROJECTS.find((x) => x.id === project);
  if (!p) notFound();
  return (
    <div className="experiment">
      <Header solid />
      <iframe className="experiment-frame" src={`/experiments/ncw-corridor.html?package=${p.package}`} title={`${p.title}, model viewer`} />
    </div>
  );
}
