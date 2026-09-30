import { ProfileReport } from "@/components/profile/report";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getServerDict } from "@/lib/i18n/server";
import { redactForLender } from "@/core/privacy";
import { aiStatus } from "@/server/services";
import { loadTrader } from "@/server/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/lender/[id]">) {
  const { id } = await props.params;
  const { t } = await getServerDict();
  const { bundle } = await loadTrader(id);
  return { title: bundle.trader.consent.granted ? bundle.trader.name : t.lender.notShared };
}

export default async function LenderProfilePage(props: PageProps<"/lender/[id]">) {
  const { id } = await props.params;
  const { t } = await getServerDict();
  const { bundle, profile } = await loadTrader(id);

  // Consent is checked on the server: without it, nothing about the business leaves.
  if (!bundle.trader.consent.granted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sunken text-ink-3">
          <Icon name="lock" size={26} />
        </span>
        <h1 className="mt-5 text-[22px] font-semibold">{t.lender.notShared}</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">{t.lender.notSharedBody}</p>
        <ButtonLink href="/lender" variant="secondary" className="mt-6" icon="arrowLeft">
          {t.lender.title}
        </ButtonLink>
      </div>
    );
  }

  const safe = redactForLender(bundle);
  return (
    <ProfileReport
      mode="lender"
      aiConfigured={aiStatus().configured}
      data={{ trader: safe.trader, sources: safe.sources, entries: safe.entries, momo: safe.momo, events: safe.events, profile }}
    />
  );
}
