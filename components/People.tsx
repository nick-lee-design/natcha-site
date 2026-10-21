import Image from 'next/image';

const glance = [
  ['Background', 'Engineering and BIM'],
  ['Experience', 'UK and international, 10+ years'],
  ['Sector', 'Residential, Commercial, Education, Government'],
  ['Expertise', 'Complex design coordination at construction phase'],
  ['Engagement', 'Direct, bringing BIM management expertise to your project'],
];

export default function People() {
  return (
    <section className="section" id="people" aria-labelledby="people-title">
      <div className="wrap founder">
        <div className="founder-id">
          <h2 className="h2" id="people-title">People</h2>
          <Image
            className="founder-photo"
            src="/images/natcha-kucita.jpg"
            alt="Portrait of Natcha Kucita"
            width={900}
            height={1125}
            sizes="(max-width: 900px) 340px, 460px"
          />
        </div>
        <div className="founder-body">
          <p className="founder-role">Founder and Engineer</p>
          <h3 className="person-name">Natcha Kucita <span className="person-qual">MEng</span></h3>
          <p>Natcha has led complex MEP design coordination at construction phase for over a decade. Clients work with her directly on implementation, model coordination and deliverables.</p>
          <dl className="glance">
            {glance.map(([term, value]) => (
              <div key={term}><dt>{term}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <div className="founder-actions">
            <a className="btn" href="/files/Natcha-Kucita-CV.pdf" download>Download CV</a>
          </div>
        </div>
      </div>
    </section>
  );
}
