'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { Fit } from '../../canvas/Fit';
import { box } from '../../canvas/geometry';
import { useBlocks } from '../../canvas/ModeProvider';
import { PricingTable } from '../../blocks/PricingTable';
import { TextBlock, TextBlocks } from '../../blocks/Text';
import type { TemplateProps } from '../types';

const WIDTH = 1432;

function TableSlot({ slot }: { slot: string }) {
  const blocks = useBlocks(slot);
  return (
    <>
      {blocks.map((b) =>
        b.type === 'table' ? (
          <PricingTable key={b.id} block={b} width={WIDTH} />
        ) : 'content' in b ? (
          <TextBlock key={b.id} block={b} className="d-table-caption" />
        ) : null,
      )}
    </>
  );
}

export function Pricing({ slide }: TemplateProps) {
  const all = Object.values(slide.slots);
  return (
    <ContentFrame>
      <Fit style={box(84, 64, WIDTH, 772)} watch={all} floor={0.8}>
        <TextBlocks slot="title" roles={{ subtitle: 'd-pricing-sub' }} />
        {slide.variant === 'packages' ? null : <TableSlot slot="stages" />}
        <TableSlot slot="packages" />
        <TextBlocks slot="footnote" roles={{ caption: 'd-footnote' }} />
      </Fit>
    </ContentFrame>
  );
}
