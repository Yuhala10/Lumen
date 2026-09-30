import { cookies, headers } from "next/headers";
import type { Locale } from "@/core/types";
import { getDict, isLocale, localeFromHeader, LOCALE_COOKIE } from "./index";

export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return localeFromHeader((await headers()).get("accept-language"));
}

export async function getServerDict() {
  const locale = await getLocale();
  return { locale, t: getDict(locale) };
}
