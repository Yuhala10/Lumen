import { z } from "zod";
import { parseAmount } from "../money.ts";

/**
 * Refine: the contract between Trust and the AI reader.
 *
 * Two layers of defence. The JSON schemas below are sent to the model so it
 * answers in shape. The zod schemas then re-validate everything it returns,
 * coercing sloppy values and never trusting the model's output blindly.
 */

const toNumber = (v: unknown): unknown => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseAmount(v) ?? Number(v.replace(",", "."));
  return v;
};

const num = z.preprocess(toNumber, z.number()).catch(0);
const str = z.string().catch("");
const box = z.array(z.number()).catch([]);

export const PageLineSchema = z.object({
  rawText: str,
  kind: z.enum(["sale", "expense", "total_sales", "total_expenses", "date_header", "other"]).catch("other"),
  description: str,
  date: str,
  dateText: str,
  quantity: num,
  unit: str,
  unitPrice: num,
  amount: num,
  box,
  confidence: num,
});

export const PageReadingSchema = z.object({
  document: z.enum(["sales_notebook", "receipt", "mobile_money", "other"]).catch("other"),
  legible: z.boolean().catch(true),
  language: str,
  pageDate: str,
  pageDateText: str,
  lines: z.array(PageLineSchema).catch([]),
  note: str,
});

export type PageLine = z.infer<typeof PageLineSchema>;
export type PageReading = z.infer<typeof PageReadingSchema>;

export const MomoLineSchema = z.object({
  rawText: str,
  direction: z.enum(["in", "out", "unknown"]).catch("unknown"),
  kind: z
    .enum(["received", "payment_in", "deposit", "sent", "payment_out", "withdrawal", "unknown"])
    .catch("unknown"),
  amount: num,
  fee: num,
  balance: num,
  date: str,
  dateText: str,
  time: str,
  ref: str,
  counterparty: str,
  provider: z.enum(["mtn", "orange", "unknown"]).catch("unknown"),
  box,
  confidence: num,
});

export const MomoReadingSchema = z.object({
  document: z.enum(["sales_notebook", "receipt", "mobile_money", "other"]).catch("other"),
  legible: z.boolean().catch(true),
  transactions: z.array(MomoLineSchema).catch([]),
  note: str,
});

export type MomoLine = z.infer<typeof MomoLineSchema>;
export type MomoReading = z.infer<typeof MomoReadingSchema>;

/* ------------------------------------------------------------------ */
/* JSON Schemas sent to Gemini (responseJsonSchema).                    */
/* ------------------------------------------------------------------ */

const BOX_JSON = {
  type: "array",
  description: "Bounding box of the whole line as [ymin, xmin, ymax, xmax], normalised 0-1000.",
  items: { type: "integer" },
  minItems: 4,
  maxItems: 4,
} as const;

const CONFIDENCE_JSON = {
  type: "number",
  description: "0 to 1. How sure you are that the amount, description and date are read correctly.",
  minimum: 0,
  maximum: 1,
} as const;

export const PAGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    document: { type: "string", enum: ["sales_notebook", "receipt", "mobile_money", "other"] },
    legible: { type: "boolean" },
    language: { type: "string", description: "Main language of the writing, e.g. fr, en, pidgin." },
    pageDate: { type: "string", description: "Date heading of the page as YYYY-MM-DD, or empty." },
    pageDateText: { type: "string", description: "The page date exactly as written, or empty." },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rawText: { type: "string", description: "The line exactly as written." },
          kind: {
            type: "string",
            enum: ["sale", "expense", "total_sales", "total_expenses", "date_header", "other"],
          },
          description: { type: "string", description: "What was sold or paid for, without the amount." },
          date: { type: "string", description: "YYYY-MM-DD if a date is written on this line, else empty." },
          dateText: { type: "string", description: "The date exactly as written on this line, else empty." },
          quantity: { type: "number", description: "Quantity if written, else 0." },
          unit: { type: "string", description: "Unit if written (tas, kg, seau...), else empty." },
          unitPrice: { type: "number", description: "Unit price if written, else 0." },
          amount: {
            type: "number",
            description: "The line's total amount in FCFA as written. 0 if no total amount is written.",
          },
          box: BOX_JSON,
          confidence: CONFIDENCE_JSON,
        },
        required: [
          "rawText", "kind", "description", "date", "dateText",
          "quantity", "unit", "unitPrice", "amount", "box", "confidence",
        ],
      },
    },
    note: { type: "string", description: "Anything a reviewer should know, e.g. torn or blurry areas." },
  },
  required: ["document", "legible", "language", "pageDate", "pageDateText", "lines", "note"],
} as const;

export const MOMO_JSON_SCHEMA = {
  type: "object",
  properties: {
    document: { type: "string", enum: ["sales_notebook", "receipt", "mobile_money", "other"] },
    legible: { type: "boolean" },
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rawText: { type: "string" },
          direction: { type: "string", enum: ["in", "out", "unknown"] },
          kind: {
            type: "string",
            enum: ["received", "payment_in", "deposit", "sent", "payment_out", "withdrawal", "unknown"],
          },
          amount: { type: "number" },
          fee: { type: "number", description: "0 if none shown." },
          balance: { type: "number", description: "0 if none shown." },
          date: { type: "string", description: "YYYY-MM-DD, or empty if not visible." },
          dateText: { type: "string" },
          time: { type: "string", description: "HH:MM, or empty." },
          ref: { type: "string", description: "Transaction ID, or empty." },
          counterparty: { type: "string", description: "Name of the other party only, or empty." },
          provider: { type: "string", enum: ["mtn", "orange", "unknown"] },
          box: BOX_JSON,
          confidence: CONFIDENCE_JSON,
        },
        required: [
          "rawText", "direction", "kind", "amount", "fee", "balance", "date",
          "dateText", "time", "ref", "counterparty", "provider", "box", "confidence",
        ],
      },
    },
    note: { type: "string" },
  },
  required: ["document", "legible", "transactions", "note"],
} as const;
