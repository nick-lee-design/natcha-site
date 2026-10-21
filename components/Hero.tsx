import Image from 'next/image';
import ServicesBench from './services/ServicesBench';

// The headline and intro copy now live in the kinetic hero above.
export default function Hero() {
  return (
    <section className="hero" id="intro" aria-label="Services">
      <div className="hero-render-frame">
        <Image
          className="hero-render"
          src="/images/hero-plant-room.jpg"
          alt="Isometric render of an MEP plant room, showing chillers, tanks and pipework coordinated in the model"
          fill
          sizes="100vw"
        />
      </div>

      <div className="wrap">
        <ServicesBench />
      </div>
    </section>
  );
}
