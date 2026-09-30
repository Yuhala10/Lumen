import { TraderHeader } from "@/components/trader/trader-header";
import { ProfileReport } from "@/components/profile/report";
import { getServerDict } from "@/lib/i18n/server";
import { aiStatus } from "@/server/services";
import { loadTrader } from "@/server/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerDict();
  return { title: t.profile.yourProfile };
}

export default async function TraderProfilePage(props: PageProps<"/trader/[id]/profile">) {
  const { id } = await props.params;
  const { t } = await getServerDict();
  const { bundle, profile } = await loadTrader(id);
  return (
    <>
      <TraderHeader trader={bundle.trader} t={t} active="profile" pending={profile.counts.entriesPending} />
      <ProfileReport
        mode="trader"
        aiConfigured={aiStatus().configured}
        data={{ trader: bundle.trader, sources: bundle.sources, entries: bundle.entries, momo: bundle.momo, events: bundle.events, profile }}
      />
    </>
  );
}
