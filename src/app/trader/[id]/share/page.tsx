import { TraderHeader } from "@/components/trader/trader-header";
import { SharePanel } from "@/components/trader/share-panel";
import { getServerDict } from "@/lib/i18n/server";
import { loadTrader } from "@/server/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerDict();
  return { title: t.share.title };
}

export default async function SharePage(props: PageProps<"/trader/[id]/share">) {
  const { id } = await props.params;
  const { t } = await getServerDict();
  const { bundle, profile } = await loadTrader(id);
  return (
    <>
      <TraderHeader trader={bundle.trader} t={t} active="share" pending={profile.counts.entriesPending} />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="rise mb-7">
          <h1 className="font-display text-[36px] leading-tight sm:text-[42px]">{t.share.title}</h1>
          <p className="mt-1.5 max-w-2xl text-[14.5px] text-ink-2">{t.share.subtitle}</p>
        </div>
        <SharePanel trader={bundle.trader} strengthScore={profile.strength.score} />
      </div>
    </>
  );
}
