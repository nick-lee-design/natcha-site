import { notFound } from 'next/navigation';
import { StillMaker } from '@/components/pitch/assembly/StillMaker';

// Renders the living assembly's still for `npm run assembly-still`. Development only.
export default function AssemblyStillPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <StillMaker />;
}
