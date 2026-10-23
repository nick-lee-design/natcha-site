'use client';

import { ContentFrame } from '../../canvas/ContentFrame';
import { useBlock } from '../../canvas/ModeProvider';
import { HubDiagram, HubList } from '../../blocks/HubDiagram';
import { SlideTitle } from '../shared';
import type { TemplateProps } from '../types';

export function HubDiagramSlide({ slide }: TemplateProps) {
  const hub = useBlock('diagram', 'hub-diagram');
  return (
    <ContentFrame>
      <SlideTitle />
      {hub ? (
        slide.variant === 'list' ? (
          <HubList block={hub} x={84} y={150} width={900} />
        ) : (
          <HubDiagram block={hub} centre={{ x: 800, y: 494 }} radius={240} />
        )
      ) : null}
    </ContentFrame>
  );
}
