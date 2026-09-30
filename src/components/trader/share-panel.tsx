"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import type { Trader } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { api, errorText } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export function SharePanel({ trader: initial, strengthScore }: { trader: Trader; strengthScore: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [trader, setTrader] = useState(initial);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const shared = trader.consent.granted && trader.consent.code;
  const link = typeof window !== "undefined" ? `${window.location.origin}/lender/${trader.id}` : `/lender/${trader.id}`;

  async function setConsent(granted: boolean) {
    if (!granted && !window.confirm(t.share.revokeConfirm)) return;
    setBusy(true);
    try {
      const updated = await api<Trader>(`/api/traders/${trader.id}/consent`, { body: { granted } });
      setTrader(updated);
      setRevoked(!granted);
      setAgree(false);
      router.refresh();
    } catch (err) {
      toast(errorText(err, t.errors), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t.common.copied);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          {shared ? (
            <m.div key="on" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="flex items-center gap-2 text-[14px] font-semibold text-good">
                <Icon name="checkCircle" size={19} />
                {t.share.granted}
              </p>
              <p className="mt-5 text-[13px] font-medium text-ink-3">{t.share.code}</p>
              <p className="mt-1 select-all font-mono text-[34px] font-semibold tracking-[0.06em] sm:text-[40px]">{trader.consent.code}</p>
              <p className="mt-1 text-[13px] text-ink-3">{t.share.codeHint}</p>
              {trader.consent.grantedAt ? (
                <p className="mt-1 text-[12.5px] text-ink-3">{t.profile.sharedOn(formatDate(trader.consent.grantedAt.slice(0, 10), locale, "long"))}</p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" icon="copy" onClick={() => copy(trader.consent.code ?? "")}>
                  {t.share.copyCode}
                </Button>
                <Button variant="secondary" icon="link" onClick={() => copy(link)}>
                  {t.share.copyLink}
                </Button>
              </div>
              <div className="mt-6 border-t border-line pt-5">
                <Button variant="danger" icon="lock" loading={busy} onClick={() => setConsent(false)}>
                  {t.share.revoke}
                </Button>
              </div>
            </m.div>
          ) : (
            <m.div key="off" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {revoked ? (
                <p className="mb-4 flex items-center gap-2 rounded-xl bg-sunken px-4 py-3 text-[13.5px] text-ink-2">
                  <Icon name="lock" size={17} />
                  {t.share.revoked}
                </p>
              ) : null}
              {strengthScore < 60 ? (
                <p className="mb-4 flex gap-2 rounded-xl bg-warn-soft px-4 py-3 text-[13.5px] leading-5 text-warn">
                  <Icon name="info" size={17} className="mt-0.5" />
                  {t.share.weak}
                </p>
              ) : null}
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="peer sr-only" />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand",
                    agree ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-surface",
                  )}
                >
                  {agree ? <Icon name="check" size={13} strokeWidth={3} /> : null}
                </span>
                <span className="text-[14px] leading-6 text-ink">{t.share.agree}</span>
              </label>
              <Button size="lg" className="mt-4 w-full" icon="link" disabled={!agree} loading={busy} onClick={() => setConsent(true)}>
                {t.share.grant}
              </Button>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <section className="rounded-3xl border border-line bg-surface-2 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <Icon name="eye" size={17} className="text-brand" />
            {t.share.seesTitle}
          </h2>
          <ul className="mt-3 space-y-2">
            {t.share.sees.map((s) => (
              <li key={s} className="flex gap-2.5 text-[13.5px] leading-5 text-ink-2">
                <Icon name="check" size={16} className="mt-0.5 text-good" />
                {s}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-line bg-surface-2 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <Icon name="lock" size={17} className="text-ink-2" />
            {t.share.neverTitle}
          </h2>
          <ul className="mt-3 space-y-2">
            {t.share.never.map((s) => (
              <li key={s} className="flex gap-2.5 text-[13.5px] leading-5 text-ink-2">
                <Icon name="x" size={16} className="mt-0.5 text-ink-3" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
