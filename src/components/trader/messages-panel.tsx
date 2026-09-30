"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import type { MomoTx } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/context";
import { api, errorText } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Result {
  added: MomoTx[];
  duplicates: MomoTx[];
  unread: { raw: string; reason: string }[];
  usedAi: boolean;
}

export function MessagesPanel({ traderId }: { traderId: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Result>(`/api/traders/${traderId}/messages`, { body: { text } });
      setResult(r);
      if (r.added.length || r.duplicates.length) setText(r.unread.map((u) => u.raw).join("\n\n"));
      router.refresh();
    } catch (err) {
      setError(errorText(err, t.errors));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon name="message" size={20} />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold">{t.messages.title}</h2>
          <p className="mt-1 text-[13.5px] leading-5 text-ink-3">{t.messages.subtitle}</p>
        </div>
      </div>
      <Textarea
        className="mt-4 min-h-40 font-mono text-[13px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.messages.placeholder}
        aria-label={t.messages.title}
      />
      <Button className="mt-3 w-full" icon="sparkle" loading={busy} disabled={text.trim().length < 10} onClick={submit}>
        {t.messages.submit}
      </Button>
      {error ? <p className="mt-3 text-[13px] font-medium text-danger">{error}</p> : null}

      <AnimatePresence>
        {result ? (
          <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 space-y-3">
            {result.added.length || result.duplicates.length ? (
              <div className="rounded-xl bg-good-soft px-4 py-3 text-[13.5px] font-medium text-good">
                <span className="flex items-center gap-2">
                  <Icon name="checkCircle" size={17} />
                  {t.messages.result(result.added.length, result.duplicates.length)}
                </span>
                <ul className="mt-2 space-y-1 font-normal">
                  {result.added.slice(0, 5).map((x) => (
                    <li key={x.id} className="flex justify-between gap-3 text-[12.5px]">
                      <span className="truncate">
                        {x.direction === "in" ? "+" : "−"} {t.evidence.kinds[x.kind]} · {formatDate(x.date, locale)}
                      </span>
                      <span className="tabular">{formatMoney(x.amount, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.usedAi ? <p className="text-[12.5px] text-ink-3">{t.messages.usedAi}</p> : null}
            {result.unread.length ? (
              <div className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
                <p className="font-semibold">{t.messages.unreadTitle(result.unread.length)}</p>
                <ul className="mt-2 space-y-2">
                  {result.unread.map((u, i) => (
                    <li key={i}>
                      <p className={cn("font-medium")}>{t.messages.reasons[u.reason] ?? u.reason}</p>
                      <p className="line-clamp-2 text-[12px] opacity-80">{u.raw}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
