'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// A native modal dialog: focus trapping and Escape come with it
export function Dialog({
  open,
  onClose,
  title,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`ui-dialog ${wide ? 'is-wide' : ''}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="p-6">
          <h2 className="mb-5 text-lg font-semibold tracking-[-.02em]">{title}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
