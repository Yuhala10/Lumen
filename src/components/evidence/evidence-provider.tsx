"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import type { Box, Entry, MomoTx, Source, Trader } from "@/core/types";
import type { Profile } from "@/core/understand/profile";
import { pageChecks } from "@/core/refine/flags";
import { groupThousands } from "@/core/money";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { EvidenceImage, type Highlight } from "./evidence-image";
import { useI18n } from "@/lib/i18n/context";
import { formatDate, formatDateTime, formatMoney, formatPct } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Every number in Trust opens here. A small navigation stack lets a lender go
 * from a figure, to the list of lines behind it, to one line on its page,
 * and back again.
 */

export interface EvidenceData {
  trader: Trader;
  sources: Source[];
  entries: Entry[];
  momo: MomoTx[];
  profile: Profile;
}

export type EvidenceTarget =
  | { type: "entry"; id: string; siblings?: string[] }
  | { type: "momo"; id: string; siblings?: string[] }
  | { type: "entries"; title: string; subtitle?: string; ids: string[] }
  | { type: "momoList"; title: string; subtitle?: string; ids: string[] }
  | { type: "source"; id: string; title?: string; highlight?: string[]; totalBox?: Box };

interface EvidenceApi {
  open: (target: EvidenceTarget) => void;
}

const Ctx = createContext<EvidenceApi | null>(null);

export function useEvidence(): EvidenceApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEvidence must be used inside EvidenceProvider");
  return v;
}

