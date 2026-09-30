"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import type { DemoPage } from "@/core/types";
import { layoutDemoPage } from "@/core/demo/layout";
import { NotebookPage } from "@/components/evidence/notebook-page";
import { StrengthRing } from "@/components/profile/strength-card";
import { useI18n } from "@/lib/i18n/context";
import { formatMoney } from "@/lib/format";

const PAGE: DemoPage = {
  header: "Lundi 14/09/2026",
  lines: [
    { text: "Tomates 3 tas", amount: "1 500" },
    { text: "Plantain 1 régime", amount: "4 000" },
    { text: "Piment 2 tas", amount: "400" },
    { text: "Ndolé 4 bottes", amount: "1 000" },
    { text: "Oignons 2 tas", amount: "1 000" },
    { text: "Macabo 1 tas", amount: "1 000" },
    { text: "Achat cageot tomates", amount: "16 000" },
  ],
  total: { text: "Total ventes", amount: "8 900" },
  ink: "blue",
  tilt: -0.6,
  seed: 1409,
};
const AMOUNTS = [1500, 4000, 400, 1000, 1000, 1000];
const WEEKS = [0.62, 0.7, 0.66, 0.78, 0.74, 0.86, 0.82, 0.94];

export function HeroVisual() {
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();
  const layout = layoutDemoPage(PAGE);
  const [i, setI] = useState(reduce ? AMOUNTS.length - 1 : 0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % AMOUNTS.length), 1300);
    return () => window.clearInterval(id);
  }, [reduce]);

  const box = layout.lines[i].box;
  const total = AMOUNTS.slice(0, i + 1).reduce((a, b) => a + b, 0);

  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-10 pr-6 sm:pr-10">
      <m.div
        initial={{ opacity: 0, y: 16, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -2.2 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[18px] shadow-float ring-1 ring-black/5"
        style={{ aspectRatio: "3 / 4" }}
      >
        <NotebookPage page={PAGE} className="absolute inset-0 h-full w-full" />
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <rect
            key={i}
            x={box[1]}
            y={box[0]}
            width={box[3] - box[1]}
            height={box[2] - box[0]}
            rx={6}
            fill="var(--marker)"
            className="marker-sweep"
            style={{ mixBlendMode: "multiply" }}
          />
        </svg>
        <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-brand/10 to-transparent" />
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 20, x: 10 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -bottom-2 right-0 w-[250px] rounded-2xl border border-line bg-surface/95 p-4 shadow-float backdrop-blur sm:w-[270px]"
      >
        <div className="flex items-center justify-between text-[12px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            {t.landing.heroCard.reading}
          </span>
          <span className="tabular">
            {t.landing.heroCard.found} {i + 1}/{AMOUNTS.length}
          </span>
        </div>
        <p className="mt-3 text-[12px] text-ink-3">{t.landing.heroCard.total}</p>
        <p className="text-[24px] font-semibold tracking-[-0.02em] tabular">{formatMoney(total, locale)}</p>
        <div className="mt-3 flex items-end gap-3 border-t border-line pt-3">
          <div className="flex h-12 flex-1 items-end gap-[3px]">
            {WEEKS.map((h, k) => (
              <span
                key={k}
                className="bar-grow flex-1 rounded-t-[3px] bg-chart-1"
                style={{ height: `${h * 100}%`, animationDelay: `${600 + k * 60}ms`, opacity: k === WEEKS.length - 1 ? 1 : 0.75 }}
              />
            ))}
          </div>
          <StrengthRing score={84} grade="strong" size={52} />
        </div>
        <p className="mt-2 text-[11.5px] text-ink-3">
          {t.landing.heroCard.weekly} · <span className="font-medium text-ink-2">{formatMoney(92400, locale)}</span>
        </p>
      </m.div>
    </div>
  );
}
