import type { IsoDate, MomoDirection, MomoKind, Provider } from "../types.ts";
import { parseAmount } from "../money.ts";
import { parseLooseDate } from "../dates.ts";
import { collapseSpaces, stripAccents } from "../text.ts";

/**
 * Discover: mobile money messages.
 *
 * Mobile money SMS follow fixed templates, so plain rules read them more
 * reliably than AI. The parser never guesses: a message without a clear
 * amount, direction or date is returned as unread, with the reason.
 */

export interface ParsedMomo {
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
  phone?: string;
  raw: string;
  confidence: number;
}

export type SmsFailure = "no_amount" | "no_direction" | "no_date";

export type SmsResult =
  | { ok: true; tx: ParsedMomo }
  | { ok: false; raw: string; reason: SmsFailure };

interface DirectionRule {
  re: RegExp;
  direction: MomoDirection;
  kind: MomoKind;
}

/** Checked in order. Specific phrases first, so promotional text does not mislead. */
const RULES: DirectionRule[] = [
  { re: /(recu un depot|depot de|depot effectue|deposit of|cash[ -]?in)/, direction: "in", kind: "deposit" },
  { re: /(retrait de|retrait effectue|withdrawal of|you have withdrawn|cash[ -]?out)/, direction: "out", kind: "withdrawal" },
  { re: /(paiement recu|payment received|received a payment|recu un paiement)/, direction: "in", kind: "payment_in" },
  {
    re: /(vous avez recu|you have received|recu de|received from|transfert recu|transfer received|a ete credite|credite de|been credited|credited with)/,
    direction: "in",
    kind: "received",
  },
  {
    re: /(vous avez paye|you have paid|paid to|paiement de|payment of|paiement effectue|payment made|achat de)/,
    direction: "out",
    kind: "payment_out",
  },
  {
    re: /(vous avez envoye|you have sent|envoye a|sent to|vous avez transfere|transfere a|transferred to|transfer to|transfert de [\d .,]+\s*(?:f\s?cfa|fcfa|xaf|cfa|f)?\s*vers|a ete debite|debite de|been debited|debited)/,
    direction: "out",
    kind: "sent",
  },
];

const AMOUNT_RE =
  /(?:\b(fcfa|xaf|cfa)\s*)?(\d{1,3}(?:[ .,]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(f\s?cfa|fcfa|xaf|cfa|frs?|f)?(?![a-z0-9])/gi;

const BALANCE_BEFORE = /(solde|balance|bal\.?)\s*(disponible|actuel|available|new|nouveau)?\s*(est de|is|de)?\s*[:=]?\s*$/;
const FEE_BEFORE = /(frais|fees?|charges?|commission|taxes?|tax)\s*(de|of)?\s*[:=]?\s*$/;
const NAME_STOP = new Set(["FCFA", "XAF", "CFA", "MTN", "MOMO", "ORANGE", "OM", "ID", "REF", "SOLDE", "BALANCE"]);

interface FoundAmount {
  value: number;
  index: number;
  role: "main" | "fee" | "balance";
}

function findAmounts(norm: string): FoundAmount[] {
  const lower = norm.toLowerCase();
  const found: FoundAmount[] = [];
  for (const m of norm.matchAll(AMOUNT_RE)) {
    if (!m[1] && !m[3]) continue; // a currency marker is required
    const value = parseAmount(m[2]);
    if (value === null || value <= 0) continue;
    const index = m.index ?? 0;
    const before = lower.slice(Math.max(0, index - 32), index);
    const role = BALANCE_BEFORE.test(before) ? "balance" : FEE_BEFORE.test(before) ? "fee" : "main";
    found.push({ value, index, role });
  }
  return found;
}

function detectProvider(lower: string): Provider | "unknown" {
  if (/orange\s*money|\borange\b|\bom\b/.test(lower)) return "orange";
  if (/\bmtn\b|\bmomo\b|mobile\s*money/.test(lower)) return "mtn";
  return "unknown";
}

function detectDirection(lower: string): DirectionRule | undefined {
  return RULES.find((r) => r.re.test(lower));
}

function detectDate(norm: string, today: IsoDate): { date: IsoDate; time?: string } | null {
  const iso = norm.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) {
    const date = parseLooseDate(`${iso[1]}-${iso[2]}-${iso[3]}`, today);
    if (date) return { date, time: iso[4] ? `${iso[4].padStart(2, "0")}:${iso[5]}` : undefined };
  }
  const dmy = norm.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s*(?:a|at|,|-)?\s*(\d{1,2})[:h](\d{2}))?/i);
  if (dmy) {
    const date = parseLooseDate(`${dmy[1]}/${dmy[2]}/${dmy[3]}`, today);
    if (date) return { date, time: dmy[4] ? `${dmy[4].padStart(2, "0")}:${dmy[5]}` : undefined };
  }
  return null;
}

