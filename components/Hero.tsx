import Image from 'next/image';
import Services from './Services';

export default function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="wrap hero-top">
        <div className="hero-text">
          <h1 id="hero-title">Specialised BIM services for MEP engineering.</h1>
          <div className="hero-sub">
            <p>TALO Engine designs workflow that utilises advanced AI and automation tools to work for you — so implementation, model coordination and deliverables move at machine speed, with a decade of expert judgement at every step.</p>
            <div className="actions">
              <a className="btn" href="#contact">Get in touch</a>
              <a className="link" href="#manifesto">Read the manifesto</a>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-render-frame">
        <Image
          className="hero-render"
          src="/images/hero-plant-room.jpg"
          alt="Isometric render of an MEP plant room, showing chillers, tanks and pipework coordinated in the model"
          fill
          sizes="100vw"
          priority
        />
      </div>

      <div className="wrap">
        <Services />
      </div>
    </section>
  );
}
