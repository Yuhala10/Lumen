import type { MomoTx, Trader, TraderBundle } from "./types.ts";
import { maskPhone } from "./discover/sms.ts";

/**
 * What a lender is allowed to see. Phone numbers are masked everywhere,
 * including inside the raw message text, and customer names are reduced to
 * a first name and an initial.
 */

const PHONE_RE = /\(?\+?237\)?[\s.]?6\d{8}\b\)?|\b6\d{8}\b/g;

export function maskPhonesInText(text: string): string {
  return text.replace(PHONE_RE, (m) => maskPhone(m.replace(/\D/g, "").slice(-9)) ?? "•••");
}

export function shortName(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function redactMomo(m: MomoTx): MomoTx {
  return {
    ...m,
    phone: maskPhone(m.phone),
    counterparty: shortName(m.counterparty),
    raw: maskPhonesInText(m.raw),
  };
}

function redactTrader(t: Trader): Trader {
  return { ...t, phone: maskPhone(t.phone) };
}

export function redactForLender(bundle: TraderBundle): TraderBundle {
  return {
    ...bundle,
    trader: redactTrader(bundle.trader),
    momo: bundle.momo.map(redactMomo),
    sources: bundle.sources.map((s) => (s.text ? { ...s, text: maskPhonesInText(s.text) } : s)),
  };
}
