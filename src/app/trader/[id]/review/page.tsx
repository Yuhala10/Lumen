import { TraderHeader } from "@/components/trader/trader-header";
import { ReviewBoard, type Overlap, type ReviewPage } from "@/components/trader/review-board";
import { getServerDict } from "@/lib/i18n/server";
import { todayIso } from "@/core/dates";
import { findDuplicatePages } from "@/core/refine/dedupe";
import { sourceIsUsable } from "@/core/organize/ledger";
import { aiStatus } from "@/server/services";
import { loadTrader } from "@/server/pages";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getServerDict();
  return { title: t.review.title };
}

export default async function ReviewPageRoute(props: PageProps<"/trader/[id]/review">) {
  const { id } = await props.params;
  const { t } = await getServerDict();
  const { bundle, profile } = await loadTrader(id);

  const sources = bundle.sources.filter((s) => (s.kind === "notebook" || s.kind === "receipt") && sourceIsUsable(s));
  const order = (s: (typeof sources)[number]) => s.reading?.pageDate ?? s.createdAt.slice(0, 10);
  const pages: ReviewPage[] = sources
    .slice()
    .sort((a, b) => order(a).localeCompare(order(b)) || a.createdAt.localeCompare(b.createdAt))
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      status: s.status,
      file: s.file,
      demo: s.demo,
      createdAt: s.createdAt,
      confirmedAt: s.confirmedAt,
      reading: s.reading,
    }));
  const ids = new Set(pages.map((p) => p.id));
  const entries = bundle.entries.filter((e) => ids.has(e.sourceId));
  const byId = new Map(sources.map((s) => [s.id, s]));
  const overlaps: Overlap[] = findDuplicatePages(entries, sources).map((o) => ({
    earlier: o.earlier,
    later: o.later,
    earlierDate: byId.get(o.earlier)?.reading?.pageDate,
  }));

  return (
    <>
      <TraderHeader trader={bundle.trader} t={t} active="review" pending={profile.counts.entriesPending} />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="rise mb-6">
          <h1 className="font-display text-[36px] leading-tight sm:text-[42px]">{t.review.title}</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">{t.review.subtitle}</p>
        </div>
        <ReviewBoard
          traderId={bundle.trader.id}
          pages={pages}
          entries={entries}
          overlaps={overlaps}
          aiConfigured={aiStatus().configured}
          today={todayIso()}
        />
      </div>
    </>
  );
}
