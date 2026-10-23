'use client';

import { createContext, use } from 'react';
import { create, useStore as useZustand } from 'zustand';
import { temporal } from 'zundo';
import type { Deck } from '@/lib/pitch/schema';

export type Panel = 'deck' | 'slide' | 'block';

type State = {
  deck: Deck;
  slideId: string;
  blockId: string | null;
  panel: Panel;
  showOrder: boolean;
  saved: string;
  // Every deck change goes through here, so each one is a single undo step
  change: (recipe: (deck: Deck) => void) => void;
  selectSlide: (id: string) => void;
  selectBlock: (id: string | null) => void;
  setPanel: (panel: Panel) => void;
  setShowOrder: (on: boolean) => void;
  markSaved: (json: string) => void;
  replace: (deck: Deck) => void;
};

export function createEditorStore(initial: Deck) {
  return create<State>()(
    temporal(
      (set, get) => ({
        deck: initial,
        slideId: initial.slides[0].id,
        blockId: null,
        panel: 'slide',
        showOrder: false,
        saved: JSON.stringify(initial),
        change: (recipe) => {
          const next = structuredClone(get().deck);
          recipe(next);
          set({ deck: next });
        },
        selectSlide: (id) => set({ slideId: id, blockId: null, panel: 'slide' }),
        selectBlock: (id) => set(id ? { blockId: id, panel: 'block' } : { blockId: null, panel: 'slide' }),
        setPanel: (panel) => set(panel === 'block' ? { panel } : { panel, blockId: null }),
        setShowOrder: (showOrder) => set({ showOrder }),
        markSaved: (saved) => set({ saved }),
        replace: (deck) => set({ deck, slideId: deck.slides[0].id, blockId: null, panel: 'slide' }),
      }),
      // Only the deck is history; selection and toggles aren't
      { partialize: (s) => ({ deck: s.deck }), equality: (a, b) => a.deck === b.deck, limit: 200 },
    ),
  );
}

export type EditorStore = ReturnType<typeof createEditorStore>;

export const StoreContext = createContext<EditorStore | null>(null);

function useStoreApi() {
  const store = use(StoreContext);
  if (!store) throw new Error('Editor store missing');
  return store;
}

export function useEditor<T>(selector: (s: State) => T): T {
  return useStoreApi()(selector);
}

export function useHistory() {
  const store = useStoreApi();
  const canUndo = useZustand(store.temporal, (t) => t.pastStates.length > 0);
  const canRedo = useZustand(store.temporal, (t) => t.futureStates.length > 0);
  const { undo, redo } = store.temporal.getState();
  return { canUndo, canRedo, undo, redo };
}

export function useEditorApi() {
  return useStoreApi();
}
