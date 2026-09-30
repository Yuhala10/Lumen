import { z } from "zod";
import type { Entry, Locale, MomoTx, Trader } from "../types.ts";
import type { Profile } from "./profile.ts";
import { groupThousands } from "../money.ts";

/**
 * Understand: answering a lender's question.
 *
 * The AI writes the sentence; the code supplies every number. The evidence
 * pack gives the model pre-computed totals plus every counted line with a
 * short citation code. The answer is then audited: citations must exist, and
 * any figure that cannot be traced back to the pack is reported.
 */

export type EvidenceRef =
  | { kind: "entry"; id: string }
  | { kind: "momo"; id: string }
  | { kind: "week"; key: string }
  | { kind: "month"; key: string };

export interface EvidencePack {
  text: string;
  refs: Record<string, EvidenceRef>;
  numbers: number[];
  percents: number[];
}

const WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function buildEvidencePack(trader: Trader, profile: Profile, counted: Entry[], momo: MomoTx[]): EvidencePack {
  const refs: Record<string, EvidenceRef> = {};
  const numbers = new Set<number>();
  const percents = new Set<number>();
  const n = (v: number) => {
    numbers.add(Math.round(v));
    return groupThousands(v);
  };
  const pct = (v: number) => {
    const p = Math.round(v * 1000) / 10;
    percents.add(p);
    return `${p}%`;
  };
  const lines: string[] = [];

  lines.push(`BUSINESS: ${trader.name}, ${trader.business}, ${trader.market}, ${trader.city}, Cameroon.`);
  lines.push("CURRENCY: FCFA (XAF). Amounts are whole numbers.");
  if (!profile.period) {
    lines.push("No confirmed records yet.");
    return { text: lines.join("\n"), refs, numbers: [], percents: [] };
  }
  const p = profile.period;
  lines.push(`PERIOD: ${p.start} to ${p.end} (${p.days} days, ${p.weeks} weeks).`);

  const s = profile.sales;
  lines.push("SUMMARY (computed by code, use these instead of adding lines yourself):");
  lines.push(`- Total recorded sales: ${n(s.total)}`);
  lines.push(`- Total recorded expenses: ${n(profile.expenses.total)}`);
  lines.push(`- Sales minus expenses: ${n(profile.net)}`);
  lines.push(`- Average weekly sales: ${n(s.avgWeekly)} (over ${s.fullWeeks} full weeks); median week ${n(s.medianWeekly)}`);
  lines.push(`- Average sales per trading day: ${n(s.avgPerActiveDay)}; trading days: ${s.activeDays} (${s.activeDaysPerWeek} per week)`);
  if (s.bestWeek) lines.push(`- Best week: W${s.bestWeek.key} with ${n(s.bestWeek.sales)}`);
  if (profile.trend) {
    const t = profile.trend;
    lines.push(`- Trend: ${t.direction}, ${pct(t.pctPer4Weeks)} per 4 weeks over ${t.weeksUsed} weeks`);
    if (t.recent !== undefined && t.previous !== undefined) {
      lines.push(`- Last 4 weeks average ${n(t.recent)} vs previous 4 weeks ${n(t.previous)}`);
    }
  } else lines.push("- Trend: not enough full weeks to measure");
  if (profile.consistency) lines.push(`- Week-to-week consistency: ${profile.consistency.label.replace("_", " ")}`);
  const m = profile.momo;
  lines.push(
    `- Mobile money customer payments in period: ${m.inflowIds.length} totalling ${n(m.inflowAmount)}; backed by notebook sales: ${n(m.corroboratedAmount)} (${pct(m.rateAmount)}); share of recorded sales paid by mobile money: ${pct(m.shareOfSales)}`,
  );
  lines.push(`- Written daily totals matching the lines: ${profile.checks.passed} of ${profile.checks.total}`);
  lines.push(`- Evidence strength: ${profile.strength.score}/100 (${profile.strength.grade})`);

  lines.push("WEEKS (code | dates | sales | expenses | trading days | note):");
  for (const w of profile.weeks) {
    const code = `W${w.key}`;
    refs[code] = { kind: "week", key: w.key };
    const note = w.gap ? "no records" : w.partial ? "partial week" : "";
    lines.push(`${code} | ${w.start}..${w.end} | ${n(w.sales)} | ${n(w.expenses)} | ${w.activeDays} | ${note}`);
  }

  lines.push("MONTHS (code | sales | expenses | trading days):");
  for (const mo of profile.months) {
    const code = `MO${mo.key}`;
    refs[code] = { kind: "month", key: mo.key };
    lines.push(`${code} | ${n(mo.sales)} | ${n(mo.expenses)} | ${mo.activeDays}`);
  }

  lines.push("ITEMS BY SALES (item | sales | lines | share):");
  for (const it of profile.items) lines.push(`${it.label} | ${n(it.sales)} | ${it.lines} | ${pct(it.share)}`);

  lines.push("WEEKDAYS (day | average sales on trading days | trading days):");
  for (const d of profile.weekdays) if (d.days) lines.push(`${WEEKDAY_NAMES[d.day]} | ${n(d.avgSales)} | ${d.days}`);

  lines.push("LINES (code | date | type | amount | description):");
  const sorted = [...counted].sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
  sorted.forEach((e, i) => {
    const code = `E${i + 1}`;
    refs[code] = { kind: "entry", id: e.id };
    lines.push(`${code} | ${e.date} | ${e.type} | ${n(e.amount)} | ${e.description}`);
  });

  const matched = new Set(m.corroboratedIds);
  lines.push("MOBILE MONEY (code | date time | direction kind | amount | backed by notebook):");
  const sortedMomo = [...momo].sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  sortedMomo.forEach((t, i) => {
    const code = `M${i + 1}`;
    refs[code] = { kind: "momo", id: t.id };
    const backed = t.direction === "in" ? (matched.has(t.id) ? "yes" : t.kind === "deposit" ? "deposit" : "no") : "-";
    lines.push(`${code} | ${t.date} ${t.time ?? ""} | ${t.direction} ${t.kind} | ${n(t.amount)} | ${backed}`);
  });

  return { text: lines.join("\n"), refs, numbers: [...numbers], percents: [...percents] };
}

