"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { Icon } from "./icon";
import { cn } from "@/lib/cn";

type ToastTone = "good" | "danger" | "neutral";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const Ctx = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const show = useCallback((message: string, tone: ToastTone = "good") => {
    const id = next.current++;
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === "danger" ? 5200 : 3200);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[14px] font-medium text-bg shadow-float"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full",
                  t.tone === "good" && "bg-brand text-brand-ink",
                  t.tone === "danger" && "bg-danger text-white",
                  t.tone === "neutral" && "bg-ink-3 text-bg",
                )}
              >
                <Icon name={t.tone === "danger" ? "x" : "check"} size={13} strokeWidth={2.5} />
              </span>
              {t.message}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}
