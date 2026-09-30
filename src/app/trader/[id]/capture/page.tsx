import { TraderHeader } from "@/components/trader/trader-header";
import { CaptureBoard, type CaptureSource } from "@/components/trader/capture-board";
import { MessagesPanel } from "@/components/trader/messages-panel";
import { Icon } from "@/components/ui/icon";
import { getServerDict } from "@/lib/i18n/server";
import { todayIso } from "@/core/dates";
import { needsAttention } from "@/core/refine/flags";
import { aiStatus } from "@/server/services";
import { loadTrader } from "@/server/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerDict();
  return { title: t.capture.title };
}

export default async function CapturePage(props: PageProps<"/trader/[id]/capture">) {
  const { id } = await props.params;
  const { t } = await getServerDict();
  const { bundle, profile } = await loadTrader(id);
  const today = todayIso();

  const photos: CaptureSource[] = bundle.sources
    .filter((s) => s.kind !== "momo_sms")
    .slice()
    .reverse()
    .map((s) => {
      const lines = bundle.entries.filter((e) => e.sourceId === s.id);
      return {
        id: s.id,
        kind: s.kind as CaptureSource["kind"],
        status: s.status,
        hasFile: Boolean(s.file),
        demo: s.demo,
        lines: lines.length,
        attention: lines.filter((e) => needsAttention(e, today)).length,
        momo: bundle.momo.filter((m) => m.sourceId === s.id && !m.duplicateOf).length,
        document: s.reading?.document,
        error: s.error ? (t.errors[s.error.code] ?? t.errors.generic) : undefined,
      };
    });

  return (
    <>
      <TraderHeader trader={bundle.trader} t={t} active="capture" pending={profile.counts.entriesPending} />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="rise">
          <h1 className="font-display text-[36px] leading-tight sm:text-[42px]">{t.capture.title}</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">{t.capture.subtitle}</p>
        </div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <CaptureBoard
            traderId={bundle.trader.id}
            sources={photos}
            pendingLines={profile.counts.entriesPending}
            aiConfigured={aiStatus().configured}
            today={today}
          />
          <div className="space-y-5">
            <MessagesPanel traderId={bundle.trader.id} />
            <section className="rounded-3xl border border-line bg-surface-2 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold">
                <Icon name="camera" size={17} className="text-brand" />
                {t.capture.tipsTitle}
              </h2>
              <ul className="mt-3 space-y-2">
                {t.capture.tips.map((tip) => (
                  <li key={tip} className="flex gap-2.5 text-[13.5px] leading-5 text-ink-2">
                    <Icon name="check" size={16} className="mt-0.5 text-good" />
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
