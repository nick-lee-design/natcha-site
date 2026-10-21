import ContactForm from './ContactForm';

export default function Contact() {
  return (
    <section className="section band" id="contact" aria-labelledby="contact-title">
      <div className="wrap">
        <h2 className="h-xl" id="contact-title">Orchestrating the future of building services.</h2>
        <p>Tell Natcha about your project, and get direct advice on implementation, model coordination and deliverables.</p>
        <div className="actions">
          <a className="btn" href="mailto:natcha@taloengine.com?subject=Talking%20to%20TALO%20Engine">Talk to TALO Engine</a>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