export function askSystemPrompt(locale: Locale): string {
  const language = locale === "fr" ? "French" : "English";
  return [
    "You are Trust's analyst. A lender is asking about a market trader's business in Cameroon.",
    "Answer ONLY from the evidence pack. Never use outside knowledge about this business.",
    "Rules:",
    "- Prefer the pre-computed SUMMARY, WEEKS, MONTHS, ITEMS and WEEKDAYS figures. Do not add up lines yourself when a total exists.",
    "- Every factual claim must end with citation codes in square brackets, e.g. [W2026-07-20] or [E12, E13]. Use only codes that appear in the pack.",
    "- Write amounts exactly as they appear in the pack, followed by FCFA (e.g. 85 500 FCFA).",
    "- If the pack cannot answer the question, set answerable to false and say briefly what evidence is missing.",
    "- Be concise: at most 4 sentences. Plain language a busy loan officer can read in seconds.",
    "- Never recommend approving or refusing a loan. You describe evidence; the lender decides.",
    `- Write the answer in ${language}, unless the question is clearly written in another language; then use that language.`,
  ].join("\n");
}

export const ASK_JSON_SCHEMA = {
  type: "object",
  properties: {
    answerable: { type: "boolean" },
    answer: { type: "string", description: "The answer with [CODE] citations after each claim." },
    citations: { type: "array", items: { type: "string" }, description: "All codes cited." },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["answerable", "answer", "citations", "confidence"],
} as const;

const AskSchema = z.object({
  answerable: z.boolean().catch(true),
  answer: z.string().catch(""),
  citations: z.array(z.string()).catch([]),
  confidence: z.enum(["high", "medium", "low"]).catch("medium"),
});

export type AnswerSegment = { type: "text"; text: string } | { type: "cite"; code: string };

export interface AuditedAnswer {
  answerable: boolean;
  confidence: "high" | "medium" | "low";
  segments: AnswerSegment[];
  citations: { code: string; ref: EvidenceRef }[];
  untraced: number[];
}

const CODE_RE = /^(E\d+|M\d+|W\d{4}-\d{2}-\d{2}|MO\d{4}-\d{2})$/;

function traced(value: number, pack: EvidencePack): boolean {
  return pack.numbers.some((n) => Math.abs(n - value) <= Math.max(50, Math.abs(n) * 0.01));
}

/** Figures in the answer that do not appear anywhere in the evidence pack. */
export function findUntracedNumbers(text: string, pack: EvidencePack): number[] {
  const cleaned = text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ");
  const out: number[] = [];

  for (const m of cleaned.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)) {
    const v = Number(m[1].replace(",", "."));
    if (!pack.percents.some((p) => Math.abs(p - v) <= 1)) out.push(v);
  }
  const withoutPercents = cleaned.replace(/(\d+(?:[.,]\d+)?)\s?%/g, " ");
  for (const m of withoutPercents.matchAll(/\d{1,3}(?:[   .,]\d{3})+|\d+/g)) {
    const token = m[0];
    const value = Number(token.replace(/[   .,]/g, ""));
    if (!Number.isFinite(value) || value < 100) continue;
    if (/^\d{4}$/.test(token) && value >= 2000 && value <= 2100) continue;
    if (!traced(value, pack)) out.push(value);
  }
  return [...new Set(out)];
}

export function auditAnswer(raw: unknown, pack: EvidencePack): AuditedAnswer {
  const a = AskSchema.parse(typeof raw === "object" && raw !== null ? raw : {});
  const segments: AnswerSegment[] = [];
  const cited: string[] = [];
  const valid = (code: string) => CODE_RE.test(code) && pack.refs[code] !== undefined;

  let last = 0;
  for (const m of a.answer.matchAll(/\[([^\]]{1,200})\]/g)) {
    const index = m.index ?? 0;
    const codes = m[1].split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
    const good = codes.filter(valid);
    const before = a.answer.slice(last, index);
    if (before) segments.push({ type: "text", text: before });
    for (const code of good) {
      segments.push({ type: "cite", code });
      if (!cited.includes(code)) cited.push(code);
    }
    last = index + m[0].length;
  }
  const tail = a.answer.slice(last);
  if (tail) segments.push({ type: "text", text: tail });

  for (const code of a.citations.map((c) => c.trim())) if (valid(code) && !cited.includes(code)) cited.push(code);

  // Tidy spaces left where invalid markers were removed.
  const tidy = segments.map((s) => (s.type === "text" ? { ...s, text: s.text.replace(/\s+([.,;:])/g, "$1") } : s));

  return {
    answerable: a.answerable,
    confidence: a.confidence,
    segments: tidy,
    citations: cited.map((code) => ({ code, ref: pack.refs[code] })),
    untraced: findUntracedNumbers(a.answer, pack),
  };
}
