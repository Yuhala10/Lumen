import type { IsoDate, Locale } from "@/core/types";

/**
 * Formatting for people. French uses a non-breaking space between thousands
 * and before "FCFA" so amounts never break across lines.
 */

const NBSP = " ";

function group(n: number, locale: Locale): string {
  const digits = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, locale === "fr" ? NBSP : ",");
  return (n < 0 ? "−" : "") + digits;
}

export function formatNumber(n: number, locale: Locale): string {
  return group(n, locale);
}

export function formatMoney(n: number, locale: Locale): string {
  return `${group(n, locale)}${NBSP}FCFA`;
}

/** 85 500 becomes "85,5 k" (fr) or "85.5k" (en). */
export function formatCompact(n: number, locale: Locale): string {
  const abs = Math.abs(n);
  const sep = locale === "fr" ? NBSP : "";
  const dec = (v: number) => {
    const s = v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
    return locale === "fr" ? s.replace(".", ",") : s;
  };
  if (abs >= 1_000_000) return `${dec(n / 1_000_000)}${sep}M`;
  if (abs >= 1000) return `${dec(n / 1000)}${sep}k`;
  return String(Math.round(n));
}

export function formatPct(ratio: number, locale: Locale, opts: { sign?: boolean; digits?: number } = {}): string {
  const digits = opts.digits ?? 0;
  const v = Math.round(ratio * 100 * 10 ** digits) / 10 ** digits;
  const s = (opts.sign && v > 0 ? "+" : v < 0 ? "−" : "") + String(Math.abs(v));
  const body = locale === "fr" ? s.replace(".", ",") : s;
  return locale === "fr" ? `${body}${NBSP}%` : `${body}%`;
}

export function formatDecimal(v: number, locale: Locale, digits = 1): string {
  const s = String(Math.round(v * 10 ** digits) / 10 ** digits);
  return locale === "fr" ? s.replace(".", ",") : s;
}

const tag = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-GB");

function isoToDate(iso: IsoDate): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function formatDate(iso: IsoDate, locale: Locale, style: "short" | "long" | "weekday" | "full" = "short"): string {
  if (!iso) return "";
  const opts: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "numeric", month: "short", timeZone: "UTC" }
      : style === "long"
        ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
        : style === "weekday"
          ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
          : { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(tag(locale), opts).format(isoToDate(iso));
}

export function formatRange(start: IsoDate, end: IsoDate, locale: Locale): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const a = new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(isoToDate(start));
  const b = formatDate(end, locale, "long");
  return locale === "fr" ? `${a} au ${b}` : `${a} to ${b}`;
}

/** Timestamps are shown in Cameroon time. */
export function formatDateTime(isoString: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  }).format(new Date(isoString));
}

export function formatRelative(isoString: string, locale: Locale, now: number = Date.now()): string {
  const diff = (new Date(isoString).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(isoString.slice(0, 10), locale, "long");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
