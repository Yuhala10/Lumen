/**
 * Amounts in Cameroon are whole FCFA. People write them many ways:
 * "2 500", "2.500", "2,500", "2500f", "2500 FCFA", "2k5", "2,5k", "15k".
 */

const CURRENCY_SUFFIX = /\s*(?:f\s*cfa|fcfa|xaf|cfa|frs?|f)\.?\s*$/i;
const CURRENCY_PREFIX = /^\s*(?:fcfa|xaf|cfa)\s*/i;

export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  if (typeof input !== "string") return null;

  let s = input.replace(/[  ]/g, " ").trim();
  s = s.replace(CURRENCY_PREFIX, "").replace(CURRENCY_SUFFIX, "").trim();
  if (!s) return null;

  // "2k5" = 2 500, "2,5k" = 2 500, "15k" = 15 000
  const k = s.match(/^(\d+)(?:[.,](\d+))?\s*k(\d*)$/i);
  if (k) {
    const whole = Number(k[1]);
    const frac = k[2] || k[3] || "";
    const fraction = frac ? Number(`0.${frac}`) : 0;
    return Math.round((whole + fraction) * 1000);
  }

  // Thousands separated by space, dot or comma: "12 500", "12.500", "1,250,000"
  if (/^\d{1,3}(?:[ .,]\d{3})+$/.test(s)) return Number(s.replace(/[ .,]/g, ""));

  // Decimals: "2500.00", "2500,5"
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Math.round(Number(s.replace(",", ".")));

  if (/^\d+$/.test(s)) return Number(s);

  return null;
}

/** Groups thousands with a space, the way FCFA amounts are printed locally. */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(n)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