function detectRef(norm: string): string | undefined {
  const m = norm.match(
    /(?:trans(?:action)?\s*id|txn\s*id|id\s*(?:de\s*)?(?:la\s*)?transaction|ref(?:erence)?|\bid)\s*[:#.]?\s*([a-z0-9][a-z0-9.\-]{5,})/i,
  );
  return m ? m[1].replace(/[.\-]+$/, "").toUpperCase() : undefined;
}

function detectPhone(norm: string): string | undefined {
  const m = norm.match(/\(?\+?237\)?[\s.]?(6\d{8})\b/) ?? norm.match(/\((6\d{8})\)/);
  return m ? m[1] : undefined;
}

function detectCounterparty(norm: string): string | undefined {
  const re =
    /\b(?:de|from|a|to|vers|par|by)\s+(?:\(?\+?237\)?\s?\d{9}\)?\s+)?([A-Z][A-Za-z'\-]*\.?(?:\s+[A-Z][A-Za-z'\-]*\.?){0,3})/g;
  for (const m of norm.matchAll(re)) {
    const name = m[1].trim();
    const first = name.split(/\s+/)[0].replace(/\.$/, "");
    if (NAME_STOP.has(first.toUpperCase())) continue;
    if (name.length < 2 || name.length > 40) continue;
    return name;
  }
  return undefined;
}

export function parseSms(raw: string, today: IsoDate): SmsResult {
  const text = collapseSpaces(raw);
  const norm = stripAccents(text);
  const lower = norm.toLowerCase();

  const amounts = findAmounts(norm);
  const main = amounts.find((a) => a.role === "main");
  if (!main) return { ok: false, raw: text, reason: "no_amount" };

  const rule = detectDirection(lower);
  if (!rule) return { ok: false, raw: text, reason: "no_direction" };

  const when = detectDate(norm, today);
  if (!when) return { ok: false, raw: text, reason: "no_date" };

  const provider = detectProvider(lower);
  const ref = detectRef(norm);
  let confidence = 0.97;
  if (!ref) confidence -= 0.12;
  if (provider === "unknown") confidence -= 0.08;
  if (!when.time) confidence -= 0.05;

  return {
    ok: true,
    tx: {
      provider,
      direction: rule.direction,
      kind: rule.kind,
      amount: main.value,
      fee: amounts.find((a) => a.role === "fee")?.value,
      balance: amounts.find((a) => a.role === "balance")?.value,
      date: when.date,
      time: when.time,
      ref,
      counterparty: detectCounterparty(norm),
      phone: detectPhone(norm),
      raw: text,
      confidence: Math.max(0.6, Math.round(confidence * 100) / 100),
    },
  };
}

function looksLikeMessage(line: string): boolean {
  const norm = stripAccents(line);
  return findAmounts(norm).some((a) => a.role === "main") && detectDirection(norm.toLowerCase()) !== undefined;
}

/**
 * Splits a pasted block into individual messages. Blank lines separate
 * messages; a block where most lines are complete messages is split per line.
 */
export function splitMessages(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const out: string[] = [];
  for (const block of normalized.split(/\n\s*\n+/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const complete = lines.filter(looksLikeMessage).length;
    if (lines.length > 1 && complete >= 2 && complete >= lines.length * 0.6) out.push(...lines);
    else out.push(collapseSpaces(lines.join(" ")));
  }
  return out;
}

/** Masks a Cameroonian mobile number for display: 6•• ••• •56 */
export function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const d = phone.replace(/\D/g, "").slice(-9);
  if (d.length !== 9) return undefined;
  return `${d[0]}•• ••• •${d.slice(-2)}`;
}
