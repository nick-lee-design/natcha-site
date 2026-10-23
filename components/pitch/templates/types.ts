import type { ComponentType } from 'react';
import type { BlockType, Slide } from '@/lib/pitch/schema';

export type SlotDef = {
  name: string;
  label: string;
  accepts: BlockType[];
  max?: number;
  // Text slots are dropped when a slide hides its text
  text?: boolean;
};

export type VariantDef = { id: string; label: string };

// The pure half of a template: everything except the React component
export type TemplateDef = {
  id: string;
  name: string;
  slots: SlotDef[];
  variants: VariantDef[];
  defaultSlots: () => Slide['slots'];
  // Groups of unit ids that enter together, in order
  autoSteps: (slide: Slide) => string[][];
};

export type TemplateProps = { slide: Slide };

export type Template = TemplateDef & { Component: ComponentType<TemplateProps> };
