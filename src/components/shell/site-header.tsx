"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const { t, locale, setLocale } = useI18n();
  const path = usePathname();
  const role = path.startsWith("/lender") ? "lender" : path.startsWith("/trader") ? "trader" : null;

  const tab = (href: string, active: boolean, label: string) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center rounded-lg px-3 text-[13.5px] font-medium transition-colors",
        active ? "bg-surface text-ink shadow-soft" : "text-ink-3 hover:text-ink",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/65">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.nav.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t.nav.home} className="rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-xl bg-sunken p-1" aria-label="Role">
            {tab("/trader", role === "trader", t.nav.trader)}
            {tab("/lender", role === "lender", t.nav.lender)}
          </nav>
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "fr" : "en")}
            aria-label={t.nav.switchLabel}
            title={t.nav.switchLabel}
            className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-line bg-surface px-2.5 text-[12.5px] font-semibold tracking-wide text-ink-2 shadow-soft transition-colors hover:text-ink"
          >
            {t.nav.switchTo}
          </button>
        </div>
      </div>
    </header>
  );
}
