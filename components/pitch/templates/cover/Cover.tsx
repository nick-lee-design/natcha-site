'use client';

import { Build } from '../../canvas/Build';
import { useBlock } from '../../canvas/ModeProvider';
import { LivingAssembly } from '../../assembly/LivingAssembly';
import { Picture } from '../../blocks/Picture';
import { TextBlocks } from '../../blocks/Text';
import type { TemplateProps } from '../types';

export function Cover({ slide }: TemplateProps) {
  const variant = slide.variant ?? 'gradient';
  const media = useBlock('media', 'image');
  const split = variant === 'split';
  const onImage = variant === 'image' && media;
  const assembly = variant === 'assembly';
  const dark = onImage || assembly;

  return (
    <>
      {assembly ? (
        <>
          <LivingAssembly />
          <div className="d-assembly-scrim absolute inset-0" />
        </>
      ) : (
        <Build unit="@bg" fallback={{ style: 'draw' }} className="absolute inset-0" style={{ background: 'var(--deck-cover-gradient)' }} />
      )}
      {media && (variant === 'image' || split) ? (
        <Picture
          block={{ ...media, fit: 'cover' }}
          area={split ? { x: 800, y: 0, w: 800, h: 900 } : { x: 0, y: 0, w: 1600, h: 900 }}
          fallback={{ style: 'wipe', direction: 'left' }}
        />
      ) : null}
      {onImage ? <div className="d-cover-scrim absolute inset-0" /> : null}
      {slide.hideText ? null : (
        <div className={`absolute ${dark ? 'd-cover-on-image' : ''}`} style={{ left: 84, top: 396, width: split || assembly ? 680 : 1300 }}>
          <TextBlocks slot="title" roles={{ title: 'd-display' }} />
          <TextBlocks slot="subtitle" roles={{ subtitle: 'd-cover-sub' }} />
          <div className="d-cover-lines">
            <TextBlocks slot="client" roles={{ label: 'd-cover-client' }} />
            <TextBlocks slot="date" roles={{ label: 'd-cover-client' }} />
          </div>
        </div>
      )}
    </>
  );
}
