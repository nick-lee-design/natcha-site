import { z } from 'zod';

export const SCHEMA_VERSION = 2;

export const motionStyle = z.enum(['gentle', 'pop', 'slide', 'draw', 'wipe', 'none']);
// The way an element travels as it enters: 'up' rises from below, 'left' arrives from the right.
export const direction = z.enum(['up', 'down', 'left', 'right']);
export const speed = z.enum(['relaxed', 'normal', 'brisk']);
export const stagger = z.enum(['tight', 'normal', 'loose']);
export const transition = z.enum(['fade', 'push', 'none']);
export const buildMode = z.enum(['auto', 'manual', 'none']);
export const build = z.union([z.literal('auto'), z.literal('with-previous'), z.number().int().min(1)]);
export const showIn = z.enum(['present', 'print', 'both']);

export const blockMotion = z.object({ style: motionStyle, direction, stagger }).partial();

const base = {
  id: z.string().min(1),
  build: build.default('auto'),
  motion: blockMotion.optional(),
  showIn: showIn.default('both'),
};

const item = { id: z.string().min(1) };

const textBlock = <T extends string>(type: T) =>
  z.object({ ...base, type: z.literal(type), content: z.string() });

export const icon = z.enum(['document', 'clock', 'layers', 'forward', 'cube']);

export const block = z.discriminatedUnion('type', [
  textBlock('title'),
  textBlock('subtitle'),
  textBlock('paragraph'),
  textBlock('caption'),
  z.object({ ...base, type: z.literal('label'), content: z.string(), note: z.string().optional() }),
  z.object({
    ...base,
    type: z.literal('image'),
    src: z.string(),
    alt: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    fit: z.enum(['contain', 'cover']).default('contain'),
  }),
  z.object({
    ...base,
    type: z.literal('image-grid'),
    items: z.array(z.object({ ...item, src: z.string(), alt: z.string() })),
  }),
  z.object({ ...base, type: z.literal('list'), items: z.array(z.object({ ...item, content: z.string() })) }),
  z.object({
    ...base,
    type: z.literal('table'),
    // key: bold accent (a stage name). name: bold. fee: large accent. width is a share of the table.
    columns: z
      .array(z.object({ ...item, label: z.string(), width: z.number().positive(), role: z.enum(['text', 'key', 'name', 'fee']).default('text') }))
      .min(1)
      .max(6),
    rows: z.array(z.object({ ...item, cells: z.array(z.string()) })),
    // Its rows are the services the enquiry form offers
    services: z.boolean().default(false),
  }),
  z.object({
    ...base,
    type: z.literal('key-list'),
    heading: z.string(),
    items: z.array(z.object({ ...item, number: z.number().int(), content: z.string() })),
    // Positions are percentages of the drawing named by `view`
    markers: z.array(
      z.object({
        ...item,
        view: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        label: z.string(),
        items: z.array(z.string()).min(1),
      }),
    ),
  }),
  z.object({
    ...base,
    type: z.literal('hub-diagram'),
    centre: z.string(),
    benefits: z.array(z.object({ ...item, content: z.string(), icon })).min(3).max(6),
    roles: z.array(z.object({ ...item, content: z.string() })).max(6),
  }),
  z.object({
    ...base,
    type: z.literal('contact-details'),
    name: z.string(),
    role: z.string(),
    phone: z.string(),
    email: z.string(),
  }),
  z.object({ ...base, type: z.literal('enquiry-form'), heading: z.string(), intro: z.string() }),
  z.object({ ...base, type: z.literal('qr-link'), content: z.string() }),
]);

export const slide = z.object({
  id: z.string().min(1),
  template: z.string(),
  variant: z.string().optional(),
  hidden: z.boolean().default(false),
  buildMode: buildMode.default('auto'),
  transition: transition.optional(),
  motion: z.object({ style: motionStyle, speed, stagger }).partial().optional(),
  hideText: z.boolean().default(false),
  notes: z.string().default(''),
  slots: z.record(z.string(), z.array(block)),
});

export const deck = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: z.string(),
  client: z.object({ name: z.string().default(''), company: z.string().default('') }).prefault({}),
  date: z.iso.date(),
  reference: z.string().default(''),
  format: z.literal('16:9').default('16:9'),
  theme: z.string().default('talo'),
  motion: z
    .object({
      speed: speed.default('normal'),
      style: motionStyle.default('gentle'),
      stagger: stagger.default('normal'),
      transition: transition.default('fade'),
      buildsInShare: z.boolean().default(true),
    })
    .prefault({}),
  slides: z.array(slide).min(1),
});

export type Block = z.infer<typeof block>;
export type BlockType = Block['type'];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;
export type Slide = z.infer<typeof slide>;
export type Deck = z.infer<typeof deck>;
export type DeckInput = z.input<typeof deck>;
export type MotionStyle = z.infer<typeof motionStyle>;
export type Direction = z.infer<typeof direction>;
export type Speed = z.infer<typeof speed>;
export type Stagger = z.infer<typeof stagger>;
export type BlockMotion = z.infer<typeof blockMotion>;
export type Icon = z.infer<typeof icon>;
