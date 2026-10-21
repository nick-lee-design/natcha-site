'use client';

import { useState, type CSSProperties } from 'react';
import { services, wheelNodes } from '@/lib/services';

export default function Services() {
  const [selected, setSelected] = useState(0);
  const service = services[selected];

  return (
    <>
      <div className="bench" id="bench">
        <div className="bench-ctl">
          <h2 className="bench-h">Services</h2>
          <ul className="tasks">
            {services.map((s, i) => (
              <li key={s.label}>
                <button className="task" type="button" aria-pressed={i === selected} onClick={() => setSelected(i)}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bench-fig">
          <svg className="fig-svg" viewBox="0 0 640 640" role="img" aria-labelledby="fig-t fig-d" focusable="false">
            <title id="fig-t">How TALO Engine conducts a job</title>
            <desc id="fig-d">A bold letter T sits at the centre, marking your judgement. A bronze ring labelled TALO surrounds it. Four AI agents and four digital tools sit around the ring. The ones TALO calls for the chosen job are lit.</desc>
            <circle className="orbit" cx="320" cy="320" r="205" />
            <circle className="ring" cx="320" cy="320" r="122" />
            <circle className="ring-in" cx="320" cy="320" r="110" />
            <g className="core">
              <circle className="disc" cx="320" cy="320" r="64" />
              <path className="core-mark" d="M46 22H70V40H91V56H70V91H91V108H60C52 108 46 101 46 92V56H36V40H46Z" transform="translate(320 320) scale(.93) translate(-63.5 -65)" />
            </g>
            <g className="badge">
              <rect x="343" y="198" width="48" height="22" rx="3" />
              <text x="367" y="209">TALO</text>
            </g>

            {wheelNodes.map((n, i) => (
              <g key={n.id} className={`unit node${service.on.includes(n.id) ? ' on' : ''}`} style={{ '--i': i } as CSSProperties}>
                <line className="spoke" x1={n.spoke[0]} y1={n.spoke[1]} x2={n.spoke[2]} y2={n.spoke[3]} />
                {n.kind === 'agent' ? (
                  <>
                    <circle className="shape" cx={n.at[0]} cy={n.at[1]} r="26" />
                    <text className="glyph" x={n.at[0]} y={n.at[1]}>AI</text>
                  </>
                ) : (
                  <rect className="shape" x={n.at[0]} y={n.at[1]} width="44" height="44" rx="3" />
                )}
                <text className="node-label">
                  <tspan x={n.labelX} y={n.labelY}>{n.label[0]}</tspan>
                  <tspan x={n.labelX} y={n.labelY + 17}>{n.label[1]}</tspan>
                </text>
              </g>
            ))}
          </svg>
          <p className="legend">Circle: AI agent. Square: digital tool. Bronze ring: TALO.</p>
        </div>
      </div>

      {service.steps && (
        <div className="bench-steps" id="bench-steps">
          <h3 className="bench-steps-h">{service.stepsTitle}</h3>
          <ol className="bench-steps-list">
            {service.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          {service.downloadFile && (
            <a className="btn bench-steps-download" href={`/files/${service.downloadFile}`} download>
              {service.downloadLabel}
            </a>
          )}
        </div>
      )}
    </>
  );
}
