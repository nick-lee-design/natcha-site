import Image from 'next/image';

export default function Header() {
  return (
    <header className="wrap site-header">
      <a className="brand" href="#top" aria-label="TALO Engine, home">
        <Image src="/logo.png" width={40} height={40} alt="" priority />
        TALO Engine
      </a>
      <div className="header-right">
        <ul className="nav-links">
          <li><a href="#manifesto">Manifesto</a></li>
          <li><a href="#name">Why TALO</a></li>
          <li><a href="#work">Case studies</a></li>
          <li><a href="#people">People</a></li>
        </ul>
        <a className="btn" href="#contact">Get in touch</a>
      </div>
    </header>
  );
}
