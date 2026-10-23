'use client';

import { useEffect, useRef } from 'react';
import { startServices } from './bench';
import './services.css';

// The skeleton; bench.ts fills in the list, wheel nodes, rails, cards and figures.
export default function ServicesBench() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => startServices(root.current!), []);

  return (
    <div className="svc" ref={root}>
      <section className="bench" id="svc-bench" aria-labelledby="svc-bench-h">
        <h2 className="bench-h" id="svc-bench-h">Services</h2>

        <div className="bench-ctl">
          <ul className="tasks" id="svc-tasks" />
        </div>

        <div className="bench-fig">
          <svg className="fig-svg" viewBox="0 0 640 640" role="img" aria-labelledby="svc-fig-t svc-fig-d" focusable="false">
            <title id="svc-fig-t">How TALO Engine conducts a job</title>
            <desc id="svc-fig-d">A bold letter T sits at the centre, marking your judgement. A bronze ring labelled TALO surrounds it. Four AI agents and four digital tools sit around the ring. The ones TALO calls for the chosen job are lit.</desc>
            <g className="guides" id="svc-guides" />
            <circle className="orbit" cx="320" cy="320" r="205" />
            <circle className="ring" id="svc-ring" cx="320" cy="320" r="122" pathLength={1} transform="rotate(-90 320 320)" />
            <circle className="ring-in" cx="320" cy="320" r="110" />
            <g className="core">
              <circle className="disc" cx="320" cy="320" r="64" />
              <path className="core-mark" d="M46 22H70V40H91V56H70V91H91V108H60C52 108 46 101 46 92V56H36V40H46Z" transform="translate(320 320) scale(.93) translate(-63.5 -65)" />
            </g>
            <g className="badge">
              <rect x="343" y="198" width="48" height="22" rx="3" />
              <text x="367" y="209">TALO</text>
            </g>
            <g id="svc-nodes" />
          </svg>
          <p className="legend">Circle: AI agent. Square: digital tool. Bronze ring: TALO.</p>
        </div>

        <Run kind="selected" />
        <Run kind="pinned" />
      </section>
    </div>
  );
}

// A step-by-step run: one follows the selected service, one (pinned) always shows below
function Run({ kind }: { kind: 'selected' | 'pinned' }) {
  return (
    <div className={`run run--${kind}`} data-run={kind} hidden>
      <div className="run-top">
        <h3 className="run-h" />
        <a className="btn run-dl" download hidden />
      </div>
      <div className="rail" />
      <span className="leader" aria-hidden="true" />
      <div className="card">
        <figure className="c-fig" aria-hidden="true"><svg className="kit" xmlns="http://www.w3.org/2000/svg" /></figure>
        <div className="c-head" />
        <div className="c-main" />
        <div className="c-nav">
          <button className="btn run-back" type="button">Back</button>
          <div className="ruler" aria-hidden="true" />
          <button className="btn btn--solid run-next" type="button">Next</button>
        </div>
      </div>
      <p className="sr-only run-announce" aria-live="polite" />
    </div>
  );
}
