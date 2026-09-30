"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import type { Box, DemoPage, Entry, EntryType, IsoDate, Source } from "@/core/types";
import { blockingIssues, dateFlags, liveFlags, needsAttention, pageChecks } from "@/core/refine/flags";
import { parseAmount } from "@/core/money";
import { addDays } from "@/core/dates";
import { EvidenceImage, type Highlight } from "@/components/evidence/evidence-image";
import { NotebookPage } from "@/components/evidence/notebook-page";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { api, ApiError, errorText } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface ReviewPage {
  id: string;
  kind: Source["kind"];
  status: Source["status"];
  file?: Source["file"];
  demo?: DemoPage;
  createdAt: string;
  confirmedAt?: string;
  reading?: Source["reading"];
}

export interface Overlap {
  earlier: string;
  later: string;
  earlierDate?: string;
}

type Filter = "todo" | "done" | "all";

const isTodo = (p: ReviewPage) => p.status === "read" && !p.confirmedAt;
type Draft = { date: string; description: string; amount: string; type: EntryType };

export function ReviewBoard({
  traderId,
  pages: initialPages,
  entries: initialEntries,
  overlaps: initialOverlaps,
  aiConfigured,
  today,
}: {
  traderId: string;
  pages: ReviewPage[];
  entries: Entry[];
  overlaps: Overlap[];
  aiConfigured: boolean;
  today: IsoDate;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [entries, setEntries] = useState(initialEntries);
  const [overlaps, setOverlaps] = useState(initialOverlaps);
  const [filter, setFilter] = useState<Filter>("todo");
  const [pageId, setPageId] = useState<string | null>(
    () => initialPages.find((p) => p.status === "read" && !p.confirmedAt)?.id ?? initialPages[0]?.id ?? null,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problemIds, setProblemIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const byPage = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) map.set(e.sourceId, [...(map.get(e.sourceId) ?? []), e]);
    for (const list of map.values()) list.sort((a, b) => a.seq - b.seq);
    return map;
  }, [entries]);

  const visiblePages = pages.filter((p) => (filter === "todo" ? isTodo(p) : filter === "done" ? Boolean(p.confirmedAt) : true));
  const page = pages.find((p) => p.id === pageId) ?? null;
  const lines = page ? (byPage.get(page.id) ?? []) : [];
  const done = pages.filter((p) => p.confirmedAt).length;
  const readable = pages.filter((p) => p.status === "read").length;
  const blocking = lines.filter((e) => e.status === "pending" && blockingIssues(e, today).length);
  const checks = page?.reading ? pageChecks(lines, page.reading.writtenTotals, page.reading.pageDate) : [];
  const overlap = page ? overlaps.find((o) => o.later === page.id) : undefined;
  const pageIndex = page ? visiblePages.findIndex((p) => p.id === page.id) : -1;

  /* ---------- navigation ---------- */

  const goPage = useCallback((id: string | null) => {
    setPageId(id);
    setSelected(null);
    setEditing(null);
    setProblemIds([]);
    listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const nextTodo = useCallback(
    (after: string) => {
      const order = pages.filter(isTodo);
      const idx = pages.findIndex((p) => p.id === after);
      return order.find((p) => pages.indexOf(p) > idx) ?? order.find((p) => p.id !== after) ?? null;
    },
    [pages],
  );

  /* ---------- mutations ---------- */

  const replaceEntry = (e: Entry) => setEntries((list) => list.map((x) => (x.id === e.id ? e : x)));

  async function saveEntry(entry: Entry, draft: Draft) {
    const amount = parseAmount(draft.amount);
    if (amount === null || amount <= 0) {
      toast(t.flags.amount_missing.long, "danger");
      return;
    }
    if (dateFlags(draft.date as IsoDate, today).length) {
      toast(t.flags[dateFlags(draft.date as IsoDate, today)[0]].long, "danger");
      return;
    }
    setBusy(entry.id);
    try {
      const updated = await api<Entry>(`/api/entries/${entry.id}`, {
        method: "PATCH",
        body: { date: draft.date, description: draft.description.trim(), amount, type: draft.type },
      });
      replaceEntry(updated);
      setEditing(null);
      setProblemIds((ids) => ids.filter((id) => id !== entry.id));
      toast(t.review.toast.saved);
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(entry: Entry, status: "rejected" | "pending") {
    setBusy(entry.id);
    try {
      const updated = await api<Entry>(`/api/entries/${entry.id}`, { method: "PATCH", body: { status } });
      replaceEntry(updated);
      toast(status === "rejected" ? t.review.toast.removed : t.review.toast.restored, "neutral");
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function addLine(draft: Draft) {
    if (!page) return;
    const amount = parseAmount(draft.amount);
    if (amount === null || amount <= 0 || !draft.description.trim() || dateFlags(draft.date as IsoDate, today).length) {
      toast(t.errors.invalid_input, "danger");
      return;
    }
    setBusy("new");
    try {
      const created = await api<Entry>("/api/entries", {
        body: { sourceId: page.id, date: draft.date, description: draft.description.trim(), amount, type: draft.type },
      });
      setEntries((list) => [...list, created]);
      setEditing(null);
      setSelected(created.id);
      toast(t.review.toast.added);
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function confirmPage() {
    if (!page) return;
    if (blocking.length) {
      setProblemIds(blocking.map((e) => e.id));
      setSelected(blocking[0].id);
      return;
    }
    setBusy("page");
    try {
      const s = await api<Source>(`/api/sources/${page.id}/confirm`, { method: "POST" });
      setPages((list) => list.map((p) => (p.id === page.id ? { ...p, confirmedAt: s.confirmedAt } : p)));
      setEntries((list) =>
        list.map((e) => (e.sourceId === page.id && e.status === "pending" ? { ...e, status: "confirmed", confirmedAt: s.confirmedAt } : e)),
      );
      toast(t.review.toast.pageConfirmed);
      router.refresh();
      const next = nextTodo(page.id);
      window.setTimeout(() => goPage(next?.id ?? page.id), 380);
    } catch (err) {
      if (err instanceof ApiError && err.code === "page_has_issues") {
        const ids = ((err.details as { entries?: { id: string }[] } | undefined)?.entries ?? []).map((x) => x.id);
        setProblemIds(ids);
      }
      toast(errorText(err, t.errors), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function rereadPage() {
    if (!page) return;
    setBusy("read");
    try {
      const r = await api<{ source: Source; entries: Entry[] }>(`/api/sources/${page.id}/read`, { method: "POST" });
      setEntries((list) => [...list.filter((e) => !(e.sourceId === page.id && e.origin === "ai")), ...r.entries]);
      setPages((list) => list.map((p) => (p.id === page.id ? { ...p, status: r.source.status, reading: r.source.reading } : p)));
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function deletePage() {
    if (!page || !window.confirm(t.review.deleteConfirm)) return;
    setBusy("page");
    try {
      await api(`/api/sources/${page.id}`, { method: "DELETE" });
      const next = nextTodo(page.id);
      setPages((list) => list.filter((p) => p.id !== page.id));
      setEntries((list) => list.filter((e) => e.sourceId !== page.id));
      toast(t.review.toast.deleted, "neutral");
      goPage(next?.id ?? null);
      router.refresh();
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function markDistinct(o: Overlap) {
    try {
      await api(`/api/sources/${o.later}/distinct`, { body: { otherId: o.earlier } });
      setOverlaps((list) => list.filter((x) => !(x.later === o.later && x.earlier === o.earlier)));
      toast(t.review.toast.distinct);
      router.refresh();
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    }
  }

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (editing || target.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const ids = lines.map((x) => x.id);
      const idx = selected ? ids.indexOf(selected) : -1;
      const current = lines.find((x) => x.id === selected);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(ids[Math.min(ids.length - 1, idx + 1)] ?? null);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(ids[Math.max(0, idx - 1)] ?? null);
      } else if ((e.key === "e" || e.key === "Enter") && current && current.status !== "rejected") {
        e.preventDefault();
        setEditing(current.id);
      } else if (e.key === "x" && current) {
        e.preventDefault();
        void setStatus(current, current.status === "rejected" ? "pending" : "rejected");
      } else if (e.key === "c" && page && isTodo(page)) {
        e.preventDefault();
        void confirmPage();
      } else if (e.key === "]" || e.key === "ArrowRight") {
        const n = visiblePages[pageIndex + 1];
        if (n) goPage(n.id);
      } else if (e.key === "[" || e.key === "ArrowLeft") {
        const p = visiblePages[pageIndex - 1];
        if (p) goPage(p.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------- render ---------- */

  if (!pages.length) {
    return (
      <div className="rounded-3xl border border-dashed border-line-strong px-6 py-16 text-center">
        <Icon name="notebook" size={30} className="mx-auto text-ink-3" />
        <p className="mt-3 text-[15px] text-ink-2">{t.review.empty}</p>
        <ButtonLink href={`/trader/${traderId}/capture`} className="mt-5" icon="camera">
          {t.hub.capture.cta}
        </ButtonLink>
      </div>
    );
  }

  const selectedEntry = lines.find((e) => e.id === selected);
  const highlights: Highlight[] = lines
    .filter((e) => e.box && e.status !== "rejected")
    .map((e) => ({
      key: e.id,
      box: e.box as Box,
      tone: e.id === selected ? "marker" : problemIds.includes(e.id) ? "danger" : "faint",
    }));
  const failingTotal = checks.find((c) => !c.ok);
  if (failingTotal?.box && !selected) highlights.push({ key: "total", box: failingTotal.box, tone: "danger" });

  return (
    <div>
      {/* progress + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink-2">{t.review.progress(done, readable)}</p>
          <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-brand-soft">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${readable ? (done / readable) * 100 : 0}%` }} />
          </div>
        </div>
        <Segmented
          label="Filter"
          size="sm"
          value={filter}
          onChange={(f) => {
            setFilter(f);
            const first = pages.find((p) => (f === "todo" ? isTodo(p) : f === "done" ? Boolean(p.confirmedAt) : true));
            if (first && !(page && (f === "all" || (f === "todo" ? isTodo(page) : Boolean(page.confirmedAt))))) goPage(first.id);
          }}
          options={[
            { value: "todo", label: `${t.review.filters.todo} · ${pages.filter(isTodo).length}` },
            { value: "done", label: t.review.filters.done },
            { value: "all", label: t.review.filters.all },
          ]}
        />
      </div>

      {/* page strip */}
      <div className="-mx-4 mt-5 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:-mx-6 sm:px-6">
        <ul className="flex gap-2.5">
          {visiblePages.map((p) => {
            const pl = byPage.get(p.id) ?? [];
            const attention = pl.filter((e) => needsAttention(e, today)).length;
            const on = p.id === pageId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => goPage(p.id)}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "relative block h-[92px] w-[70px] overflow-hidden rounded-xl bg-sunken ring-1 transition-[box-shadow,transform] duration-200",
                    on ? "ring-2 ring-brand ring-offset-2 ring-offset-bg" : "ring-line hover:-translate-y-0.5",
                  )}
                >
                  {p.demo ? (
                    <NotebookPage page={p.demo} detailed={false} className="h-full w-full" />
                  ) : p.file ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private evidence thumbnail
                    <img src={`/api/sources/${p.id}/image`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-4 text-left text-[10.5px] font-medium text-white">
                    {p.reading?.pageDate ? formatDate(p.reading.pageDate, locale) : p.status !== "read" ? "…" : t.review.noDate}
                  </span>
                  {p.confirmedAt ? (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-good text-white shadow">
                      <Icon name="check" size={12} strokeWidth={3} />
                    </span>
                  ) : attention ? (
                    <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1 text-[10.5px] font-bold text-white shadow">
                      {attention}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {filter === "todo" && !visiblePages.length ? (
        <m.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 rounded-3xl border border-line bg-surface px-6 py-14 text-center shadow-card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good">
            <Icon name="check" size={28} strokeWidth={2.5} />
          </span>
          <p className="mt-4 text-[20px] font-semibold">{t.review.allDone}</p>
          <p className="mt-1 text-[14px] text-ink-3">{t.review.allDoneBody}</p>
          <ButtonLink href={`/trader/${traderId}/profile`} className="mt-6" iconRight="arrowRight">
            {t.review.seeProfile}
          </ButtonLink>
        </m.div>
      ) : page ? (
        <div ref={listRef} className="mt-5 grid scroll-mt-24 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* page image */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <EvidenceImage
              source={page}
              highlights={highlights}
              focus={selectedEntry?.box ?? (failingTotal && !selected ? failingTotal.box : undefined)}
              maxHeight="calc(100dvh - 8rem)"
              onBoxClick={(key) => key !== "total" && setSelected(key)}
            />
            <p className="mt-2 text-[12px] text-ink-3">
              {t.evidence.photographed(formatDateTime(page.createdAt, locale))}
              {page.reading ? ` · ${t.evidence.readIn(page.reading.model, (page.reading.ms / 1000).toFixed(1))}` : ""}
            </p>
          </div>

          {/* lines */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  {pageIndex >= 0 ? t.review.pageOf(pageIndex + 1, visiblePages.length) : t.evidence.page}
                </p>
                <h2 className="mt-0.5 text-[20px] font-semibold tracking-[-0.01em]">
                  {page.reading?.pageDate ? formatDate(page.reading.pageDate, locale, "full") : t.review.noDate}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <IconButton icon="chevronLeft" label={t.common.back} disabled={pageIndex <= 0} onClick={() => goPage(visiblePages[pageIndex - 1]?.id ?? null)} />
                <IconButton
                  icon="chevronRight"
                  label={t.common.continue}
                  disabled={pageIndex < 0 || pageIndex >= visiblePages.length - 1}
                  onClick={() => goPage(visiblePages[pageIndex + 1]?.id ?? null)}
                />
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {page.status !== "read" ? (
                <Banner tone="warn" icon="history">
                  {t.review.waitingRead}
                </Banner>
              ) : null}
              {page.reading?.document === "other" ? (
                <Banner tone="warn" icon="alert">
                  {t.review.notRecord}
                </Banner>
              ) : null}
              {page.reading?.note ? (
                <Banner tone="neutral" icon="info">
                  {t.review.readerNote(page.reading.note)}
                </Banner>
              ) : null}
              {checks.map((c, i) => (
                <Banner key={i} tone={c.ok ? "good" : "warn"} icon={c.ok ? "checkCircle" : "alert"}>
                  {c.ok ? t.review.totalOk(formatMoney(c.written, locale)) : t.review.totalBad(formatMoney(c.written, locale), formatMoney(c.computed, locale))}
                </Banner>
              ))}
              {overlap ? (
                <Banner tone="warn" icon="layers">
                  <span className="block">{t.review.overlap(overlap.earlierDate ? formatDate(overlap.earlierDate, locale, "long") : "…")}</span>
                  <button type="button" onClick={() => markDistinct(overlap)} className="mt-1.5 font-semibold underline underline-offset-2">
                    {t.review.overlapAction}
                  </button>
                </Banner>
              ) : null}
            </div>

            <ul className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <AnimatePresence initial={false}>
                {lines.map((e) => (
                  <LineRow
                    key={e.id}
                    entry={e}
                    today={today}
                    selected={e.id === selected}
                    problem={problemIds.includes(e.id)}
                    editing={editing === e.id}
                    busy={busy === e.id}
                    onSelect={() => setSelected(e.id)}
                    onEdit={() => {
                      setSelected(e.id);
                      setEditing(e.id);
                    }}
                    onCancel={() => setEditing(null)}
                    onSave={(d) => saveEntry(e, d)}
                    onReject={() => setStatus(e, "rejected")}
                    onRestore={() => setStatus(e, "pending")}
                  />
                ))}
              </AnimatePresence>
              {editing === "new" ? (
                <li className="border-t border-line bg-surface-2 p-4">
                  <LineForm
                    initial={{ date: page.reading?.pageDate ?? addDays(today, -1), description: "", amount: "", type: "sale" }}
                    today={today}
                    submitLabel={t.review.form.add}
                    busy={busy === "new"}
                    onCancel={() => setEditing(null)}
                    onSubmit={addLine}
                  />
                </li>
              ) : null}
            </ul>

            {page.status === "read" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon="plus" onClick={() => setEditing("new")} disabled={editing === "new"}>
                  {t.review.addLine}
                </Button>
                {!page.confirmedAt && aiConfigured && page.file ? (
                  <Button variant="ghost" size="sm" icon="refresh" loading={busy === "read"} onClick={rereadPage}>
                    {t.review.reread}
                  </Button>
                ) : null}
                <Button variant="danger" size="sm" icon="trash" onClick={deletePage}>
                  {t.review.deletePage}
                </Button>
              </div>
            ) : null}

            <p className="mt-4 hidden items-center gap-2 text-[12px] text-ink-3 lg:flex">
              <Icon name="keyboard" size={15} />
              {t.review.keyboard}
            </p>

            {/* confirm bar */}
            <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mt-5">
              {page.confirmedAt ? (
                <div className="flex items-center gap-2.5 rounded-2xl bg-good-soft px-4 py-3.5 text-[14px] font-medium text-good">
                  <Icon name="checkCircle" size={19} />
                  {t.review.confirmedOn(formatDateTime(page.confirmedAt, locale))}
                </div>
              ) : page.status === "read" ? (
                <div className="rounded-2xl bg-bg/80 p-1 backdrop-blur">
                  <Button size="lg" className="w-full shadow-float" icon="check" loading={busy === "page"} onClick={confirmPage}>
                    {t.review.confirmPage}
                  </Button>
                  {blocking.length ? (
                    <p className="mt-2 text-center text-[12.5px] font-medium text-warn">{t.review.confirmBlocked(blocking.length)}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Banner({ tone, icon, children }: { tone: "good" | "warn" | "neutral"; icon: "checkCircle" | "alert" | "info" | "layers" | "history"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-xl px-4 py-3 text-[13.5px] leading-5",
        tone === "good" ? "bg-good-soft text-good" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-sunken text-ink-2",
      )}
    >
      <Icon name={icon} size={18} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function LineRow({
  entry: e,
  today,
  selected,
  problem,
  editing,
  busy,
  onSelect,
  onEdit,
  onCancel,
  onSave,
  onReject,
  onRestore,
}: {
  entry: Entry;
  today: IsoDate;
  selected: boolean;
  problem: boolean;
  editing: boolean;
  busy: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (d: Draft) => void;
  onReject: () => void;
  onRestore: () => void;
}) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLLIElement>(null);
  const flags = e.status === "pending" ? liveFlags(e, today) : [];
  const rejected = e.status === "rejected";

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <m.li
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "border-b border-line last:border-0 transition-colors",
        selected && !editing && "bg-marker/35",
        problem && !selected && "bg-danger-soft",
      )}
    >
      {editing ? (
        <div className="bg-surface-2 p-4">
          {e.raw ? <p className="mb-3 text-[12.5px] text-ink-3">{t.review.aiRead(e.raw)}</p> : null}
          <LineForm
            initial={{ date: e.date, description: e.description, amount: String(e.amount || ""), type: e.type }}
            today={today}
            submitLabel={t.review.form.save}
            busy={busy}
            onCancel={onCancel}
            onSubmit={onSave}
          />
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3">
          <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn("truncate text-[14.5px] font-medium", rejected && "text-ink-3 line-through")}>{e.description}</span>
              <span className={cn("shrink-0 text-[14.5px] font-semibold tabular", rejected && "text-ink-3 line-through", e.type === "expense" && !rejected && "text-ink-2")}>
                {e.type === "expense" ? "−" : ""}
                {e.amount ? formatMoney(e.amount, locale) : "—"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
              <span className={cn("h-1.5 w-1.5 rounded-full", e.type === "sale" ? "bg-chart-1" : "bg-line-strong")} />
              <span>{e.type === "sale" ? t.common.sale : t.common.expense}</span>
              <span>·</span>
              <span>{e.date ? formatDate(e.date, locale) : t.review.noDate}</span>
              {e.status === "confirmed" && !e.original && e.origin === "ai" ? <Icon name="check" size={13} className="text-good" /> : null}
              {e.original ? <Badge tone="info" className="h-5 px-2 text-[11px]">{t.review.corrected}</Badge> : null}
              {e.origin === "trader" ? <Badge tone="brand" className="h-5 px-2 text-[11px]">{t.review.addedByYou}</Badge> : null}
              {rejected ? <Badge className="h-5 px-2 text-[11px]">{t.review.removed}</Badge> : null}
              {flags.map((f) => (
                <Badge key={f} tone={f === "amount_computed" ? "info" : "warn"} className="h-5 px-2 text-[11px]" title={t.flags[f]?.long}>
                  {t.flags[f]?.short ?? f}
                </Badge>
              ))}
            </div>
          </button>
          {(
            <div className="flex shrink-0 items-center">
              {rejected ? (
                <IconButton icon="undo" label={t.review.restore} onClick={onRestore} disabled={busy} size={34} />
              ) : (
                <>
                  <IconButton icon="pencil" label={t.common.edit} onClick={onEdit} disabled={busy} size={34} />
                  <IconButton icon="trash" label={t.review.reject} onClick={onReject} disabled={busy} size={34} />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </m.li>
  );
}

function LineForm({
  initial,
  today,
  submitLabel,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: Draft;
  today: IsoDate;
  submitLabel: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (d: Draft) => void;
}) {
  const { t } = useI18n();
  const [d, setD] = useState<Draft>(initial);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(d);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-3">{t.review.form.description}</span>
          <Input ref={first} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} className="h-10" />
        </label>
        <label className="block w-32">
          <span className="mb-1 block text-[12px] font-medium text-ink-3">{t.review.form.amount}</span>
          <Input
            value={d.amount}
            onChange={(e) => setD({ ...d, amount: e.target.value })}
            inputMode="numeric"
            className="h-10 text-right tabular"
            placeholder="0"
          />
        </label>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-3">{t.review.form.date}</span>
          <Input type="date" value={d.date} max={today} min={addDays(today, -400)} onChange={(e) => setD({ ...d, date: e.target.value })} className="h-10" />
        </label>
        <Segmented
          label={t.review.form.type}
          size="sm"
          value={d.type}
          onChange={(type) => setD({ ...d, type })}
          options={[
            { value: "sale", label: t.common.sale },
            { value: "expense", label: t.common.expense },
          ]}
          className="mb-0.5"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" size="sm" icon="check" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
