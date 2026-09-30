"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { Entry, MomoTx } from "@/core/types";
import type { Profile } from "@/core/understand/profile";
import type { AuditedAnswer, EvidenceRef } from "@/core/understand/ask";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useEvidence } from "@/components/evidence/evidence-provider";
import { useI18n } from "@/lib/i18n/context";
import { api, errorText } from "@/lib/api";
import { formatCompact, formatDate, formatNumber, formatRange } from "@/lib/format";
import { cn } from "@/lib/cn";

type AskResult = AuditedAnswer & { model: string; ms: number };

interface Turn {
  id: number;
  question: string;
  status: "thinking" | "done" | "error";
  result?: AskResult;
  error?: string;
}

export function AskCard({
  traderId,
  profile,
  entries,
  momo,
  aiConfigured,
}: {
  traderId: string;
  profile: Profile;
  entries: Entry[];
  momo: MomoTx[];
  aiConfigured: boolean;
}) {
  const { t, locale } = useI18n();
  const evidence = useEvidence();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(1);
  const busy = turns.some((x) => x.status === "thinking");

  const maps = useMemo(
    () => ({ entries: new Map(entries.map((e) => [e.id, e])), momo: new Map(momo.map((x) => [x.id, x])) }),
    [entries, momo],
  );

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    const id = nextId.current++;
    setTurns((list) => [{ id, question: text, status: "thinking" }, ...list]);
    setQuestion("");
    try {
      const result = await api<AskResult>(`/api/traders/${traderId}/ask`, { body: { question: text, locale } });
      setTurns((list) => list.map((x) => (x.id === id ? { ...x, status: "done", result } : x)));
    } catch (err) {
      setTurns((list) => list.map((x) => (x.id === id ? { ...x, status: "error", error: errorText(err, t.errors) } : x)));
    }
  }

  function chipLabel(ref: EvidenceRef): string {
    if (ref.kind === "entry") {
      const e = maps.entries.get(ref.id);
      return e ? `${formatCompact(e.amount, locale)} · ${formatDate(e.date, locale)}` : "?";
    }
    if (ref.kind === "momo") {
      const x = maps.momo.get(ref.id);
      return x ? `${formatCompact(x.amount, locale)} · MoMo` : "?";
    }
    if (ref.kind === "week") return formatDate(ref.key, locale);
    if (ref.kind === "item") return ref.label;
    if (ref.kind === "group") return t.ask.groups[ref.key] ?? ref.key;
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${ref.key}-15T12:00:00Z`),
    );
  }

  function openRef(ref: EvidenceRef) {
    if (ref.kind === "entry") evidence.open({ type: "entry", id: ref.id });
    else if (ref.kind === "momo") evidence.open({ type: "momo", id: ref.id });
    else if (ref.kind === "week") {
      const w = profile.weeks.find((x) => x.key === ref.key);
      if (w) evidence.open({ type: "entries", title: t.evidence.weekTitle(formatRange(w.start, w.end, locale)), ids: w.entryIds });
    } else if (ref.kind === "group") {
      const title = t.ask.groups[ref.key] ?? ref.key;
      const m = profile.momo;
      if (ref.key === "sales") evidence.open({ type: "entries", title, ids: profile.sales.entryIds });
      else if (ref.key === "expenses") evidence.open({ type: "entries", title, ids: profile.expenses.entryIds });
      else if (ref.key === "trend") {
        const keys = new Set(profile.trend?.weekKeys ?? []);
        evidence.open({ type: "entries", title, ids: profile.weeks.filter((w) => keys.has(w.key)).flatMap((w) => w.entryIds) });
      } else if (ref.key === "momo_in") evidence.open({ type: "momoList", title, ids: m.inflowIds });
      else if (ref.key === "momo_backed") evidence.open({ type: "momoList", title, ids: m.corroboratedIds });
      else evidence.open({ type: "momoList", title, ids: m.unmatchedIds });
    } else if (ref.kind === "item") {
      const it = profile.items.find((x) => x.key === ref.key);
      if (it) evidence.open({ type: "entries", title: it.label, ids: it.entryIds });
    } else {
      const mo = profile.months.find((x) => x.key === ref.key);
      if (mo) evidence.open({ type: "entries", title: chipLabel(ref), ids: mo.entryIds });
    }
  }

  return (
    <Card className="no-print overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon name="sparkle" size={17} className="text-brand" />
            {t.ask.title}
          </span>
        }
        subtitle={t.ask.subtitle}
      />
      <div className="px-5 pb-5 pt-4 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 p-1.5 pl-3.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={aiConfigured ? t.ask.placeholder : t.ask.needsKey}
            disabled={!aiConfigured}
            maxLength={300}
            aria-label={t.ask.title}
            className="h-10 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
          />
          <button
            type="submit"
            disabled={!aiConfigured || busy || question.trim().length < 3}
            aria-label={t.ask.send}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink transition-[opacity,transform] active:scale-95 disabled:opacity-35"
          >
            {busy ? <Spinner size={17} /> : <Icon name="send" size={17} />}
          </button>
        </form>

        {aiConfigured && !turns.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {t.ask.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[12.5px] text-ink-2 transition-colors hover:border-brand hover:text-brand"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <m.div key={turn.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-sunken px-3.5 py-2 text-[13.5px] text-ink-2">{turn.question}</p>
                {turn.status === "thinking" ? (
                  <div className="flex items-center gap-2 px-1 text-[13px] text-ink-3">
                    <Spinner size={15} />
                    {t.ask.thinking}
                  </div>
                ) : turn.status === "error" ? (
                  <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">{turn.error}</p>
                ) : turn.result ? (
                  <Answer result={turn.result} chipLabel={chipLabel} openRef={openRef} />
                ) : null}
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  );
}

function Answer({
  result,
  chipLabel: label,
  openRef: open,
}: {
  result: AskResult;
  chipLabel: (r: EvidenceRef) => string;
  openRef: (r: EvidenceRef) => void;
}) {
  const { t, locale } = useI18n();
  const refs = new Map(result.citations.map((c) => [c.code, c.ref]));
  return (
    <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3.5">
      {!result.answerable ? <p className="mb-1.5 text-[12.5px] font-medium text-warn">{t.ask.unanswerable}</p> : null}
      <p className="text-[14.5px] leading-7 text-ink">
        {result.segments.map((s, i) => {
          if (s.type === "text") return <span key={i}>{s.text}</span>;
          const ref = refs.get(s.code);
          if (!ref) return null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => open(ref)}
              className="mx-0.5 inline-flex h-6 translate-y-[-1px] items-center gap-1 rounded-md bg-marker px-1.5 align-middle text-[11.5px] font-semibold text-ink transition-[filter] hover:brightness-95"
            >
              <Icon
                name={
                  ref.kind === "momo"
                    ? "message"
                    : ref.kind === "entry"
                      ? "highlighter"
                      : ref.kind === "item"
                        ? "store"
                        : ref.kind === "group"
                          ? ref.key.startsWith("momo")
                            ? "wallet"
                            : "layers"
                          : "calendar"
                }
                size={12}
                strokeWidth={2}
              />
              {label(ref)}
            </button>
          );
        })}
      </p>
      {result.uncited ? (
        <p className="mt-2.5 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] leading-5 text-warn">
          <Icon name="info" size={15} className="mt-0.5" />
          {t.ask.uncited}
        </p>
      ) : null}
      {result.untraced.length ? (
        <p className="mt-2.5 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] leading-5 text-warn">
          <Icon name="alert" size={15} className="mt-0.5" />
          {t.ask.untraced(result.untraced.map((n) => formatNumber(n, locale)).join(", "))}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
        <Badge tone={result.confidence === "high" ? "good" : result.confidence === "medium" ? "neutral" : "warn"}>{t.ask.confidence[result.confidence]}</Badge>
        <span className={cn("tabular")}>{t.ask.meta(result.model, (result.ms / 1000).toFixed(1))}</span>
      </div>
    </div>
  );
}
