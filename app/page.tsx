import Header from '@/components/Header';
import KineticHero from '@/components/hero/KineticHero';
import Hero from '@/components/Hero';
import Manifesto from '@/components/Manifesto';
import WhyTalo from '@/components/WhyTalo';
import CaseStudies from '@/components/CaseStudies';
import People from '@/components/People';
import Contact from '@/components/Contact';
import Faq from '@/components/Faq';
import Terms from '@/components/Terms';
import Legal from '@/components/Legal';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <KineticHero />
        <Hero />
        <Manifesto />
        <WhyTalo />
        <CaseStudies />
        <People />
        <Contact />
        <Faq />
        <Terms />
        <Legal />
      </main>
      <Footer />
    </>
  );
}
