import { templateDefs } from '@/components/pitch/templates/defs';
import { deck as deckSchema, SCHEMA_VERSION, type Deck } from './schema';
import { packagesTable, stagesTable } from './tables';

// Upgrades older deck files one schema version at a time
const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2: tables read their rows from content/pricing.ts; now each table holds its own, so it can be edited
  1: (doc) => {
    const slides = (doc.slides as { slots?: Record<string, Record<string, unknown>[]> }[]) ?? [];
    for (const slide of slides) {
      for (const blocks of Object.values(slide.slots ?? {})) {
        for (const b of blocks) {
          if (b.type !== 'table' || !('source' in b)) continue;
          Object.assign(b, b.source === 'stages' ? stagesTable() : packagesTable());
          delete b.source;
        }
      }
    }
    return { ...doc, schemaVersion: 2 };
  },
};

function migrate(raw: unknown) {
  if (!raw || typeof raw !== 'object') return raw;
  let doc = raw as Record<string, unknown>;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : SCHEMA_VERSION;
  while (version < SCHEMA_VERSION && migrations[version]) {
    doc = migrations[version](doc);
    version += 1;
  }
  return doc;
}

// Checks the parts zod can't: every slot exists on its template and holds the right blocks
export function templateProblems(deck: Deck): string[] {
  const problems: string[] = [];
  for (const slide of deck.slides) {
    const at = `slide “${slide.id}”`;
    const def = templateDefs[slide.template];
    if (!def) {
      problems.push(`${at} uses unknown template “${slide.template}”`);
      continue;
    }
    if (slide.variant && !def.variants.some((v) => v.id === slide.variant)) {
      problems.push(`${at} has unknown variant “${slide.variant}”`);
    }
    const ids = new Set<string>();
    for (const [name, blocks] of Object.entries(slide.slots)) {
      const slot = def.slots.find((s) => s.name === name);
      if (!slot) {
        problems.push(`${at} has no slot “${name}”`);
        continue;
      }
      if (slot.max && blocks.length > slot.max) problems.push(`${at} slot “${name}” holds more than ${slot.max} blocks`);
      for (const b of blocks) {
        if (!slot.accepts.includes(b.type)) problems.push(`${at} slot “${name}” doesn’t take ${b.type} blocks`);
        if (ids.has(b.id)) problems.push(`${at} repeats block id “${b.id}”`);
        ids.add(b.id);
      }
    }
  }
  const slideIds = deck.slides.map((s) => s.id);
  if (new Set(slideIds).size !== slideIds.length) problems.push('Slide ids must be unique');
  return problems;
}

// Used on load and on save
export function parseDeck(raw: unknown): Deck {
  const deck = deckSchema.parse(migrate(raw));
  const problems = templateProblems(deck);
  if (problems.length) throw new Error(`Deck “${deck.id}” is invalid:\n${problems.join('\n')}`);
  return deck;
}
