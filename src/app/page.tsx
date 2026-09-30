import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { HeroVisual } from "@/components/landing/hero-visual";
import { ResetDemo } from "@/components/landing/reset-demo";
import { getServerDict } from "@/lib/i18n/server";
import { listSummaries } from "@/server/services";

export const dynamic = "force-dynamic";

const PRINCIPLE_ICONS: IconName[] = ["sparkle", "highlighter", "lock"];
const STEP_ICONS: IconName[] = ["camera", "checkCircle", "link", "scale"];

export default async function Home() {
  const { t } = await getServerDict();
  const summaries = await listSummaries();
  const demo = summaries.find((s) => s.trader.demo && s.trader.consent.granted);

  const [before, after] = t.landing.title.split(t.landing.titleMark);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24">
        <div className="rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-2 shadow-soft">
            <Icon name="pin" size={14} className="text-brand" />
            {t.landing.eyebrow}
          </p>
          <h1 className="font-display mt-6 text-[46px] leading-[1.02] text-ink sm:text-[64px]">
            {before}
            <span className="relative isolate inline-block whitespace-nowrap">
              <span
                aria-hidden
                className="marker-sweep absolute inset-x-[-0.12em] bottom-[0.06em] top-[0.42em] -z-10 rounded-[6px] bg-marker"
                style={{ animationDelay: "450ms" }}
              />
              <em className="not-italic">{t.landing.titleMark}</em>
            </span>
            {after}
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-8 text-ink-2">{t.landing.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/trader" size="lg" iconRight="arrowRight">
              {t.landing.ctaTrader}
            </ButtonLink>
            <ButtonLink href="/lender" size="lg" variant="secondary" icon="scale">
              {t.landing.ctaLender}
            </ButtonLink>
          </div>
          {demo ? (
            <Link href={`/lender/${demo.trader.id}`} className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand hover:underline">
              {t.landing.ctaDemo}
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : null}
        </div>
        <HeroVisual />
      </section>

      <section className="border-t border-line py-14">
        <h2 className="font-display text-[32px] leading-tight sm:text-[38px]">{t.landing.principlesTitle}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {t.landing.principles.map((p, i) => (
            <div key={p.title} className="rounded-2xl border border-line bg-surface p-6 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Icon name={PRINCIPLE_ICONS[i]} size={20} />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-[14px] leading-6 text-ink-2">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-14">
        <h2 className="font-display text-[32px] leading-tight sm:text-[38px]">{t.landing.stepsTitle}</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.landing.steps.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-bg">{i + 1}</span>
                <Icon name={STEP_ICONS[i]} size={20} className="text-ink-3" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-6 text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-col items-start justify-between gap-3 border-t border-line py-8 text-[13px] text-ink-3 sm:flex-row sm:items-center">
        <p>{t.landing.footer}</p>
        <ResetDemo />
      </footer>
    </div>
  );
}
