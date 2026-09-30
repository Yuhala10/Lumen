"use client";

import { useEffect, useRef, useState } from "react";
import type { WeekRow } from "@/core/understand/profile";
import { Card, CardHeader } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { useEvidence } from "@/components/evidence/evidence-provider";
import { useI18n } from "@/lib/i18n/context";
import { formatCompact, formatDate, formatMoney, formatRange } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Weekly sales, one series. Thin bars (at most 24px) with a 4px rounded top
 * and a square base, a hairline grid, one direct label on the best week, a
 * tooltip on hover and keyboard focus, and a table view for every value.
 */

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function niceTicks(max: number, count = 4): { ticks: number[]; top: number } {
  const step = niceStep(Math.max(1, max) / count);
  const top = Math.ceil(max / step) * step || step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { ticks, top };
}

function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function WeeklyChart({ weeks }: { weeks: WeekRow[] }) {
  const { t, locale } = useI18n();
  const evidence = useEvidence();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 236;
  const M = { top: 30, right: 6, bottom: 30, left: 46 };
  const innerW = Math.max(120, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const max = Math.max(0, ...weeks.map((w) => w.sales));
  const { ticks, top } = niceTicks(max);
  const band = innerW / Math.max(1, weeks.length);
  const barW = Math.max(4, Math.min(24, band * 0.6));
  const y = (v: number) => M.top + innerH - (v / top) * innerH;
  const labelEvery = Math.max(1, Math.ceil((weeks.length * 52) / innerW));
  const best = weeks.reduce((b, w, i) => (!w.partial && !w.gap && (b < 0 || w.sales > weeks[b].sales) ? i : b), -1);

  const openWeek = (w: WeekRow) =>
    evidence.open({ type: "entries", title: t.evidence.weekTitle(formatRange(w.start, w.end, locale)), ids: w.entryIds });

  const activeWeek = active !== null ? weeks[active] : null;

  return (
    <Card className="print-break">
      <CardHeader
        title={t.chart.title}
        subtitle={t.chart.subtitle}
        action={
          <IconButton
            icon={table ? "chart" : "table"}
            label={table ? t.chart.showChart : t.chart.showTable}
            onClick={() => setTable((v) => !v)}
            className="no-print"
          />
        }
      />
      <div className="px-3 pb-4 pt-3 sm:px-4">
        {table ? (
          <div className="overflow-x-auto px-2">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-3">
                  <th className="py-2 font-medium">{t.chart.week}</th>
                  <th className="py-2 text-right font-medium">{t.chart.sales}</th>
                  <th className="py-2 text-right font-medium">{t.chart.expenses}</th>
                  <th className="py-2 text-right font-medium">{t.chart.days}</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.key} className="border-b border-line last:border-0">
                    <td className="py-2">
                      <button type="button" className="text-left hover:text-brand" onClick={() => openWeek(w)}>
                        {formatDate(w.start, locale)}
                      </button>
                      {w.partial ? <span className="ml-2 text-[12px] text-ink-3">{t.chart.partial}</span> : null}
                    </td>
                    <td className="py-2 text-right tabular">{w.gap ? "—" : formatMoney(w.sales, locale)}</td>
                    <td className="py-2 text-right tabular text-ink-3">{formatMoney(w.expenses, locale)}</td>
                    <td className="py-2 text-right tabular">{w.activeDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={wrap} className="relative" onPointerLeave={() => setActive(null)}>
            <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={t.chart.title}>
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth={1} />
                  <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular">
                    {formatCompact(v, locale)}
                  </text>
                </g>
              ))}
              {weeks.map((w, i) => {
                const cx = M.left + band * i + band / 2;
                const x = cx - barW / 2;
                const h = Math.max(0, y(0) - y(w.sales));
                const isActive = active === i;
                return (
                  <g
                    key={w.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t.chart.week} ${formatDate(w.start, locale)}: ${w.gap ? t.chart.noRecords : formatMoney(w.sales, locale)}`}
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => openWeek(w)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openWeek(w);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <rect x={M.left + band * i} y={M.top} width={band} height={innerH} fill={isActive ? "var(--chart-grid)" : "transparent"} opacity={0.6} rx={6} />
                    {w.gap ? (
                      <line x1={x} x2={x + barW} y1={y(0) - 1} y2={y(0) - 1} stroke="var(--line-strong)" strokeWidth={2} strokeLinecap="round" />
                    ) : (
                      <path
                        d={barPath(x, y(w.sales), barW, h, 4)}
                        fill={w.partial ? "var(--chart-1-soft)" : "var(--chart-1)"}
                        className="bar-grow"
                        style={{ animationDelay: `${i * 22}ms`, filter: isActive ? "brightness(1.12)" : undefined }}
                      />
                    )}
                    {i === best && !isActive ? (
                      <text x={cx} y={y(w.sales) - 8} textAnchor="middle" className="fill-ink-2 text-[11.5px] font-semibold tabular">
                        {formatCompact(w.sales, locale)}
                      </text>
                    ) : null}
                    {i % labelEvery === 0 ? (
                      <text x={cx} y={H - 10} textAnchor="middle" className="fill-ink-3 text-[11px]">
                        {formatDate(w.start, locale)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            {activeWeek && active !== null ? (
              <div
                className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-bg shadow-float"
                style={{
                  left: Math.min(Math.max(M.left + band * active + band / 2, 72), width - 72),
                  top: Math.max(8, y(activeWeek.sales) - 10),
                }}
              >
                <p className="text-[15px] font-semibold tabular">
                  {activeWeek.gap ? t.chart.noRecords : formatMoney(activeWeek.sales, locale)}
                </p>
                <p className="text-[12px] opacity-75">
                  {formatRange(activeWeek.start, activeWeek.end, locale)}
                </p>
                <p className="text-[12px] opacity-75">
                  {t.common.days(activeWeek.activeDays)}
                  {activeWeek.partial ? ` · ${t.chart.partial}` : ""}
                </p>
              </div>
            ) : null}
            <div className={cn("mt-1 flex items-center gap-4 px-2 text-[12px] text-ink-3", !weeks.some((w) => w.partial) && "hidden")}>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--chart-1-soft)" }} />
                {t.chart.partial}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
