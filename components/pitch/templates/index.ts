import { AssetGrid } from './asset-grid/AssetGrid';
import { assetGrid } from './asset-grid/def';
import { Contact } from './contact/Contact';
import { contact } from './contact/def';
import { Cover } from './cover/Cover';
import { cover } from './cover/def';
import { heroCaseStudy } from './hero-case-study/def';
import { HeroCaseStudy } from './hero-case-study/HeroCaseStudy';
import { hubDiagram } from './hub-diagram/def';
import { HubDiagramSlide } from './hub-diagram/HubDiagramSlide';
import { multiViewCaseStudy } from './multi-view-case-study/def';
import { MultiViewCaseStudy } from './multi-view-case-study/MultiViewCaseStudy';
import { pricing } from './pricing/def';
import { Pricing } from './pricing/Pricing';
import { section } from './section/def';
import { Section } from './section/Section';
import { splitImage } from './split-image/def';
import { SplitImage } from './split-image/SplitImage';
import { threeView } from './three-view/def';
import { ThreeView } from './three-view/ThreeView';
import { textOnly } from './text-only/def';
import { TextOnly } from './text-only/TextOnly';
import { visualOnly } from './visual-only/def';
import { VisualOnly } from './visual-only/VisualOnly';
import type { Template } from './types';

export const templates: Record<string, Template> = Object.fromEntries(
  [
    { ...cover, Component: Cover },
    { ...splitImage, Component: SplitImage },
    { ...hubDiagram, Component: HubDiagramSlide },
    { ...assetGrid, Component: AssetGrid },
    { ...heroCaseStudy, Component: HeroCaseStudy },
    { ...multiViewCaseStudy, Component: MultiViewCaseStudy },
    { ...threeView, Component: ThreeView },
    { ...pricing, Component: Pricing },
    { ...contact, Component: Contact },
    { ...section, Component: Section },
    { ...textOnly, Component: TextOnly },
    { ...visualOnly, Component: VisualOnly },
  ].map((t) => [t.id, t]),
);
