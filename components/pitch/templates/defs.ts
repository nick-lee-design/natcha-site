import { assetGrid } from './asset-grid/def';
import { contact } from './contact/def';
import { cover } from './cover/def';
import { heroCaseStudy } from './hero-case-study/def';
import { hubDiagram } from './hub-diagram/def';
import { multiViewCaseStudy } from './multi-view-case-study/def';
import { pricing } from './pricing/def';
import { section } from './section/def';
import { splitImage } from './split-image/def';
import { textOnly } from './text-only/def';
import { threeView } from './three-view/def';
import { visualOnly } from './visual-only/def';
import type { TemplateDef } from './types';

export const templateDefs: Record<string, TemplateDef> = Object.fromEntries(
  [cover, splitImage, hubDiagram, assetGrid, heroCaseStudy, multiViewCaseStudy, threeView, pricing, contact, section, textOnly, visualOnly].map(
    (t) => [t.id, t],
  ),
);
