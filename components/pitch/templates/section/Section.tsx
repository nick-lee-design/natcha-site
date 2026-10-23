'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlock, useBlocks } from '../../canvas/ModeProvider';
import { Picture } from '../../blocks/Picture';
import { TextBlocks } from '../../blocks/Text';
import type { TemplateProps } from '../types';

export function Section({ slide }: TemplateProps) {
  const image = slide.variant === 'image';
  const media = useBlock('media', 'image');
  const title = useBlocks('title');
  return (
    <ContentFrame wordmarkTone={image ? 'light' : 'dark'}>
      {image && media ? (
        <Picture block={{ ...media, fit: 'cover' }} area={{ x: 800, y: 36, w: 764, h: 828 }} fallback={{ style: 'wipe', direction: 'left' }} />
      ) : null}
      {slide.hideText ? null : (
        <Fit className="flex flex-col justify-center" style={box(84, 120, image ? 652 : 1200, 620)} watch={title}>
          <TextBlocks slot="title" roles={{ title: 'd-section-title', subtitle: 'd-cover-sub' }} />
        </Fit>
      )}
    </ContentFrame>
  );
}
