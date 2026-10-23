'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { useBlock } from '../../canvas/ModeProvider';
import { Picture } from '../../blocks/Picture';
import { TextBlocks } from '../../blocks/Text';
import type { TemplateProps } from '../types';

export function VisualOnly({ slide }: TemplateProps) {
  const media = useBlock('media', 'image');
  const framed = slide.variant === 'framed';
  const image = media ? (
    <Picture
      block={{ ...media, fit: framed ? 'contain' : 'cover' }}
      area={framed ? { x: 84, y: 84, w: 1432, h: 680 } : { x: 0, y: 0, w: 1600, h: 900 }}
      fallback={{ style: 'wipe', direction: 'right' }}
    />
  ) : null;
  const caption = slide.hideText ? null : (
    <div className={`absolute ${framed ? '' : 'd-caption-on-image'}`} style={{ left: 84, bottom: framed ? 70 : 60, width: 900 }}>
      <TextBlocks slot="caption" roles={{ caption: 'd-caption' }} />
    </div>
  );
  return framed ? (
    <ContentFrame>
      {image}
      {caption}
    </ContentFrame>
  ) : (
    <>
      {image}
      {caption}
    </>
  );
}
