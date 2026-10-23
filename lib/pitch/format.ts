// Every deck is 16:9. The format setting stays in the schema so the canvas size has one source.
export const FORMATS = {
  '16:9': { width: 1600, height: 900 },
} as const;

export type DeckFormat = keyof typeof FORMATS;

export function canvasSize(format: DeckFormat) {
  return FORMATS[format];
}
