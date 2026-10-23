'use client';

import { Build } from '../../canvas/Build';
import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlock, useBlocks } from '../../canvas/ModeProvider';
import { TextBlocks } from '../../blocks/Text';
import { SlideTitle } from '../shared';
import type { TemplateProps } from '../types';
import { GRID_SIZES } from './def';

const SIZE = 690;
const TOP = 132;
const LEFT = 800 - SIZE / 2;

export function AssetGrid({ slide }: TemplateProps) {
  const grid = useBlock('grid', 'image-grid');
  const caption = useBlocks('caption');
  const n = GRID_SIZES[slide.variant ?? '5x5'] ?? 5;
  const cell = SIZE / n;

  return (
    <ContentFrame>
      <SlideTitle />
      {grid ? (
        <div className="absolute" style={box(LEFT, TOP, SIZE, SIZE)}>
          {grid.items.slice(0, n * n).map((item, i) => {
            const row = Math.floor(i / n);
            const col = i % n;
            return (
              // Cells cascade diagonally: the delay follows row + column
              <Build
                key={item.id}
                unit={`${grid.id}/${item.id}`}
                motion={grid.motion}
                fallback={{ style: 'wipe', direction: 'right', stagger: 'tight' }}
                order={row + col}
                className="d-grid-cell"
                style={box(col * cell, row * cell, cell + 1.5, cell + 1.5)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.alt} draggable={false} />
              </Build>
            );
          })}
        </div>
      ) : null}
      {slide.hideText ? null : (
        <Fit className="flex flex-col justify-end" style={box(84, TOP + SIZE - 200, LEFT - 84 - 40, 200)} watch={caption}>
          <TextBlocks slot="caption" roles={{ caption: 'd-caption', paragraph: 'd-caption' }} />
        </Fit>
      )}
    </ContentFrame>
  );
}
