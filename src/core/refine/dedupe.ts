import type { Entry, MomoTx, Source } from "../types.ts";
import { normalizeItem } from "../text.ts";

/**
 * Refine: duplicate detection, in three layers.
 *
 * 1. Exact photo copies (same bytes) are blocked outright.
 * 2. Near-identical photos (a page photographed twice) are held for the
 *    trader to decide, using a 256-bit difference hash.
 * 3. Pages whose lines largely repeat another page are caught by content,
 *    even when the photos look different.
 */

/** Maximum differing bits (of 256) for two photos to count as the same page. */
export const NEAR_DUPLICATE_BITS = 14;

export function hammingHex(a: string, b: string): number {
  if (!a || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

export interface PhotoMatch {
  kind: "exact" | "near";
  sourceId: string;
  traderId: string;
  crossTrader: boolean;
  distance: number;
}

export function findPhotoDuplicate(
  candidate: { sha256: string; dhash: string },
  existing: Array<Pick<Source, "id" | "traderId" | "file">>,
  traderId: string,
): PhotoMatch | null {
  let best: PhotoMatch | null = null;
  for (const s of existing) {
    if (!s.file) continue;
    if (s.file.sha256 === candidate.sha256) {
      return { kind: "exact", sourceId: s.id, traderId: s.traderId, crossTrader: s.traderId !== traderId, distance: 0 };
    }
    const d = hammingHex(candidate.dhash, s.file.dhash);
    if (d <= NEAR_DUPLICATE_BITS && (!best || d < best.distance)) {
      best = { kind: "near", sourceId: s.id, traderId: s.traderId, crossTrader: s.traderId !== traderId, distance: d };
    }
  }
  return best;
}

/**
 * Identity of a mobile money transaction. A transaction ID is decisive;
 * without one, the exact time; without that, only an identical message
 * counts as a repeat. Two genuine 2 000 F payments on the same day must
 * never be merged just because they look alike.
 */
export function momoKey(tx: Pick<MomoTx, "direction" | "amount" | "date" | "time" | "ref" | "raw">): string {
  if (tx.ref) return `ref:${tx.ref.toUpperCase()}`;
  if (tx.time) return `time:${tx.direction}:${tx.amount}:${tx.date}:${tx.time}`;
  return `raw:${tx.raw.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

/** Marks incoming transactions that repeat one already on file (or earlier in the batch). */
export function markMomoDuplicates<T extends Pick<MomoTx, "id" | "direction" | "amount" | "date" | "time" | "ref" | "raw" | "duplicateOf">>(
  existing: T[],
  incoming: T[],
): T[] {
  const seen = new Map<string, string>();
  for (const tx of existing) if (!tx.duplicateOf) seen.set(momoKey(tx), tx.id);
  return incoming.map((tx) => {
    const key = momoKey(tx);
    const first = seen.get(key);
    if (first) return { ...tx, duplicateOf: first };
    seen.set(key, tx.id);
    return tx;
  });
}

export interface PageOverlap {
  earlier: string;
  later: string;
  matches: number;
  ratio: number;
  /** Lines on the later page that repeat the earlier page. */
  entryIds: string[];
}

function lineKey(e: Pick<Entry, "date" | "type" | "amount" | "description">): string {
  return `${e.date}|${e.type}|${e.amount}|${normalizeItem(e.description)}`;
}

/**
 * Finds pages whose lines mostly repeat an earlier page: at least three
 * matching lines covering at least 60% of the shorter page. Pages the
 * trader has declared distinct are left alone.
 */
export function findDuplicatePages(
  entries: Array<Pick<Entry, "id" | "sourceId" | "status" | "date" | "type" | "amount" | "description">>,
  sources: Array<Pick<Source, "id" | "createdAt" | "distinctFrom">>,
): PageOverlap[] {
  const bySource = new Map<string, typeof entries>();
  for (const e of entries) {
    if (e.status === "rejected" || e.amount <= 0 || !e.date) continue;
    const list = bySource.get(e.sourceId);
    if (list) list.push(e);
    else bySource.set(e.sourceId, [e]);
  }

  const ordered = sources
    .filter((s) => (bySource.get(s.id)?.length ?? 0) >= 3)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id)));

  const distinct = (a: Pick<Source, "id" | "distinctFrom">, b: Pick<Source, "id" | "distinctFrom">) =>
    Boolean(a.distinctFrom?.includes(b.id) || b.distinctFrom?.includes(a.id));

  const keyCounts = new Map<string, Map<string, number>>();
  for (const s of ordered) {
    const counts = new Map<string, number>();
    for (const e of bySource.get(s.id) ?? []) {
      const k = lineKey(e);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    keyCounts.set(s.id, counts);
  }

  const overlaps: PageOverlap[] = [];
  for (let j = 1; j < ordered.length; j++) {
    const later = ordered[j];
    const laterEntries = bySource.get(later.id) ?? [];
    for (let i = 0; i < j; i++) {
      const earlier = ordered[i];
      if (distinct(earlier, later)) continue;
      const remaining = new Map(keyCounts.get(earlier.id));
      const matched: string[] = [];
      for (const e of laterEntries) {
        const k = lineKey(e);
        const left = remaining.get(k) ?? 0;
        if (left > 0) {
          remaining.set(k, left - 1);
          matched.push(e.id);
        }
      }
      const shorter = Math.min(laterEntries.length, bySource.get(earlier.id)?.length ?? 0);
      const ratio = shorter ? matched.length / shorter : 0;
      if (matched.length >= 3 && ratio >= 0.6) {
        overlaps.push({ earlier: earlier.id, later: later.id, matches: matched.length, ratio, entryIds: matched });
      }
    }
  }
  return overlaps;
}
