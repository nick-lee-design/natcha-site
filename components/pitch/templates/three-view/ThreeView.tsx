'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlock, useBlocks } from '../../canvas/ModeProvider';
import { Picture } from '../../blocks/Picture';
import { TextBlocks } from '../../blocks/Text';
import { SlideTitle, SlotLabel } from '../shared';
import type { TemplateProps } from '../types';

const LABEL_Y = 664;

export function ThreeView({ slide }: TemplateProps) {
  const two = slide.variant === 'two';
  const v1 = useBlock('view-1', 'image');
  const v2 = useBlock('view-2', 'image');
  const v3 = useBlock('view-3', 'image');
  const text = useBlocks('text');

  const a1 = { x: 84, y: 136, w: 480, h: 480 };
  const a2 = { x: 700, y: 112, w: 360, h: 534 };
  const a3 = two ? { x: 880, y: 112, w: 560, h: 534 } : { x: 1120, y: 112, w: 396, h: 534 };

  return (
    <ContentFrame>
      <SlideTitle />
      {/* Line work reveals as if drawn; true stroke drawing needs vector originals */}
      {v1 ? <Picture block={v1} area={a1} align={[0, 0]} fallback={{ style: 'wipe', direction: 'right' }} /> : null}
      <SlotLabel slot="view-1-label" x={a1.x + 20} y={a1.y + a1.h + 18} />

      {two ? null : (
        <>
          {v2 ? <Picture block={v2} area={a2} align={[0, 1]} /> : null}
          <SlotLabel slot="view-2-label" x={a2.x} y={LABEL_Y} />
        </>
      )}

      {v3 ? <Picture block={v3} area={a3} align={[0, 1]} /> : null}
      <SlotLabel slot="view-3-label" x={a3.x} y={LABEL_Y} />

      {slide.hideText ? null : (
        <Fit style={box(84, 716, 600, 112)} watch={text}>
          <TextBlocks slot="text" roles={{ paragraph: 'd-note' }} />
        </Fit>
      )}
    </ContentFrame>
  );
}
