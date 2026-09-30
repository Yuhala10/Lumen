import type { Box, EntryFlag, EntryType, IsoDate, MomoDirection, MomoKind, Provider, WrittenTotal } from "../types.ts";
import { MomoReadingSchema, PageReadingSchema } from "./schema.ts";
import { isIsoDate, parseLooseDate } from "../dates.ts";
import { dateFlags } from "./flags.ts";
import { collapseSpaces } from "../text.ts";
import { TrustError } from "../errors.ts";

/**
 * Refine: turn what the AI read into entries Trust can stand behind.
 *
 * The AI only transcribes. This module decides dates, computes any missing
 * amounts, checks the arithmetic, and flags anything a person must look at.
 */

/** Below this confidence a line always goes to the trader for review. */
export const REVIEW_THRESHOLD = 0.8;
export const MAX_LINES_PER_PAGE = 80;
const MAX_REASONABLE_AMOUNT = 5_000_000;

export interface EntryDraft {
  seq: number;
  date: IsoDate | "";
  description: string;
  amount: number;
  type: EntryType;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  raw: string;
  box?: Box;
  confidence: number;
  flags: EntryFlag[];
}

export interface RefinedPage {
  document: string;
  legible: boolean;
  language?: string;
  note?: string;
  pageDate?: IsoDate;
  entries: EntryDraft[];
  writtenTotals: WrittenTotal[];
}

export interface MomoDraft {
  provider: Provider | "unknown";
  direction: MomoDirection;
  kind: MomoKind;
  amount: number;
  fee?: number;
  balance?: number;
  date: IsoDate;
  time?: string;
  ref?: string;
  counterparty?: string;
  raw: string;
  box?: Box;
  confidence: number;
}

export interface RefinedMomo {
  document: string;
  legible: boolean;
  note?: string;
  transactions: MomoDraft[];
  unread: { raw: string; reason: "no_amount" | "no_direction" | "no_date" }[];
}

export function normalizeBox(value: unknown): Box | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  if (!value.every((v) => typeof v === "number" && Number.isFinite(v))) return undefined;
  let nums = value as number[];
  // Some models answer in 0–1 instead of 0–1000.
  if (nums.every((v) => v >= 0 && v <= 1.5)) nums = nums.map((v) => v * 1000);
  const c = (v: number) => Math.min(1000, Math.max(0, Math.round(v)));
  const [a, b, d, e] = nums;
  const ymin = c(Math.min(a, d));
  const ymax = c(Math.max(a, d));
  const xmin = c(Math.min(b, e));
  const xmax = c(Math.max(b, e));
  if (ymax - ymin < 2 || xmax - xmin < 2) return undefined;
  return [ymin, xmin, ymax, xmax];
}

export function normalizeConfidence(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0.5;
  const scaled = v > 1 && v <= 100 ? v / 100 : v;
  return Math.round(Math.min(1, Math.max(0, scaled)) * 100) / 100;
}

/**
 * Written date text wins over the model's ISO guess: the code applies one
 * consistent day-first rule and one consistent year rule.
 */
export function resolveDate(text: string, isoGuess: string, today: IsoDate): IsoDate | null {
  return parseLooseDate(text, today) ?? (isIsoDate(isoGuess) ? isoGuess : null);
}

