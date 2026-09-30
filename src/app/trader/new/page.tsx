import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { NewTraderForm } from "@/components/trader/new-trader-form";
import { getServerDict } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerDict();
  return { title: t.traders.new };
}

export default async function NewTraderPage() {
  const { t } = await getServerDict();
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <Link href="/trader" className="inline-flex items-center gap-1 text-[13.5px] text-ink-3 hover:text-ink">
        <Icon name="chevronLeft" size={16} />
        {t.traders.title}
      </Link>
      <div className="rise mt-4">
        <h1 className="font-display text-[36px] leading-tight sm:text-[42px]">{t.newTrader.title}</h1>
        <p className="mt-2 text-[15px] text-ink-2">{t.newTrader.subtitle}</p>
      </div>
      <div className="rise mt-8 rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7" style={{ animationDelay: "80ms" }}>
        <NewTraderForm />
      </div>
    </div>
  );
}
