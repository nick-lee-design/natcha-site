import Header from '@/components/Header';
import '@/styles/theme.css';
import '@/styles/site-header.css';

// The deck list keeps the site's nav. Present, share, print and the editor stay full screen.
export default function PitchNavLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header solid />
      {children}
    </>
  );
}
