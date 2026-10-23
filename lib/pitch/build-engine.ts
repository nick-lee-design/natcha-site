import { templateDefs } from '@/components/pitch/templates/defs';
import { blocks } from '@/components/pitch/templates/recipe';
import type { Deck, Slide } from './schema';
import { resolveText } from './variables';

const ownerOf = (unit: string) => unit.split('/')[0];

// Turns a slide into ordered steps. Each step lists the unit ids that enter together.
// The player, the editor's build preview and the build-order overlay all use this.
// With a deck, text blocks whose variables are empty (and so render nothing) are left out.
export function getBuildSteps(slide: Slide, deck?: Deck): string[][] {
  const def = templateDefs[slide.template];
  if (!def) return [];
  const skip = deck ? emptyBlocks(slide, deck) : new Set<string>();
  const auto = def
    .autoSteps(slide)
    .map((s) => s.filter((u) => !skip.has(ownerOf(u))))
    .filter((s) => s.length);
  if (slide.buildMode === 'none') return auto.length ? [auto.flat()] : [];
  if (slide.buildMode === 'manual') return manualSteps(slide, auto, def.slots.map((s) => s.name));
  return auto;
}

function emptyBlocks(slide: Slide, deck: Deck) {
  const ids = new Set<string>();
  for (const b of Object.values(slide.slots).flat()) {
    if ('content' in b && resolveText(b.content, deck) === null) ids.add(b.id);
  }
  return ids;
}

function manualSteps(slide: Slide, auto: string[][], slotOrder: string[]): string[][] {
  const flat = auto.flat();
  const parts = flat.filter((u) => u.startsWith('@'));
  const numbered = new Map<number, string[]>();
  const trailing: string[][] = [];
  let prev: string[] | undefined;

  for (const b of slotOrder.flatMap((s) => blocks(slide, s))) {
    const units = flat.filter((u) => ownerOf(u) === b.id);
    if (!units.length) continue;
    if (b.build === 'with-previous' && prev) {
      prev.push(...units);
    } else if (typeof b.build === 'number') {
      prev = numbered.get(b.build) ?? [];
      prev.push(...units);
      numbered.set(b.build, prev);
    } else {
      prev = [...units];
      trailing.push(prev);
    }
  }

  const steps = [...[...numbered.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s), ...trailing];
  if (parts.length) {
    if (steps.length) steps[0].unshift(...parts);
    else steps.push(parts);
  }
  return steps;
}
