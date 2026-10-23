'use client';

import { useState, type PointerEvent } from 'react';
import type { BlockOf } from '@/lib/pitch/schema';
import { Build } from '../../canvas/Build';
import { useEdit } from '../../canvas/EditContext';
import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlock, useBlocks, useMode } from '../../canvas/ModeProvider';
import { Picture } from '../../blocks/Picture';
import { TextBlocks } from '../../blocks/Text';
import { SlideTitle, SlotLabel } from '../shared';
import type { TemplateProps } from '../types';

const PLAN = { x: 150, y: 128, w: 140, h: 404 };
const VIEW = { x: 720, y: 104, w: 796, h: 364 };
const SECTION = { x: 720, y: 532, w: 796, h: 296 };

const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100;

// In the editor, markers drag over their drawing; positions are stored as percentages
function useMarkerDrag(keyList?: BlockOf<'key-list'>) {
  const edit = useEdit();
  const { mode } = useMode();
  if (mode !== 'edit' || !edit || !keyList) return undefined;
  return (markerId: string) => (e: PointerEvent<HTMLElement>) => {
    const holder = e.currentTarget.closest('[data-unit]') as HTMLElement | null;
    const drawing = holder?.parentElement;
    if (!holder || !drawing) return;
    e.preventDefault();
    e.stopPropagation();
    edit.select(keyList.id);
    const rect = drawing.getBoundingClientRect();
    const at = (ev: globalThis.PointerEvent) => ({ x: clamp(((ev.clientX - rect.left) / rect.width) * 100), y: clamp(((ev.clientY - rect.top) / rect.height) * 100) });
    let last: { x: number; y: number } | null = null;
    const move = (ev: globalThis.PointerEvent) => {
      last = at(ev);
      holder.style.left = `${last.x}%`;
      holder.style.top = `${last.y}%`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const pos = last;
      if (pos)
        edit.updateBlock(keyList.id, (b) => {
          if (b.type === 'key-list') b.markers = b.markers.map((m) => (m.id === markerId ? { ...m, ...pos } : m));
        });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
}

function Markers({ keyList, view, active }: { keyList?: BlockOf<'key-list'>; view: string; active: string | null }) {
  const drag = useMarkerDrag(keyList);
  if (!keyList) return null;
  const order = (items: string[]) => Math.max(0, keyList.items.findIndex((i) => i.id === items[0]));
  return (
    <>
      {keyList.markers
        .filter((m) => m.view === view)
        .map((m) => (
          <Build
            key={m.id}
            unit={`${keyList.id}/${m.id}`}
            motion={keyList.motion}
            fallback={{ style: 'pop', stagger: 'tight' }}
            // Each marker arrives with its key item
            order={view === 'plan' ? order(m.items) : undefined}
            className="absolute"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            <span
              className={`d-marker${active && m.items.includes(active) ? ' is-active' : ''}${drag ? ' is-draggable' : ''}`}
              onPointerDown={drag?.(m.id)}
            >
              {m.label}
            </span>
          </Build>
        ))}
    </>
  );
}

export function MultiViewCaseStudy({ slide }: TemplateProps) {
  const { mode } = useMode();
  const plan = useBlock('plan', 'image');
  const view = useBlock('view', 'image');
  const section = useBlock('section', 'image');
  const keyList = useBlock('key', 'key-list');
  const text = useBlocks('text');
  // Hovering a key item highlights its markers on both drawings
  const [active, setActive] = useState<string | null>(null);
  const hover = mode === 'print' ? () => {} : setActive;

  return (
    <ContentFrame>
      <SlideTitle width={620} />

      {plan ? (
        <Picture block={plan} area={PLAN} align={[0, 0]}>
          <Markers keyList={keyList} view="plan" active={active} />
        </Picture>
      ) : null}
      <SlotLabel slot="plan-label" x={PLAN.x} y={PLAN.y + PLAN.h + 14} />

      {keyList ? (
        <div className="d-key absolute" style={box(330, 146, 370)}>
          <Build unit={`${keyList.id}/${keyList.items[0]?.id}`} badge={false} className="d-key-heading" motion={keyList.motion}>
            {keyList.heading}
          </Build>
          {keyList.items.map((item, i) => (
            <Build
              key={item.id}
              unit={`${keyList.id}/${item.id}`}
              motion={keyList.motion}
              fallback={{ style: 'gentle', stagger: 'tight' }}
              order={i}
              className={`d-key-item${active === item.id ? ' is-active' : ''}`}
              onMouseEnter={() => hover(item.id)}
              onMouseLeave={() => hover(null)}
            >
              <span>{item.number}.</span>
              {item.content}
            </Build>
          ))}
        </div>
      ) : null}

      <SlotLabel slot="view-label" x={VIEW.x} y={62} />
      {view ? <Picture block={view} area={VIEW} align={[0, 0]} /> : null}

      <SlotLabel slot="section-label" x={SECTION.x} y={SECTION.y - 44} />
      {section ? (
        <Picture block={section} area={SECTION} align={[0, 0]}>
          <Markers keyList={keyList} view="section" active={active} />
        </Picture>
      ) : null}

      {slide.hideText ? null : (
        <Fit style={box(84, 610, 590, 218)} watch={text}>
          <TextBlocks slot="text" roles={{ paragraph: 'd-note' }} />
        </Fit>
      )}
    </ContentFrame>
  );
}