export function refinePage(raw: unknown, today: IsoDate): RefinedPage {
  const parsed = PageReadingSchema.safeParse(raw);
  if (!parsed.success) throw new TrustError("ai_bad_output", "The reader returned something that is not a page reading.", 502);
  const r = parsed.data;

  const pageDate = resolveDate(r.pageDateText, r.pageDate, today) ?? undefined;
  let running: IsoDate | undefined = pageDate;
  const entries: EntryDraft[] = [];
  const writtenTotals: WrittenTotal[] = [];

  for (const line of r.lines.slice(0, MAX_LINES_PER_PAGE)) {
    const lineDate = resolveDate(line.dateText, line.date, today) ?? undefined;
    const amount = Math.round(line.amount);
    const box = normalizeBox(line.box);
    const text = collapseSpaces(line.description || line.rawText).slice(0, 120);

    const isHeader = line.kind === "date_header" || (line.kind === "other" && amount <= 0 && lineDate);
    if (isHeader) {
      if (lineDate) running = lineDate;
      continue;
    }
    if (lineDate) running = lineDate;

    if (line.kind === "total_sales" || line.kind === "total_expenses") {
      if (amount > 0) {
        writtenTotals.push({
          label: text || "Total",
          amount,
          type: line.kind === "total_sales" ? "sale" : "expense",
          date: lineDate ?? running,
          box,
        });
      }
      continue;
    }
    if (line.kind !== "sale" && line.kind !== "expense") continue;

    const flags = new Set<EntryFlag>();
    const quantity = line.quantity > 0 ? line.quantity : undefined;
    const unitPrice = line.unitPrice > 0 ? Math.round(line.unitPrice) : undefined;

    let value = amount > 0 ? amount : 0;
    if (value <= 0 && quantity && unitPrice) {
      value = Math.round(quantity * unitPrice);
      flags.add("amount_computed");
    }
    if (value <= 0) flags.add("amount_missing");
    if (quantity && unitPrice && value > 0 && !flags.has("amount_computed")) {
      const expected = quantity * unitPrice;
      if (Math.abs(expected - value) > Math.max(5, value * 0.02)) flags.add("math_mismatch");
    }
    if (value > 0 && (value % 5 !== 0 || value > MAX_REASONABLE_AMOUNT)) flags.add("unusual_amount");

    const date = lineDate ?? running ?? "";
    for (const f of dateFlags(date, today)) flags.add(f);

    let confidence = normalizeConfidence(line.confidence);
    if (flags.has("math_mismatch")) confidence = Math.min(confidence, 0.6);
    if (flags.has("unusual_amount")) confidence = Math.min(confidence, 0.7);
    if (flags.has("amount_computed")) confidence = Math.min(confidence, 0.85);
    if (flags.has("date_missing") || flags.has("amount_missing")) confidence = Math.min(confidence, 0.5);
    if (confidence < REVIEW_THRESHOLD) flags.add("low_confidence");

    entries.push({
      seq: entries.length,
      date,
      description: text || "?",
      amount: value,
      type: line.kind,
      quantity,
      unit: line.unit.trim() || undefined,
      unitPrice,
      raw: collapseSpaces(line.rawText).slice(0, 200),
      box,
      confidence,
      flags: [...flags],
    });
  }

  return {
    document: r.document,
    legible: r.legible,
    language: r.language || undefined,
    note: r.note || undefined,
    pageDate,
    entries,
    writtenTotals,
  };
}

export function refineMomoReading(raw: unknown, today: IsoDate): RefinedMomo {
  const parsed = MomoReadingSchema.safeParse(raw);
  if (!parsed.success) throw new TrustError("ai_bad_output", "The reader returned something that is not a transaction list.", 502);
  const r = parsed.data;
  const transactions: MomoDraft[] = [];
  const unread: RefinedMomo["unread"] = [];

  for (const t of r.transactions.slice(0, MAX_LINES_PER_PAGE)) {
    const rawText = collapseSpaces(t.rawText).slice(0, 400);
    const amount = Math.round(t.amount);
    if (amount <= 0) {
      unread.push({ raw: rawText, reason: "no_amount" });
      continue;
    }
    if (t.direction === "unknown") {
      unread.push({ raw: rawText, reason: "no_direction" });
      continue;
    }
    const date = resolveDate(t.dateText, t.date, today);
    if (!date) {
      unread.push({ raw: rawText, reason: "no_date" });
      continue;
    }
    const kind: MomoKind = t.kind !== "unknown" ? t.kind : t.direction === "in" ? "received" : "sent";
    const time = /^\d{1,2}:\d{2}$/.test(t.time.trim()) ? t.time.trim().padStart(5, "0") : undefined;
    transactions.push({
      provider: t.provider,
      direction: t.direction,
      kind,
      amount,
      fee: t.fee > 0 ? Math.round(t.fee) : undefined,
      balance: t.balance > 0 ? Math.round(t.balance) : undefined,
      date,
      time,
      ref: t.ref.trim() ? t.ref.trim().toUpperCase() : undefined,
      counterparty: t.counterparty.trim() || undefined,
      raw: rawText,
      box: normalizeBox(t.box),
      confidence: normalizeConfidence(t.confidence),
    });
  }

  return { document: r.document, legible: r.legible, note: r.note || undefined, transactions, unread };
}

export {
  ATTENTION_FLAGS,
  BLOCKING_FLAGS,
  blockingIssues,
  dateFlags,
  flagsAfterTraderEdit,
  liveFlags,
  needsAttention,
  pageChecks,
} from "./flags.ts";
