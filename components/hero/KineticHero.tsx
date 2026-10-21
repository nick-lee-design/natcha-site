'use client';

import { useEffect, useRef } from 'react';
import styles from './KineticHero.module.css';

export default function KineticHero() {
  const frame = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const spark = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const cross = useRef<HTMLDivElement>(null);
  const fail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    // Three.js and GSAP load in their own chunk, after the page itself.
    import('./scene').then(({ startKineticHero }) => {
      if (cancelled) return;
      dispose = startKineticHero({
        frame: frame.current!,
        stage: stage.current!,
        canvas: canvas.current!,
        spark: spark.current!,
        scrim: scrim.current!,
        markTexts: [...mark.current!.querySelectorAll('text')],
        steps: [...copy.current!.children].map(step => [...step.querySelectorAll<HTMLElement>('p, h1')]),
        cursor: cursor.current!,
        ring: ring.current!,
        cross: cross.current!,
        fail: fail.current!,
        // Set on <html> by the layout's next/font class
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-outfit').trim() || 'Outfit',
      });
    });
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return (
    <section className={styles.frame} ref={frame} id="top" aria-labelledby="hero-title">
      <div className={styles.stage} ref={stage}>
        <canvas ref={canvas} role="img" aria-label="Outline drawing of a ceiling services assembly with ducts, pipes, cable trays and hangers that assembles, explodes and lays itself out by trade as you scroll" />
        <div className={styles.spark} ref={spark} />
        <div className={styles.scrim} ref={scrim} />

        <div className={styles.copy} ref={copy}>
          <div>
            <svg className={styles.mark} ref={mark} viewBox="0 0 500 250" aria-hidden="true">
              <defs>
                <filter id="hero-blur" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="9" /></filter>
              </defs>
              <text className={styles.glow} x="14" y="214" filter="url(#hero-blur)">talo</text>
              <text className={styles.core} x="14" y="214">talo</text>
            </svg>
            <p className={styles.line}>Expertise, amplified.</p>
          </div>
          <div>
            <h1 className={styles.headline} id="hero-title">Specialised BIM services for MEP engineering.</h1>
          </div>
          <div>
            <p className={styles.para}>TALO Engine designs workflow that utilises advanced AI and automation tools to work for you — so implementation, model coordination and deliverables move at machine speed, with a decade of expert judgement at every step.</p>
          </div>
        </div>

        <div className={styles.cursor} ref={cursor} aria-hidden="true">
          <div className={styles.ring} ref={ring} />
          <div className={styles.cross} ref={cross} />
        </div>
        <div className={`${styles.fail} ${styles.mono}`} ref={fail}>This piece needs WebGL. Try a current desktop browser.</div>
      </div>
    </section>
  );
}
