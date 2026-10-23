'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlock, useBlocks } from '../../canvas/ModeProvider';
import { Picture } from '../../blocks/Picture';
import { TextBlocks } from '../../blocks/Text';
import type { TemplateProps } from '../types';

const F = 36;
const MID = 800;

export function SplitImage({ slide }: TemplateProps) {
  const variant = slide.variant ?? 'image-right';
  const visualOnly = variant === 'visual-only' || slide.hideText;
  const left = variant === 'image-left';
  const media = useBlock('media', 'image');
  const text = useBlocks('text');

  const area = visualOnly
    ? { x: F, y: F, w: 1600 - 2 * F, h: 900 - 2 * F }
    : left
      ? { x: F, y: F, w: MID - F, h: 900 - 2 * F }
      : { x: MID, y: F, w: 1600 - F - MID, h: 900 - 2 * F };

  return (
    <ContentFrame numberTone={visualOnly || left ? 'light' : 'dark'} wordmarkTone={visualOnly || !left ? 'light' : 'dark'}>
      {media ? (
        <Picture block={{ ...media, fit: 'cover' }} area={area} fallback={{ style: 'wipe', direction: left ? 'right' : 'left' }} />
      ) : null}
      {visualOnly ? null : (
        <Fit style={box(left ? MID + 68 : 84, 64, 652, 760)} watch={text}>
          <TextBlocks slot="text" roles={{ title: 'd-title d-gap-title' }} />
        </Fit>
      )}
    </ContentFrame>
  );
}
