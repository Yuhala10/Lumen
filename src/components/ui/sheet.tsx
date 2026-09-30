"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * A native <dialog> sheet: a bottom sheet on phones (drag the handle down to
 * close), a side panel on desktop. Focus trapping, Escape and the backdrop
 * come from the browser, and the motion is plain CSS.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);

  const finishClose = useCallback(() => {
    const d = ref.current;
    if (!d || !d.open) return;
    d.classList.add("closing");
    window.setTimeout(() => {
      d.classList.remove("closing");
      d.style.transform = "";
      d.close();
    }, 300);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.style.transform = "";
      d.showModal();
    } else if (!open && d.open) finishClose();
  }, [open, finishClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = ref.current;
    if (!drag.current || !d) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    d.style.transition = "none";
    d.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    const d = ref.current;
    if (!drag.current || !d) return;
    const { dy } = drag.current;
    drag.current = null;
    d.style.transition = "";
    if (dy > 110) onClose();
    else d.style.transform = "";
  };

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 lg:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
        {children}
      </div>
    </dialog>
  );
}
