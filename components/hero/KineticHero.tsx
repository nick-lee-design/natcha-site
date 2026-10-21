'use client';

import { useEffect, useRef } from 'react';
import { outfit } from '@/app/fonts';
import styles from './KineticHero.module.css';

export default function KineticHero() {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const spark = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const tag = useRef<HTMLDivElement>(null);
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
        stage: stage.current!,
        canvas: canvas.current!,
        spark: spark.current!,
        markTexts: [...mark.current!.querySelectorAll('text')],
        tagLines: [...tag.current!.querySelectorAll('p')],
        cursor: cursor.current!,
        ring: ring.current!,
        cross: cross.current!,
        fail: fail.current!,
        fontFamily: outfit.style.fontFamily,
      });
    });
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return (
    <section className={styles.frame} id="top" aria-label="TALO Engine">
      <div className={styles.stage} ref={stage} tabIndex={0}>
        <canvas ref={canvas} role="img" aria-label="Outline drawing of a ceiling services assembly with ducts, pipes, cable trays and hangers that can be pulled apart and rebuilt" />
        <div className={styles.spark} ref={spark} />

        <svg className={styles.mark} ref={mark} viewBox="0 0 1920 1080" aria-hidden="true">
          <defs>
            <filter id="hero-blur" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="9" /></filter>
          </defs>
          <text className={styles.glow} x="118" y="660" filter="url(#hero-blur)">talo</text>
          <text className={styles.core} x="118" y="660">talo</text>
        </svg>

        <div className={styles.tag} ref={tag}>
          <p className={styles.line}>Expertise, amplified.</p>
          <p className={styles.body}>TALO combines the judgement of an experienced MEP engineer with the capabilities of AI and automation.</p>
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
