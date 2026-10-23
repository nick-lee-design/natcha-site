'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlocks } from '../../canvas/ModeProvider';
import { TextBlocks } from '../../blocks/Text';
import type { TemplateProps } from '../types';

export function TextOnly({ slide }: TemplateProps) {
  const body = useBlocks('body');
  const two = slide.variant === 'two-columns';
  return (
    <ContentFrame>
      <div className="absolute" style={box(84, 64, 1432)}>
        <TextBlocks slot="title" roles={{ title: 'd-title', subtitle: 'd-lead' }} />
      </div>
      {slide.hideText ? null : (
        <Fit style={{ ...box(84, 170, two ? 1432 : 900, 640), columnCount: two ? 2 : 1, columnGap: 80 }} watch={body}>
          <TextBlocks slot="body" />
        </Fit>
      )}
    </ContentFrame>
  );
}
