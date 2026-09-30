import { z } from "zod";

/**
 * Input rules shared by the forms (instant feedback) and the server
 * (the rules that actually hold). One definition, no drift.
 */

export const CAMEROON_CITIES = [
  "Yaoundé", "Douala", "Bamenda", "Bafoussam", "Garoua", "Maroua", "Ngaoundéré", "Bertoua",
  "Ebolowa", "Kribi", "Limbe", "Buea", "Kumba", "Dschang", "Nkongsamba", "Edéa", "Foumban",
] as const;

/** Cameroonian mobile numbers are 9 digits starting with 6 (or 2 for fixed lines). */
export function normalizePhone(input: string): string {
  const d = input.replace(/\D/g, "");
  return d.startsWith("237") && d.length === 12 ? d.slice(3) : d;
}

export const TraderInputSchema = z.object({
  name: z.string().trim().min(2, "name_short").max(80),
  business: z.string().trim().min(2, "business_short").max(80),
  market: z.string().trim().min(2, "market_short").max(80),
  city: z.string().trim().min(2, "city_short").max(60),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((s) => s === "" || /^[62]\d{8}$/.test(s), "phone_invalid")
    .optional(),
  providers: z.array(z.enum(["mtn", "orange"])).max(2).default([]),
});

export type TraderInput = z.input<typeof TraderInputSchema>;

const IsoDateInput = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid")]);

export const EntryPatchSchema = z
  .object({
    date: IsoDateInput.optional(),
    description: z.string().trim().min(1, "description_empty").max(120).optional(),
    amount: z.number().int("amount_whole").min(0).max(50_000_000, "amount_large").optional(),
    type: z.enum(["sale", "expense"]).optional(),
    status: z.enum(["pending", "confirmed", "rejected"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "empty_patch");

export type EntryPatch = z.infer<typeof EntryPatchSchema>;

export const EntryAddSchema = z.object({
  sourceId: z.string().regex(/^src_[0-9a-z]{6,24}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid"),
  description: z.string().trim().min(1, "description_empty").max(120),
  amount: z.number().int("amount_whole").min(1, "amount_missing").max(50_000_000, "amount_large"),
  type: z.enum(["sale", "expense"]),
});

export const MessagesInputSchema = z.object({
  text: z.string().trim().min(10, "messages_short").max(60_000, "messages_long"),
});

export const ConsentInputSchema = z.object({ granted: z.boolean() });

export const AskInputSchema = z.object({
  question: z.string().trim().min(3, "question_short").max(300, "question_long"),
  locale: z.enum(["en", "fr"]).default("en"),
});

export const DistinctInputSchema = z.object({
  otherId: z.string().regex(/^src_[0-9a-z]{6,24}$/),
});

export const PHOTO_KINDS = ["notebook", "receipt", "momo_screenshot"] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
