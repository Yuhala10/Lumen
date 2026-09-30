"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/core/types";
import { getDict, LOCALE_COOKIE, type Dict } from "./index";

interface I18n {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );
  const value = useMemo(() => ({ locale, t: getDict(locale), setLocale }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
