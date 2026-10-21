const faqs = [
  ['What does TALO Engine actually deliver?', 'Coordinated MEP models, clash-checked and issued to a defined standard, plus the drawings and schedules that come off them — backed by implementation advice so your team can run the same workflow after handover.'],
  ['Which software and standards do you work in?', 'Revit-based BIM to UK BS EN ISO 19650 workflows as standard, with AI-assisted automation layered on top to speed up coordination and QA. Other platforms and standards can be discussed on a project basis.'],
  ['How is a project scoped and priced?', 'Every engagement starts with a short scoping call to understand the project stage, deliverables and programme, followed by a fixed-fee or stage-based proposal — there’s no standard rate card because scope varies project to project.'],
  ['Do you work with in-house teams or as an outsourced service?', 'Both. Some clients bring TALO Engine in to run coordination end-to-end; others use it to extend an existing team’s capacity or to set up an automated workflow they then own internally.'],
  ['Where are you based, and do you work internationally?', 'TALO Engine is UK-based with international project experience, and works with clients remotely as standard.'],
];

export default function Faq() {
  return (
    <section className="section legal-section" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <h2 className="h2" id="faq-title">FAQs</h2>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details className="faq-item" key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
