import type { IsoDate } from "./types.ts";

/**
 * Calendar-date helpers. Every date is handled as a UTC calendar day so that
 * arithmetic never drifts across time zones. Cameroon is UTC+1 all year.
 */

const DAY_MS = 86_400_000;
const CAMEROON_OFFSET_MS = 60 * 60 * 1000;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function parseIso(value: IsoDate): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** The current calendar date in Cameroon. */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIso(new Date(now.getTime() + CAMEROON_OFFSET_MS));
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return toIso(new Date(parseIso(value).getTime() + days * DAY_MS));
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / DAY_MS);
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function weekday(value: IsoDate): number {
  const d = parseIso(value).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The Monday that starts the week containing this date. */
export function weekStart(value: IsoDate): IsoDate {
  return addDays(value, 1 - weekday(value));
}

export function monthKey(value: IsoDate): string {
  return value.slice(0, 7);
}

export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function minDate(values: IsoDate[]): IsoDate | undefined {
  return values.reduce<IsoDate | undefined>((m, v) => (m === undefined || v < m ? v : m), undefined);
}

export function maxDate(values: IsoDate[]): IsoDate | undefined {
  return values.reduce<IsoDate | undefined>((m, v) => (m === undefined || v > m ? v : m), undefined);
}

const MONTHS: Record<string, number> = {
  jan: 1, janv: 1, janvier: 1, january: 1,
  fev: 2, fevr: 2, fevrier: 2, feb: 2, february: 2,
  mar: 3, mars: 3, march: 3,
  avr: 4, avril: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6, june: 6,
  juil: 7, juillet: 7, jul: 7, july: 7,
  aou: 8, aout: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septembre: 9, september: 9,
  oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11,
  dec: 12, decembre: 12, december: 12,
};

function build(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

/** When the year is not written, pick the most recent occurrence not after tomorrow. */
function withInferredYear(month: number, day: number, today: IsoDate): IsoDate | null {
  const year = Number(today.slice(0, 4));
  const thisYear = build(year, month, day);
  if (thisYear && thisYear <= addDays(today, 1)) return thisYear;
  return build(year - 1, month, day);
}

function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Reads a date the way Cameroonian traders write them: day first
 * ("14/07", "14-07-26", "Lundi 14/07/2026", "14 juillet", "July 14").
 * Returns null rather than guessing when the text is not a clear date.
 */
export function parseLooseDate(text: string, today: IsoDate): IsoDate | null {
  if (!text) return null;
  const s = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!s) return null;

  const iso = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = s.match(/\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{2}|\d{4}))?\b/);
  if (numeric) {
    let day = Number(numeric[1]);
    let month = Number(numeric[2]);
    // Day-first is the rule; month-first only when day-first is impossible (07/14).
    if (month > 12 && day <= 12) [day, month] = [month, day];
    if (numeric[3]) return build(fullYear(Number(numeric[3])), month, day);
    return withInferredYear(month, day, today);
  }

  const words = s.match(/\b(\d{1,2})(?:er|st|nd|rd|th)?\s+([a-z]{3,9})\.?(?:\s+(\d{2}|\d{4}))?\b/);
  if (words && MONTHS[words[2]] !== undefined) {
    const month = MONTHS[words[2]];
    const day = Number(words[1]);
    if (words[3]) return build(fullYear(Number(words[3])), month, day);
    return withInferredYear(month, day, today);
  }

  const english = s.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/);
  if (english && MONTHS[english[1]] !== undefined) {
    const month = MONTHS[english[1]];
    const day = Number(english[2]);
    if (english[3]) return build(Number(english[3]), month, day);
    return withInferredYear(month, day, today);
  }

  return null;
}
