import type { Metadata } from 'next';
import Header from '@/components/Header';

export const metadata: Metadata = { title: 'Experiments · TALO Engine' };

// The experiment is a standalone page, framed under the site header
export default function Experiments() {
  return (
    <div className="experiment">
      <Header solid />
      <iframe className="experiment-frame" src="/experiments/ncw-corridor.html" title="NCW coordinated corridor, model viewer" />
    </div>
  );
}
