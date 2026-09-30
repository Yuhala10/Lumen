import type { Locale } from "@/core/types";
import { en, type Dict } from "./en";
import { fr } from "./fr";

export type { Dict };
export const LOCALES: Locale[] = ["en", "fr"];
export const LOCALE_COOKIE = "trust-locale";

const DICTS: Record<Locale, Dict> = { en, fr };

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "fr";
}

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

/** Picks French when the browser prefers it, English otherwise. */
export function localeFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return "en";
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("fr") ? "fr" : "en";
}
