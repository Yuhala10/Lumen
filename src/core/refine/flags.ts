import type { Entry, EntryFlag, IsoDate, PageCheck, WrittenTotal } from "../types.ts";
import { daysBetween } from "../dates.ts";

/**
 * Refine: the rules that decide which lines need a person, kept free of any
 * AI or validation library so the review screen can run them instantly.
 */

/** A page cannot be confirmed while any of its lines has one of these. */
export const BLOCKING_FLAGS: readonly EntryFlag[] = ["date_missing", "amount_missing", "date_out_of_range"];

/** Flags that deserve the trader's eyes before confirming. */
export const ATTENTION_FLAGS: readonly EntryFlag[] = [
  "low_confidence",
  "date_missing",
  "date_out_of_range",
  "amount_missing",
  "amount_computed",
  "math_mismatch",
  "unusual_amount",
];

export function dateFlags(date: IsoDate | "", today: IsoDate): EntryFlag[] {
  if (!date) return ["date_missing"];
  const age = daysBetween(date, today);
  if (age < -1 || age > 400) return ["date_out_of_range"];
  return [];
}

/** Compares the totals a trader wrote with the lines Trust read on the same page. */
export function pageChecks(
  entries: Array<Pick<Entry, "date" | "amount" | "type" | "status">>,
  totals: WrittenTotal[],
  pageDate?: IsoDate,
): PageCheck[] {
  const live = entries.filter((e) => e.status !== "rejected" && e.amount > 0);
  const dates = new Set(live.map((e) => e.date).filter(Boolean));
  return totals.map((t) => {
    const scope = t.date && dates.size > 1 ? live.filter((e) => e.date === t.date) : live;
    const computed = scope.filter((e) => e.type === t.type).reduce((s, e) => s + e.amount, 0);
    const difference = t.amount - computed;
    const tolerance = Math.max(25, Math.round(t.amount * 0.005));
    return {
      kind: "written_total" as const,
      type: t.type,
      date: t.date ?? pageDate,
      written: t.amount,
      computed,
      difference,
      ok: Math.abs(difference) <= tolerance,
      box: t.box,
    };
  });
}

/** Flags as they stand now: date and amount problems are re-checked live. */
export function liveFlags(entry: Pick<Entry, "date" | "amount" | "flags">, today: IsoDate): EntryFlag[] {
  const stable = entry.flags.filter(
    (f) => f !== "date_missing" && f !== "date_out_of_range" && f !== "amount_missing",
  );
  const live = [...dateFlags(entry.date, today)];
  if (entry.amount <= 0) live.push("amount_missing");
  return [...stable, ...live];
}

export function blockingIssues(entry: Pick<Entry, "date" | "amount" | "flags" | "status">, today: IsoDate): EntryFlag[] {
  if (entry.status === "rejected") return [];
  return liveFlags(entry, today).filter((f) => BLOCKING_FLAGS.includes(f));
}

export function needsAttention(entry: Pick<Entry, "date" | "amount" | "flags" | "status">, today: IsoDate): boolean {
  if (entry.status !== "pending") return false;
  return liveFlags(entry, today).some((f) => ATTENTION_FLAGS.includes(f));
}

/**
 * After the trader edits a line, only hard problems remain: a person has
 * now vouched for the reading, so the AI's uncertainty no longer applies.
 */
export function flagsAfterTraderEdit(values: { date: IsoDate | ""; amount: number }, today: IsoDate): EntryFlag[] {
  const flags = [...dateFlags(values.date, today)];
  if (values.amount <= 0) flags.push("amount_missing");
  return flags;
}
