"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import type { Trader } from "@/core/types";
import type { Grade } from "@/core/understand/strength";
import type { TrendDirection } from "@/core/understand/profile";
import { StrengthRing } from "@/components/profile/strength-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input, Select } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/context";
import { api, errorText } from "@/lib/api";
import { formatMoney, formatPct, formatRange, initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface PortfolioRow {
  trader: Pick<Trader, "id" | "name" | "business" | "market" | "city" | "demo" | "consent">;
  strength: { score: number; grade: Grade };
  avgWeekly: number;
  trend: { direction: TrendDirection; pct: number } | null;
  period: { start: string; end: string } | null;
  momoRate: number;
  momoInflows: number;
  lastActivity: string;
}

type Sort = "strength" | "sales" | "recent";

export function Portfolio({ rows }: { rows: PortfolioRow[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("strength");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const filtered = rows.filter((r) =>
      [r.trader.name, r.trader.business, r.trader.market, r.trader.city]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q),
    );
    return filtered.sort((a, b) =>
      sort === "strength" ? b.strength.score - a.strength.score : sort === "sales" ? b.avgWeekly - a.avgWeekly : b.lastActivity.localeCompare(a.lastActivity),
    );
  }, [rows, query, sort]);

  async function openCode(e: React.FormEvent) {
    e.preventDefault();
    setOpening(true);
    setCodeError(null);
    try {
      const { id } = await api<{ id: string }>("/api/share", { body: { code } });
      router.push(`/lender/${id}`);
    } catch (err) {
      setCodeError(errorText(err, t.errors));
      setOpening(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={openCode} className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <label htmlFor="share-code" className="flex items-center gap-2 text-[14px] font-semibold">
          <Icon name="lock" size={17} className="text-brand" />
          {t.lender.codeLabel}
        </label>
        <div className="mt-3 flex gap-2">
          <Input
            id="share-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setCodeError(null);
            }}
            placeholder={t.lender.codePlaceholder}
            className="font-mono tracking-[0.08em]"
            autoComplete="off"
            aria-invalid={Boolean(codeError)}
          />
          <Button type="submit" loading={opening} disabled={code.replace(/[^A-Z0-9]/gi, "").length < 8}>
            {t.lender.open}
          </Button>
        </div>
        {codeError ? <p className="mt-2 text-[13px] font-medium text-danger">{codeError}</p> : null}
      </form>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.lender.search} className="pl-10" aria-label={t.lender.search} />
        </div>
        <div className="sm:w-60">
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t.lender.sortLabel}>
            {(["strength", "sales", "recent"] as Sort[]).map((s) => (
              <option key={s} value={s}>
                {t.lender.sort[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!rows.length ? (
        <p className="rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center text-[14px] text-ink-3">{t.lender.empty}</p>
      ) : !shown.length ? (
        <p className="px-2 py-10 text-center text-[14px] text-ink-3">{t.lender.noMatch}</p>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:block">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-medium text-ink-3">
                  <th className="px-5 py-3 font-medium">{t.lender.columns.business}</th>
                  <th className="px-3 py-3 font-medium">{t.lender.columns.strength}</th>
                  <th className="px-3 py-3 text-right font-medium">{t.lender.columns.weekly}</th>
                  <th className="px-3 py-3 font-medium">{t.lender.columns.trend}</th>
                  <th className="px-3 py-3 text-right font-medium">{t.lender.columns.momo}</th>
                  <th className="px-5 py-3 font-medium">{t.lender.columns.period}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {shown.map((r) => (
                    <m.tr
                      key={r.trader.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => router.push(`/lender/${r.trader.id}`)}
                      className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2"
                    >
                      <td className="px-5 py-4">
                        <Link href={`/lender/${r.trader.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[14px] font-semibold text-brand">
                            {initials(r.trader.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 font-semibold group-hover:text-brand">
                              {r.trader.name}
                              {r.trader.demo ? <Badge className="h-5 px-2 text-[11px]">{t.common.demo}</Badge> : null}
                            </span>
                            <span className="block truncate text-[12.5px] text-ink-3">
                              {r.trader.business} · {r.trader.city}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-4">
                        <span className="flex items-center gap-2.5">
                          <StrengthRing score={r.strength.score} grade={r.strength.grade} size={40} />
                          <span className="text-[13px] text-ink-2">{t.strength.grades[r.strength.grade]}</span>
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right font-semibold tabular">{r.avgWeekly ? formatMoney(r.avgWeekly, locale) : "—"}</td>
                      <td className="px-3 py-4">
                        <TrendCell trend={r.trend} />
                      </td>
                      <td className="px-3 py-4 text-right tabular text-ink-2">{r.momoInflows ? formatPct(r.momoRate, locale) : "—"}</td>
                      <td className="px-5 py-4 text-[12.5px] text-ink-3">{r.period ? formatRange(r.period.start, r.period.end, locale) : "—"}</td>
                    </m.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* phone cards */}
          <ul className="grid gap-3 md:hidden">
            {shown.map((r) => (
              <li key={r.trader.id}>
                <Link href={`/lender/${r.trader.id}`} className="block rounded-2xl border border-line bg-surface p-4 shadow-card active:scale-[0.99]">
                  <div className="flex items-center gap-3">
                    <StrengthRing score={r.strength.score} grade={r.strength.grade} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-semibold">
                        {r.trader.name}
                        {r.trader.demo ? <Badge className="h-5 px-2 text-[11px]">{t.common.demo}</Badge> : null}
                      </p>
                      <p className="truncate text-[12.5px] text-ink-3">
                        {r.trader.business} · {r.trader.city}
                      </p>
                    </div>
                    <Icon name="chevronRight" size={18} className="text-ink-3" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[12px]">
                    <div>
                      <p className="text-ink-3">{t.lender.columns.weekly}</p>
                      <p className="mt-0.5 text-[13.5px] font-semibold tabular">{r.avgWeekly ? formatMoney(r.avgWeekly, locale) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-ink-3">{t.lender.columns.trend}</p>
                      <div className="mt-0.5">
                        <TrendCell trend={r.trend} />
                      </div>
                    </div>
                    <div>
                      <p className="text-ink-3">{t.lender.columns.momo}</p>
                      <p className="mt-0.5 text-[13.5px] font-semibold tabular">{r.momoInflows ? formatPct(r.momoRate, locale) : "—"}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TrendCell({ trend }: { trend: PortfolioRow["trend"] }) {
  const { locale } = useI18n();
  if (!trend) return <span className="text-ink-3">—</span>;
  const up = trend.direction === "growing";
  const down = trend.direction === "declining";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13.5px] font-semibold tabular", up ? "text-good" : down ? "text-danger" : "text-ink-2")}>
      <Icon name={up ? "trendUp" : down ? "trendDown" : "trendFlat"} size={16} strokeWidth={2} />
      {formatPct(trend.pct, locale, { sign: true })}
    </span>
  );
}
