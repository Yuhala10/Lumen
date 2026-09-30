import type { IsoDate, SourceKind, Trader } from "@/core/types";
import { MOMO_JSON_SCHEMA, PAGE_JSON_SCHEMA } from "@/core/refine/schema";
import { readingQuality, refineMomoReading, refinePage, type RefinedMomo, type RefinedPage } from "@/core/refine/validate";
import { aiConfig, generateJson } from "./gemini";

/**
 * Refine: the AI reader. It transcribes; it never counts.
 * Every reading goes straight through refinePage / refineMomoReading.
 */

const SHARED_RULES = `
Context: Trust is an evidence service for market traders in Cameroon. Lenders will rely on what you read, so accuracy matters more than completeness.
- Transcribe faithfully. Never invent a line, an amount or a date. If something is unreadable, lower the confidence; do not guess silently.
- Currency is FCFA (XAF), whole numbers only. People write 2 500, 2.500, 2500f, 2500 frs, 2k5 (= 2500), 15k (= 15000).
- Dates are day-first: 14/07 means 14 July. Choose the year so the date is not after {TODAY}.
- Writing may be French, English, Cameroonian Pidgin, Camfranglais or abbreviations (achat = purchase, tas = heap, régime = bunch, seau = bucket).
- box is [ymin, xmin, ymax, xmax] of the whole line, normalised to 0-1000 over the image.
- confidence is honest: clear print 0.95+, messy but readable 0.8, any doubt about a digit below 0.7.`;

const NOTEBOOK_PROMPT = `You read photos of a trader's handwritten sales notebook, one page at a time.
Return one item in "lines" for every written line, top to bottom:
- kind "sale": money received from a customer.
- kind "expense": money paid out (achat/purchase, stock, transport, ticket, rent, supplier, salary).
- kind "total_sales" / "total_expenses": a total the trader wrote.
- kind "date_header": a line that is only a date or day heading.
- kind "other": anything else (notes, names without money, crossed-out lines).
For amount, copy the line's total as written. If only a quantity and a unit price are written, put 0 in amount and fill quantity and unitPrice. Do not do arithmetic.
pageDate is the date heading at the top of the page (YYYY-MM-DD) and pageDateText exactly as written; empty if none.
If the photo is not a business record, set document to "other" and return no lines.${SHARED_RULES}`;

const RECEIPT_PROMPT = `You read a photo of a receipt or invoice belonging to a market trader.
From the trader's point of view: a receipt they wrote for a customer is a "sale"; a receipt or invoice from a supplier is an "expense".
Return each item line with its amount, and the receipt's total as "total_sales" or "total_expenses".
The receipt date goes in pageDate (YYYY-MM-DD) and pageDateText.
If the photo is not a receipt or business record, set document to "other" and return no lines.${SHARED_RULES}`;

const MOMO_PROMPT = `You read a screenshot of mobile money transactions (MTN MoMo or Orange Money): an SMS list or an app history.
Return one item in "transactions" per transaction:
- direction "in" for money received, "out" for money sent, paid or withdrawn.
- kind: received, payment_in, deposit (own cash-in at an agent), sent, payment_out, withdrawal.
- amount is the transaction amount only, never the fee or the balance.
- date as YYYY-MM-DD and time as HH:MM when visible. If the date is not visible, leave it empty: never guess it.
- ref is the transaction ID; counterparty is the other party's name only.
If the image is not mobile money, set document to "other" and return no transactions.${SHARED_RULES}`;

const MESSAGES_PROMPT = `You read mobile money SMS messages (MTN MoMo or Orange Money) that simple rules could not understand.
Return one item in "transactions" per real transaction. Ignore promotions and messages that are not transactions.
- direction "in" for money received, "out" for money sent, paid or withdrawn.
- amount is the transaction amount only, never the fee or the balance.
- If a message has no date, leave date empty: never guess it.
- box: return [0, 0, 0, 0].${SHARED_RULES}`;

function context(trader: Trader, today: IsoDate): string {
  return `Trader: ${trader.business}, ${trader.market}, ${trader.city}. Today is ${today}.`;
}

export type PhotoReading =
  | { kind: "page"; page: RefinedPage; model: string; ms: number; attempts: number; secondOpinion: boolean }
  | { kind: "momo"; momo: RefinedMomo; model: string; ms: number; attempts: number };

export async function readPhoto(input: {
  kind: Exclude<SourceKind, "momo_sms">;
  bytes: Uint8Array;
  mime: string;
  trader: Trader;
  today: IsoDate;
}): Promise<PhotoReading> {
  const image = { inline_data: { mime_type: input.mime, data: Buffer.from(input.bytes).toString("base64") } };
  const today = input.today;

  if (input.kind === "momo_screenshot") {
    const result = await generateJson({
      system: MOMO_PROMPT.replaceAll("{TODAY}", today),
      parts: [image, { text: `${context(input.trader, today)} Read the transactions in this screenshot.` }],
      schema: MOMO_JSON_SCHEMA,
    });
    return { kind: "momo", momo: refineMomoReading(result.data, today), model: result.model, ms: result.ms, attempts: result.attempts };
  }

  const request = {
    system: (input.kind === "receipt" ? RECEIPT_PROMPT : NOTEBOOK_PROMPT).replaceAll("{TODAY}", today),
    parts: [image, { text: `${context(input.trader, today)} Read this ${input.kind === "receipt" ? "receipt" : "notebook page"}.` }],
    schema: PAGE_JSON_SCHEMA,
  };

  // Fast model first. A shaky reading gets a second opinion from the careful
  // model, and the cleaner of the two readings wins.
  const cfg = aiConfig();
  const first = await generateJson({ ...request, models: [cfg.model, cfg.fallback] });
  const firstPage = refinePage(first.data, today);
  const quality = readingQuality(firstPage);
  let best = { page: firstPage, model: first.model };
  let ms = first.ms;
  let attempts = first.attempts;
  let secondOpinion = false;

  const timeLeft = !cfg.hosted || first.ms < 12_000;
  if (quality.needsSecondOpinion && first.model !== cfg.fallback && timeLeft) {
    try {
      const second = await generateJson({ ...request, models: [cfg.fallback] });
      const secondPage = refinePage(second.data, today);
      ms += second.ms;
      attempts += second.attempts;
      secondOpinion = true;
      if (readingQuality(secondPage).score < quality.score) best = { page: secondPage, model: second.model };
    } catch {
      /* the first reading stands; the trader still reviews every flagged line */
    }
  }
  return { kind: "page", page: best.page, model: best.model, ms, attempts, secondOpinion };
}

export async function readMessages(messages: string[], trader: Trader, today: IsoDate): Promise<RefinedMomo> {
  const result = await generateJson({
    system: MESSAGES_PROMPT.replaceAll("{TODAY}", today),
    parts: [{ text: `${context(trader, today)}\n\nMESSAGES:\n${messages.map((m, i) => `(${i + 1}) ${m}`).join("\n")}` }],
    schema: MOMO_JSON_SCHEMA,
  });
  return refineMomoReading(result.data, today);
}
