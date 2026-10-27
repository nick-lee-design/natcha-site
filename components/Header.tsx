'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// `solid` for pages without the hero: an opaque bar in the page flow, pinned to the top
export default function Header({ solid = false }: { solid?: boolean }) {
  // Pinned to the top; picks up a backdrop once the page scrolls under it
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header dark${solid ? ' is-solid' : scrolled ? ' is-scrolled' : ''}`}>
      <div className="wrap site-header-inner">
        <div className="header-left">
          <a className="brand" href="/#top" aria-label="TALO Engine, home">
            <Image src="/logo.png" width={40} height={40} alt="" priority />
            TALO Engine
          </a>
          <Link className="pill" href="/viewer">TALO Viewer</Link>
          <Link className="pill" href="/pitch">Pitch</Link>
          <Link className="pill" href="/beta">Beta</Link>
        </div>
        <div className="header-right">
          <ul className="nav-links">
            <li><a href="/#manifesto">Manifesto</a></li>
            <li><a href="/#name">Why TALO</a></li>
            <li><a href="/#work">Case studies</a></li>
            <li><a href="/#people">People</a></li>
          </ul>
          <a className="btn" href="/#contact">Get in touch</a>
        </div>
      </div>
    </header>
  );
}
