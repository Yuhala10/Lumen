import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { ActivityCard } from "@/components/profile/cards";
import { StrengthRing } from "@/components/profile/strength-card";
import { TraderHeader } from "@/components/trader/trader-header";
import { DeleteBusiness } from "@/components/trader/delete-business";
import { getServerDict } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import { loadTrader } from "@/server/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/trader/[id]">) {
  const { id } = await props.params;
  const { bundle } = await loadTrader(id);
  return { title: bundle.trader.name };
}

export default async function TraderHub(props: PageProps<"/trader/[id]">) {
  const { id } = await props.params;
  const { t } = await getServerDict();
  const { bundle, profile } = await loadTrader(id);
  const { trader } = bundle;

  const momoCount = profile.counts.momo;
  const pages = profile.counts.pages;
  const pending = profile.counts.entriesPending;

  const steps: {
    key: string;
    icon: IconName;
    title: string;
    body: string;
    status: string;
    done: boolean;
    href: string;
    cta: string;
  }[] = [
    {
      key: "capture",
      icon: "camera",
      title: t.hub.capture.title,
      body: t.hub.capture.body,
      status: t.hub.capture.status(pages, momoCount),
      done: pages > 0,
      href: "capture",
      cta: t.hub.capture.cta,
    },
    {
      key: "review",
      icon: "checkCircle",
      title: t.hub.review.title,
      body: t.hub.review.body,
      status: t.hub.review.status(pending),
      done: pages > 0 && pending === 0 && profile.counts.pagesAwaitingReview === 0,
      href: "review",
      cta: t.hub.review.cta,
    },
    {
      key: "profile",
      icon: "chart",
      title: t.hub.profile.title,
      body: t.hub.profile.body,
      status: t.hub.profile.status(profile.strength.score),
      done: profile.hasData,
      href: "profile",
      cta: t.hub.profile.cta,
    },
    {
      key: "share",
      icon: "link",
      title: t.hub.share.title,
      body: t.hub.share.body,
      status: trader.consent.granted ? t.hub.share.on : t.hub.share.off,
      done: trader.consent.granted,
      href: "share",
      cta: t.hub.share.cta,
    },
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <>
      <TraderHeader trader={trader} t={t} active="hub" pending={pending} />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="rise flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[38px] leading-tight sm:text-[46px]">{t.hub.greeting(trader.name)}</h1>
            <p className="mt-2 text-[15px] text-ink-2">{t.hub.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
            <StrengthRing score={profile.strength.score} grade={profile.strength.grade} size={54} />
            <div>
              <p className="text-[12.5px] text-ink-3">{t.strength.title}</p>
              <p className="text-[16px] font-semibold">{t.strength.grades[profile.strength.grade]}</p>
            </div>
          </div>
        </div>

        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {steps.map((s, i) => {
            const isNext = i === next;
            return (
              <li key={s.key} className="rise" style={{ animationDelay: `${80 + i * 60}ms` }}>
                <Link
                  href={`/trader/${trader.id}/${s.href}`}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 sm:p-6",
                    isNext ? "border-brand bg-surface shadow-float ring-4 ring-brand/10" : "border-line bg-surface shadow-card hover:border-line-strong",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t.hub.step(i + 1)}</span>
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        s.done ? "bg-good-soft text-good" : isNext ? "bg-brand text-brand-ink" : "bg-sunken text-ink-3",
                      )}
                    >
                      <Icon name={s.done ? "check" : s.icon} size={16} strokeWidth={s.done ? 2.5 : 1.75} />
                    </span>
                  </div>
                  <h2 className="mt-3 text-[18px] font-semibold tracking-[-0.01em]">{s.title}</h2>
                  <p className="mt-1 flex-1 text-[14px] leading-6 text-ink-2">{s.body}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <span className={cn("text-[13px]", s.key === "review" && pending ? "font-medium text-warn" : "text-ink-3")}>{s.status}</span>
                    <span className={cn("inline-flex items-center gap-1 text-[13.5px] font-semibold", isNext ? "text-brand" : "text-ink-2")}>
                      {s.cta}
                      <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_auto]">
          <ActivityCard events={bundle.events} limit={6} />
        </div>
        <div className="mt-6 flex justify-end">
          <DeleteBusiness traderId={trader.id} />
        </div>
      </div>
    </>
  );
}