export function EvidenceProvider({ data, children }: { data: EvidenceData; children: ReactNode }) {
  const [stack, setStack] = useState<EvidenceTarget[]>([]);
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  const api = useMemo<EvidenceApi>(
    () => ({
      open: (target) => {
        setStack([target]);
        setOpen(true);
      },
    }),
    [],
  );

  const push = useCallback((target: EvidenceTarget) => setStack((s) => [...s, target]), []);
  const replace = useCallback((target: EvidenceTarget) => setStack((s) => [...s.slice(0, -1), target]), []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setOpen(false), []);

  const top = stack.at(-1);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={open && Boolean(top)} onClose={close} label={t.evidence.title}>
        {top ? (
          <EvidenceBody key={stack.length} data={data} target={top} depth={stack.length} push={push} replace={replace} back={back} close={close} />
        ) : null}
      </Sheet>
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */

interface BodyProps {
  data: EvidenceData;
  target: EvidenceTarget;
  depth: number;
  push: (t: EvidenceTarget) => void;
  replace: (t: EvidenceTarget) => void;
  back: () => void;
  close: () => void;
}

function useMaps(data: EvidenceData) {
  return useMemo(
    () => ({
      entries: new Map(data.entries.map((e) => [e.id, e])),
      sources: new Map(data.sources.map((s) => [s.id, s])),
      momo: new Map(data.momo.map((x) => [x.id, x])),
      corroborated: new Set(data.profile.momo.corroboratedIds),
      exact: new Map(data.profile.momo.exact.map((x) => [x.momoId, x.entryId])),
      excluded: new Set(data.profile.integrity.excludedDuplicateIds),
    }),
    [data],
  );
}

function EvidenceBody({ data, target, depth, push, replace, back, close }: BodyProps) {
  const { t } = useI18n();
  const title =
    target.type === "entry"
      ? t.evidence.line
      : target.type === "momo"
        ? t.evidence.message
        : target.type === "source"
          ? (target.title ?? t.evidence.page)
          : target.title;

  const siblings = target.type === "entry" || target.type === "momo" ? target.siblings : undefined;
  const index = siblings && "id" in target ? siblings.indexOf(target.id) : -1;
  const step = (dir: -1 | 1) => {
    if (!siblings || index < 0) return;
    const id = siblings[index + dir];
    if (id && (target.type === "entry" || target.type === "momo")) replace({ ...target, id });
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        {depth > 1 ? <IconButton icon="arrowLeft" label={t.common.back} onClick={back} /> : <span className="w-2" />}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h2>
        {siblings && index >= 0 ? (
          <div className="flex items-center gap-1 text-[12.5px] text-ink-3 tabular">
            <IconButton icon="chevronLeft" label="Previous" onClick={() => step(-1)} disabled={index <= 0} />
            <span>
              {index + 1}/{siblings.length}
            </span>
            <IconButton icon="chevronRight" label="Next" onClick={() => step(1)} disabled={index >= siblings.length - 1} />
          </div>
        ) : null}
        <IconButton icon="x" label={t.common.close} onClick={close} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={"id" in target ? target.id : target.type + (target.type === "entries" || target.type === "momoList" ? target.title : "")}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5"
        >
          {target.type === "entry" ? <EntryView data={data} id={target.id} push={push} /> : null}
          {target.type === "momo" ? <MomoView data={data} id={target.id} push={push} /> : null}
          {target.type === "entries" ? <EntryList data={data} ids={target.ids} subtitle={target.subtitle} push={push} /> : null}
          {target.type === "momoList" ? <MomoList data={data} ids={target.ids} subtitle={target.subtitle} push={push} /> : null}
          {target.type === "source" ? <SourceViewPanel data={data} target={target} push={push} /> : null}
        </m.div>
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[14px] last:border-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

function EntryView({ data, id, push }: { data: EvidenceData; id: string; push: (t: EvidenceTarget) => void }) {
  const { t, locale } = useI18n();
  const maps = useMaps(data);
  const e = maps.entries.get(id);
  if (!e) return <p className="text-ink-3">{t.errors.not_found}</p>;
  const source = maps.sources.get(e.sourceId);
  const highlights: Highlight[] = e.box ? [{ key: e.id, box: e.box, tone: "marker" }] : [];
  const pageLines = data.entries.filter((x) => x.sourceId === e.sourceId);
  const checks = source?.reading ? pageChecks(pageLines, source.reading.writtenTotals, source.reading.pageDate) : [];

  return (
    <div className="space-y-5">
      {source ? <EvidenceImage source={source} highlights={highlights} focus={e.box} /> : null}

      <div>
        <div className="flex items-center gap-2">
          <Badge tone={e.type === "sale" ? "brand" : "neutral"}>{e.type === "sale" ? t.common.sale : t.common.expense}</Badge>
          {maps.excluded.has(e.id) ? <Badge tone="warn" icon="layers">{t.profile.dupLines(1)}</Badge> : null}
        </div>
        <p className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">{formatMoney(e.amount, locale)}</p>
        <p className="mt-0.5 text-[15px] text-ink-2">{e.description}</p>
      </div>

      <StatusLine entry={e} />

      <dl className="rounded-xl bg-surface-2 px-4 ring-1 ring-line">
        <Detail label={t.evidence.date}>{e.date ? formatDate(e.date, locale, "full") : "—"}</Detail>
        {e.origin === "ai" ? (
          <div className="border-b border-line py-2.5 last:border-0">
            <div className="flex items-baseline justify-between text-[14px]">
              <span className="text-ink-3">{t.evidence.confidence}</span>
              <span className="font-medium tabular">{formatPct(e.confidence, locale)}</span>
            </div>
            <Meter className="mt-2" value={e.confidence} tone={e.confidence >= 0.8 ? "good" : "warn"} label={t.evidence.confidence} />
          </div>
        ) : null}
        {source ? <Detail label={t.evidence.page}>{formatDateTime(source.createdAt, locale)}</Detail> : null}
        {source?.reading ? (
          <Detail label="AI">{t.evidence.readIn(source.reading.model, (source.reading.ms / 1000).toFixed(1))}</Detail>
        ) : null}
      </dl>

      {checks.map((c, i) => (
        <div key={i} className={cn("flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px] leading-5", c.ok ? "bg-good-soft text-good" : "bg-warn-soft text-warn")}>
          <Icon name={c.ok ? "checkCircle" : "alert"} size={18} className="mt-px" />
          <span>
            {c.ok ? t.review.totalOk(formatMoney(c.written, locale)) : t.review.totalBad(formatMoney(c.written, locale), formatMoney(c.computed, locale))}
          </span>
        </div>
      ))}

      {source ? (
        <Button variant="secondary" icon="notebook" className="w-full" onClick={() => push({ type: "source", id: source.id, highlight: [e.id] })}>
          {t.evidence.openPage}
        </Button>
      ) : null}
    </div>
  );
}

function StatusLine({ entry: e }: { entry: Entry }) {
  const { t, locale } = useI18n();
  let icon: "checkCircle" | "pencil" | "plus" | "history" = "checkCircle";
  let text: string = t.evidence.confirmedByTrader;
  if (e.status === "pending") {
    icon = "history";
    text = t.evidence.pending;
  } else if (e.origin === "trader") {
    icon = "plus";
    text = t.evidence.addedByTrader;
  } else if (e.original) {
    icon = "pencil";
    const changed = e.original.amount !== e.amount ? formatMoney(e.original.amount, locale) : e.original.description;
    text = t.evidence.correctedByTrader(changed);
  }
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-brand-soft px-4 py-3 text-[13.5px] leading-5 text-brand">
      <Icon name={icon} size={18} className="mt-px" />
      <span>{text}</span>
    </div>
  );
}

function EntryList({ data, ids, subtitle, push }: { data: EvidenceData; ids: string[]; subtitle?: string; push: (t: EvidenceTarget) => void }) {
  const { t, locale } = useI18n();
  const maps = useMaps(data);
  const list = ids.map((id) => maps.entries.get(id)).filter((e): e is Entry => Boolean(e));
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
  const order = sorted.map((e) => e.id);
  const groups = new Map<string, Entry[]>();
  for (const e of sorted) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  const sales = list.filter((e) => e.type === "sale").reduce((s, e) => s + e.amount, 0);
  const expenses = list.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);

  if (!list.length) return <p className="py-10 text-center text-ink-3">{t.evidence.empty}</p>;

  return (
    <div>
      {subtitle ? <p className="mb-3 text-[13.5px] text-ink-3">{subtitle}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 px-3.5 py-3 ring-1 ring-line">
          <p className="text-[12px] text-ink-3">{t.chart.sales}</p>
          <p className="text-[17px] font-semibold">{formatMoney(sales, locale)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 px-3.5 py-3 ring-1 ring-line">
          <p className="text-[12px] text-ink-3">{t.chart.expenses}</p>
          <p className="text-[17px] font-semibold text-ink-2">{expenses ? `−${formatMoney(expenses, locale)}` : "—"}</p>
        </div>
      </div>
      <p className="mb-3 mt-2 text-[12.5px] text-ink-3">{t.common.lines(list.length)}</p>
      <div className="space-y-4">
        {[...groups.entries()].map(([date, items]) => (
          <section key={date}>
            <div className="sticky top-0 z-10 flex items-baseline justify-between bg-surface/95 py-1.5 backdrop-blur">
              <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{formatDate(date, locale, "weekday")}</h3>
              <span className="text-[12.5px] text-ink-3 tabular">
                {formatMoney(items.filter((e) => e.type === "sale").reduce((s, e) => s + e.amount, 0), locale)}
              </span>
            </div>
            <ul className="overflow-hidden rounded-xl ring-1 ring-line">
              {items.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => push({ type: "entry", id: e.id, siblings: order })}
                    className="flex w-full items-center gap-3 border-b border-line bg-surface px-3.5 py-3 text-left transition-colors last:border-0 hover:bg-surface-2"
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", e.type === "sale" ? "bg-chart-1" : "bg-line-strong")} />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{e.description}</span>
                    {e.original ? <Icon name="pencil" size={14} className="text-ink-3" /> : null}
                    <span className={cn("text-[14px] font-medium tabular", e.type === "expense" && "text-ink-3")}>
                      {e.type === "expense" ? "−" : ""}
                      {formatMoney(e.amount, locale)}
                    </span>
                    <Icon name="chevronRight" size={16} className="text-ink-3" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function highlightAmount(raw: string, amount: number): ReactNode {
  const g = groupThousands(amount);
  const variants = [g, g.replace(/ /g, ","), g.replace(/ /g, "."), String(amount)];
  for (const v of variants) {
    const i = raw.indexOf(v);
    if (i >= 0) {
      return (
        <>
          {raw.slice(0, i)}
          <mark className="rounded bg-marker px-0.5 text-ink">{v}</mark>
          {raw.slice(i + v.length)}
        </>
      );
    }
  }
  return raw;
}

function MomoView({ data, id, push }: { data: EvidenceData; id: string; push: (t: EvidenceTarget) => void }) {
  const { t, locale } = useI18n();
  const maps = useMaps(data);
  const x = maps.momo.get(id);
  if (!x) return <p className="text-ink-3">{t.errors.not_found}</p>;
  const source = maps.sources.get(x.sourceId);
  const exactEntry = maps.exact.get(x.id);
  const isInflow = x.direction === "in" && x.kind !== "deposit";
  const backed = maps.corroborated.has(x.id);
  const closedDay = data.profile.momo.daysWithoutRecords.includes(x.date);

  return (
    <div className="space-y-5">
      {source?.file && x.box ? (
        <EvidenceImage source={source} highlights={[{ key: x.id, box: x.box }]} focus={x.box} />
      ) : (
        <div className="rounded-2xl rounded-tl-md bg-sunken px-4 py-3.5 text-[14px] leading-6 text-ink-2 ring-1 ring-line">
          {highlightAmount(x.raw, x.amount)}
        </div>
      )}

      <div>
        <Badge tone={x.direction === "in" ? "brand" : "neutral"} icon={x.direction === "in" ? "arrowRight" : "arrowLeft"}>
          {t.evidence.kinds[x.kind]}
        </Badge>
        <p className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
          {x.direction === "out" ? "−" : ""}
          {formatMoney(x.amount, locale)}
        </p>
      </div>

      {x.duplicateOf ? (
        <Notice tone="warn" icon="layers">{t.evidence.duplicateOf}</Notice>
      ) : isInflow ? (
        backed ? (
          <Notice tone="good" icon="checkCircle">{exactEntry ? t.evidence.backedBy : t.evidence.backedDay}</Notice>
        ) : (
          <Notice tone="warn" icon="info">
            {t.evidence.notBacked}. {closedDay ? t.profile.momoClosedDay + "." : ""} {t.profile.momoNotBackedHint}
          </Notice>
        )
      ) : null}

      <dl className="rounded-xl bg-surface-2 px-4 ring-1 ring-line">
        <Detail label={t.evidence.date}>
          {formatDate(x.date, locale, "full")}
          {x.time ? ` · ${x.time}` : ""}
        </Detail>
        <Detail label={t.evidence.provider}>{t.providers[x.provider]}</Detail>
        {x.counterparty ? <Detail label={t.evidence.from}>{x.counterparty}</Detail> : null}
        {x.ref ? <Detail label={t.evidence.reference}><span className="font-mono text-[13px]">{x.ref}</span></Detail> : null}
        {x.fee ? <Detail label="Fee">{formatMoney(x.fee, locale)}</Detail> : null}
      </dl>

      {exactEntry ? (
        <Button variant="secondary" icon="notebook" className="w-full" onClick={() => push({ type: "entry", id: exactEntry })}>
          {t.evidence.openPage}
        </Button>
      ) : null}
    </div>
  );
}

function Notice({ tone, icon, children }: { tone: "good" | "warn"; icon: "checkCircle" | "info" | "layers"; children: ReactNode }) {
  return (
    <div className={cn("flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px] leading-5", tone === "good" ? "bg-good-soft text-good" : "bg-warn-soft text-warn")}>
      <Icon name={icon} size={18} className="mt-px" />
      <span>{children}</span>
    </div>
  );
}

function MomoList({ data, ids, subtitle, push }: { data: EvidenceData; ids: string[]; subtitle?: string; push: (t: EvidenceTarget) => void }) {
  const { t, locale } = useI18n();
  const maps = useMaps(data);
  const list = ids
    .map((id) => maps.momo.get(id))
    .filter((x): x is MomoTx => Boolean(x))
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  const order = list.map((x) => x.id);
  if (!list.length) return <p className="py-10 text-center text-ink-3">{t.evidence.empty}</p>;
  return (
    <div>
      {subtitle ? <p className="mb-3 text-[13.5px] text-ink-3">{subtitle}</p> : null}
      <ul className="overflow-hidden rounded-xl ring-1 ring-line">
        {list.map((x) => {
          const backed = maps.corroborated.has(x.id);
          return (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => push({ type: "momo", id: x.id, siblings: order })}
                className="flex w-full items-center gap-3 border-b border-line bg-surface px-3.5 py-3 text-left transition-colors last:border-0 hover:bg-surface-2"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    x.direction === "in" ? "bg-brand-soft text-brand" : "bg-sunken text-ink-3",
                  )}
                >
                  <Icon name={x.direction === "in" ? "arrowRight" : "arrowLeft"} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{x.counterparty ?? t.evidence.kinds[x.kind]}</span>
                  <span className="block text-[12.5px] text-ink-3">
                    {formatDate(x.date, locale, "weekday")}
                    {x.time ? ` · ${x.time}` : ""} · {t.providers[x.provider]}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[14px] font-medium tabular">{formatMoney(x.amount, locale)}</span>
                  {x.direction === "in" && x.kind !== "deposit" ? (
                    <span className={cn("block text-[12px]", backed ? "text-good" : "text-warn")}>
                      {backed ? t.profile.momoBacked.split(" ")[0] : t.profile.momoNotBacked}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SourceViewPanel({
  data,
  target,
  push,
}: {
  data: EvidenceData;
  target: Extract<EvidenceTarget, { type: "source" }>;
  push: (t: EvidenceTarget) => void;
}) {
  const { t, locale } = useI18n();
  const maps = useMaps(data);
  const source = maps.sources.get(target.id);
  if (!source) return <p className="text-ink-3">{t.errors.not_found}</p>;
  const lines = data.entries.filter((e) => e.sourceId === source.id && e.status !== "rejected").sort((a, b) => a.seq - b.seq);
  const marked = new Set(target.highlight ?? []);
  const highlights: Highlight[] = lines
    .filter((e) => e.box)
    .map((e) => ({ key: e.id, box: e.box as Box, tone: marked.has(e.id) ? "marker" : "faint" }));
  if (target.totalBox) highlights.push({ key: "total", box: target.totalBox, tone: "danger" });
  const focus = target.totalBox ?? lines.find((e) => marked.has(e.id))?.box;
  const checks = source.reading ? pageChecks(lines, source.reading.writtenTotals, source.reading.pageDate) : [];
  const order = lines.map((e) => e.id);

  return (
    <div className="space-y-4">
      <EvidenceImage source={source} highlights={highlights} focus={focus} onBoxClick={(key) => key !== "total" && push({ type: "entry", id: key, siblings: order })} />
      <p className="text-[12.5px] text-ink-3">
        {t.evidence.photographed(formatDateTime(source.createdAt, locale))}
        {source.reading ? ` · ${t.evidence.readIn(source.reading.model, (source.reading.ms / 1000).toFixed(1))}` : ""}
      </p>
      {checks.map((c, i) => (
        <Notice key={i} tone={c.ok ? "good" : "warn"} icon={c.ok ? "checkCircle" : "info"}>
          {c.ok ? t.review.totalOk(formatMoney(c.written, locale)) : t.review.totalBad(formatMoney(c.written, locale), formatMoney(c.computed, locale))}
        </Notice>
      ))}
      <ul className="overflow-hidden rounded-xl ring-1 ring-line">
        {lines.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => push({ type: "entry", id: e.id, siblings: order })}
              className={cn(
                "flex w-full items-center gap-3 border-b border-line px-3.5 py-2.5 text-left text-[14px] transition-colors last:border-0 hover:bg-surface-2",
                marked.has(e.id) ? "bg-marker/40" : "bg-surface",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{e.description}</span>
              <span className={cn("font-medium tabular", e.type === "expense" && "text-ink-3")}>
                {e.type === "expense" ? "−" : ""}
                {formatMoney(e.amount, locale)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
