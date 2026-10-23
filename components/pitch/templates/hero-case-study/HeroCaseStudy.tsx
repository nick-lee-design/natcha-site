'use client';

import { Build } from '../../canvas/Build';
import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlock, useBlocks } from '../../canvas/ModeProvider';
import { TextBlocks } from '../../blocks/Text';
import { SlideTitle, SlotLabel } from '../shared';
import type { TemplateProps } from '../types';

export function HeroCaseStudy({ slide }: TemplateProps) {
  const media = useBlock('media', 'image');
  const text = useBlocks('text');
  const side = slide.variant === 'side-text';
  const panel = side ? { x: 84, y: 124, w: 1000, h: 700 } : { x: 84, y: 120, w: 1432, h: 572 };

  return (
    <ContentFrame>
      <SlideTitle />
      {media ? (
        // The whole black panel reveals, so the image never floats on white mid-build
        <Build
          unit={media.id}
          motion={media.motion}
          fallback={{ style: 'wipe', direction: 'right' }}
          className="absolute bg-black"
          style={box(panel.x, panel.y, panel.w, panel.h)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.src} alt={media.alt} className="size-full object-contain" draggable={false} />
        </Build>
      ) : null}
      {slide.hideText ? null : side ? (
        <Fit style={box(1124, 124, 392, 700)} watch={text}>
          <TextBlocks slot="view" />
          <TextBlocks slot="heading" roles={{ subtitle: 'd-case-title d-gap-label' }} />
          <TextBlocks slot="text" roles={{ paragraph: 'd-note' }} />
        </Fit>
      ) : (
        <>
          <SlotLabel slot="view" x={84} y={712} width={150} />
          <Fit style={box(256, 710, 1260, 120)} watch={text}>
            <TextBlocks slot="heading" roles={{ subtitle: 'd-case-title' }} />
            <TextBlocks slot="text" roles={{ paragraph: 'd-note' }} />
          </Fit>
        </>
      )}
    </ContentFrame>
  );
}
