'use client';

import type { Editor } from '@tiptap/react';
import { createContext, use } from 'react';
import type { Block, BlockType } from '@/lib/pitch/schema';

// Present only inside the editor. Blocks use it to become selectable and editable.
export type EditApi = {
  selectedBlock: string | null;
  select: (blockId: string | null) => void;
  // Unit id → step number, when the build order overlay is on
  buildOrder: ReadonlyMap<string, number> | null;
  updateBlock: (blockId: string, change: (block: Block) => void) => void;
  addBlock: (slot: string, type: BlockType) => void;
  registerEditor: (blockId: string, editor: Editor | null) => void;
};

export const EditContext = createContext<EditApi | null>(null);

export function useEdit() {
  return use(EditContext);
}
