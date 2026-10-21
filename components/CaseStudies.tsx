import Image from 'next/image';

export default function CaseStudies() {
  return (
    <section className="section section--alt" id="work" aria-labelledby="work-title">
      <div className="wrap">
        <h2 className="h2" id="work-title">Case studies</h2>
        <ul className="case-sectors">
          <li>
            <details>
              <summary>Commercial</summary>
              <p>Refurbishment of luxury hotel (RIBA Stage 5).</p>
              <Image
                className="case-sector-image"
                src="/images/case-commercial.jpg"
                alt="A tall 1960s/70s concrete high-rise office or residential tower, photographed from street level with period cars parked in the foreground."
                width={671}
                height={994}
                sizes="320px"
              />
            </details>
          </li>
          <li>
            <details>
              <summary>Educational</summary>
              <p>Placeholder for educational project discovery. Details coming soon.</p>
            </details>
          </li>
          <li>
            <details>
              <summary>Residential</summary>
              <p>Placeholder for residential project discovery. Details coming soon.</p>
            </details>
          </li>
        </ul>
        <figure className="case-figure">
          <div className="case-frame">
            <Image
              className="case-image"
              src="/images/case-isometric.jpg"
              alt="Isometric MEP coordination drawing showing a dense, precisely routed network of pipework, valves and plant across a services zone."
              width={1738}
              height={905}
              sizes="(max-width: 1296px) 100vw, 1200px"
            />
          </div>
          <figcaption>Coordinated MEP routing, drawn out in isometric detail — the level of precision TALO Engine&rsquo;s workflow is built to sustain at scale.</figcaption>
        </figure>
      </div>
    </section>
  );
}
