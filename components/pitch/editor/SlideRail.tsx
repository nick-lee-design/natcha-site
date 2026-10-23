'use client';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { Slide } from '@/lib/pitch/schema';
import { duplicateSlide } from './ops';
import { useEditor, useHistory } from './store';
import { Thumb } from './Thumb';
import { useToast } from './Toasts';

function RailItem({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  const deck = useEditor((s) => s.deck);
  const active = useEditor((s) => s.slideId === slide.id);
  const selectSlide = useEditor((s) => s.selectSlide);
  const change = useEditor((s) => s.change);
  const { undo } = useHistory();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });

  const remove = () => {
    if (deck.slides.length < 2) return toast('A deck needs at least one slide');
    const next = deck.slides[index + 1] ?? deck.slides[index - 1];
    change((d) => {
      d.slides = d.slides.filter((s) => s.id !== slide.id);
    });
    selectSlide(next.id);
    toast('Slide deleted', { label: 'Undo', run: undo });
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? 'z-10 opacity-80' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-stone-500">
        <span>{index + 1}</span>
        {slide.hidden ? <span>Hidden</span> : null}
      </div>
      {/* A div with button semantics: the slide inside contains form controls, which can't nest in <button> */}
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`Slide ${index + 1}`}
        aria-current={active || undefined}
        onClick={() => selectSlide(slide.id)}
        // Enter selects; Space picks the slide up to move it with the arrow keys
        onKeyDown={(e) => (e.key === 'Enter' ? selectSlide(slide.id) : listeners?.onKeyDown?.(e))}
        className={`ui-thumb cursor-pointer ${active ? 'is-active' : ''} ${slide.hidden ? 'opacity-45' : ''}`}
      >
        <Thumb deck={deck} slide={slide} index={index} total={total} />
      </div>
      <button
        type="button"
        aria-label="Slide options"
        aria-expanded={menu}
        className="ui-thumb-menu-button"
        onClick={() => setMenu((m) => !m)}
      >
        •••
      </button>
      {menu ? (
        <div className="ui-menu absolute top-8 right-1 z-20" role="menu" onMouseLeave={() => setMenu(false)}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const copy = duplicateSlide(slide);
              change((d) => {
                d.slides.splice(index + 1, 0, copy);
              });
              selectSlide(copy.id);
              setMenu(false);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              change((d) => {
                d.slides[index].hidden = !d.slides[index].hidden;
              });
              setMenu(false);
            }}
          >
            {slide.hidden ? 'Show slide' : 'Hide slide'}
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={remove}>
            Delete
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function SlideRail({ onAdd }: { onAdd: () => void }) {
  const slides = useEditor((s) => s.deck.slides);
  const change = useEditor((s) => s.change);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    change((d) => {
      const from = d.slides.findIndex((s) => s.id === active.id);
      const to = d.slides.findIndex((s) => s.id === over.id);
      d.slides = arrayMove(d.slides, from, to);
    });
  };

  return (
    <nav aria-label="Slides" className="ui-rail">
      <DndContext id="slide-rail" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-3">
            {slides.map((s, i) => (
              <RailItem key={s.id} slide={s} index={i} total={slides.length} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button type="button" className="ui-add-slide" onClick={onAdd}>
        + Add slide
      </button>
    </nav>
  );
}
