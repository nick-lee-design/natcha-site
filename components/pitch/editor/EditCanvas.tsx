'use client';

import type { Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getBuildSteps } from '@/lib/pitch/build-engine';
import { canvasSize } from '@/lib/pitch/format';
import type { BlockType } from '@/lib/pitch/schema';
import { EditContext, type EditApi } from '../canvas/EditContext';
import { ModeProvider } from '../canvas/ModeProvider';
import { ScaleToFit } from '../canvas/ScaleToFit';
import { SlideCanvas } from '../canvas/SlideCanvas';
import { defaultBlock, locate, slideOf } from './ops';
import { useEditor } from './store';

export const editors = new Map<string, TiptapEditor>();

const PREVIEW_STEP = 900;

// The finished slide, editable in place. Preview plays its builds where it sits.
export function EditCanvas({ previewing, onPreviewEnd }: { previewing: boolean; onPreviewEnd: () => void }) {
  const deck = useEditor((s) => s.deck);
  const slideId = useEditor((s) => s.slideId);
  const blockId = useEditor((s) => s.blockId);
  const showOrder = useEditor((s) => s.showOrder);
  const change = useEditor((s) => s.change);
  const selectBlock = useEditor((s) => s.selectBlock);
  const slide = slideOf(deck, slideId);
  const index = deck.slides.indexOf(slide);
  const { width, height } = canvasSize(deck.format);
  const steps = useMemo(() => getBuildSteps(slide, deck), [slide, deck]);

  // One badge per block per step
  const buildOrder = useMemo(() => {
    if (!showOrder) return null;
    const map = new Map<string, number>();
    const seen = new Set<string>();
    steps.forEach((units, i) =>
      units.forEach((u) => {
        const key = `${u.split('/')[0]}:${i}`;
        if (!seen.has(key)) map.set(u, i + 1);
        seen.add(key);
      }),
    );
    return map;
  }, [showOrder, steps]);

  const api = useMemo<EditApi>(
    () => ({
      selectedBlock: blockId,
      select: selectBlock,
      buildOrder,
      updateBlock: (id, recipe) =>
        change((d) => {
          const found = locate(slideOf(d, slideId), id);
          if (found) recipe(found.block);
        }),
      addBlock: (slot: string, type: BlockType) => {
        const block = defaultBlock(type);
        change((d) => {
          const s = slideOf(d, slideId);
          (s.slots[slot] ??= []).push(block);
        });
        selectBlock(block.id);
      },
      registerEditor: (id, editor) => (editor ? editors.set(id, editor) : editors.delete(id)),
    }),
    [blockId, selectBlock, buildOrder, change, slideId],
  );

  // Preview: step through the builds once, then return to the finished slide
  const [step, setStep] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    if (!previewing) return;
    setStep(1);
    let n = 1;
    timer.current = setInterval(() => {
      n += 1;
      if (n > steps.length + 1) {
        clearInterval(timer.current);
        onPreviewEnd();
      } else setStep(Math.min(n, steps.length));
    }, PREVIEW_STEP);
    return () => clearInterval(timer.current);
  }, [previewing, steps.length, onPreviewEnd]);

  const entered = useMemo(() => new Set(steps.slice(0, step).flat()), [steps, step]);
  const entering = useMemo(() => new Map((steps[step - 1] ?? []).map((u, i) => [u, i] as const)), [steps, step]);

  return (
    <div className="ui-canvas-area" onClick={() => selectBlock(null)}>
      <ScaleToFit width={width} height={height} className="size-full">
        <div className="ui-canvas-shadow">
          {previewing ? (
            <ModeProvider mode="present" deck={deck}>
              <SlideCanvas key={`${slide.id}-preview`} slide={slide} index={index} total={deck.slides.length} entered={entered} entering={entering} />
            </ModeProvider>
          ) : (
            <ModeProvider mode="edit" deck={deck}>
              <EditContext value={api}>
                <div className="mode-edit">
                  <SlideCanvas slide={slide} index={index} total={deck.slides.length} />
                </div>
              </EditContext>
            </ModeProvider>
          )}
        </div>
      </ScaleToFit>
    </div>
  );
}
