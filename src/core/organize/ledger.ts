import type { Entry, MomoTx, Source, TraderBundle } from "../types.ts";
import { isIsoDate } from "../dates.ts";
import { findDuplicatePages, type PageOverlap } from "../refine/dedupe.ts";

/**
 * Organize: the single rule for what counts.
 *
 * A line counts toward a profile only when all of these hold:
 *   - the trader confirmed it (or added it themselves)
 *   - it has a real date and a positive amount
 *   - its page was not held back as a duplicate photo
 *   - it does not repeat a line from an earlier page
 *
 * Every screen and every number uses this one function, so they always agree.
 */

export interface Ledger {
  counted: Entry[];
  pending: Entry[];
  rejected: Entry[];
  excludedAsDuplicate: Entry[];
  overlaps: PageOverlap[];
  momo: MomoTx[];
  momoDuplicates: MomoTx[];
  usableSources: Source[];
}

export function sourceIsUsable(s: Pick<Source, "status" | "duplicateKept">): boolean {
  return s.status !== "duplicate" || Boolean(s.duplicateKept);
}

export function buildLedger(bundle: Pick<TraderBundle, "sources" | "entries" | "momo">): Ledger {
  const usableSources = bundle.sources.filter(sourceIsUsable);
  const usable = new Set(usableSources.map((s) => s.id));
  const overlaps = findDuplicatePages(bundle.entries, bundle.sources);
  const repeated = new Set(overlaps.flatMap((o) => o.entryIds));

  const counted: Entry[] = [];
  const pending: Entry[] = [];
  const rejected: Entry[] = [];
  const excludedAsDuplicate: Entry[] = [];

  for (const e of bundle.entries) {
    if (!usable.has(e.sourceId)) continue;
    if (e.status === "rejected") {
      rejected.push(e);
      continue;
    }
    if (e.status === "pending") {
      pending.push(e);
      continue;
    }
    if (repeated.has(e.id)) {
      excludedAsDuplicate.push(e);
      continue;
    }
    if (e.amount > 0 && isIsoDate(e.date)) counted.push(e);
  }

  return {
    counted,
    pending,
    rejected,
    excludedAsDuplicate,
    overlaps,
    momo: bundle.momo.filter((m) => !m.duplicateOf),
    momoDuplicates: bundle.momo.filter((m) => Boolean(m.duplicateOf)),
    usableSources,
  };
}
