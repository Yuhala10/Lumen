import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicatePages, findPhotoDuplicate, hammingHex, markMomoDuplicates } from "./dedupe.ts";

test("measures difference between photo hashes", () => {
  assert.equal(hammingHex("ff00", "ff00"), 0);
  assert.equal(hammingHex("ff00", "fe00"), 1);
  assert.equal(hammingHex("0f", "f0"), 8);
  assert.equal(hammingHex("0f", "f0f0"), Number.POSITIVE_INFINITY);
});

test("finds exact, near and cross-trader photo duplicates", () => {
  const base = "a".repeat(64);
  const near = "b" + "a".repeat(63); // 1 differing hex digit: a (1010) vs b (1011) = 1 bit
  const far = "5".repeat(64);
  const existing = [
    { id: "src_1", traderId: "tr_a", file: { sha256: "x1", dhash: base, mime: "image/jpeg", bytes: 1, width: 1, height: 1 } },
    { id: "src_2", traderId: "tr_b", file: { sha256: "x2", dhash: far, mime: "image/jpeg", bytes: 1, width: 1, height: 1 } },
  ];
  assert.equal(findPhotoDuplicate({ sha256: "x1", dhash: far }, existing, "tr_a")?.kind, "exact");
  const n = findPhotoDuplicate({ sha256: "new", dhash: near }, existing, "tr_a");
  assert.equal(n?.kind, "near");
  assert.equal(n?.crossTrader, false);
  const cross = findPhotoDuplicate({ sha256: "x2", dhash: base }, existing, "tr_a");
  assert.equal(cross?.crossTrader, true);
  assert.equal(findPhotoDuplicate({ sha256: "new", dhash: "0".repeat(64) }, existing, "tr_a"), null);
});

test("merges repeated transactions but never look-alikes", () => {
  const tx = (id: string, over: Record<string, unknown>) => ({
    id,
    direction: "in" as const,
    amount: 2000,
    date: "2026-07-21",
    time: undefined as string | undefined,
    ref: undefined as string | undefined,
    raw: `message ${id}`,
    duplicateOf: undefined as string | undefined,
    ...over,
  });
  const out = markMomoDuplicates(
    [tx("m1", { ref: "AAA111" })],
    [
      tx("m2", { ref: "aaa111" }),
      tx("m3", {}),
      tx("m4", {}),
      tx("m5", { raw: "message m3" }),
      tx("m6", { time: "10:00" }),
      tx("m7", { time: "10:00", raw: "other text" }),
    ],
  );
  const byId = Object.fromEntries(out.map((t) => [t.id, t.duplicateOf]));
  assert.equal(byId.m2, "m1", "same transaction id");
  assert.equal(byId.m3, undefined);
  assert.equal(byId.m4, undefined, "two genuine 2 000 F payments stay separate");
  assert.equal(byId.m5, "m3", "identical message text");
  assert.equal(byId.m7, "m6", "same amount at the same minute");
});

test("detects a page photographed twice by its content", () => {
  const e = (id: string, sourceId: string, amount: number, description: string, date = "2026-07-14") => ({
    id,
    sourceId,
    status: "confirmed" as const,
    date,
    type: "sale" as const,
    amount,
    description,
  });
  const entries = [
    e("a1", "p1", 1500, "Tomates 3 tas"),
    e("a2", "p1", 600, "Piment"),
    e("a3", "p1", 4000, "Plantain"),
    e("a4", "p1", 1000, "Oignons"),
    e("b1", "p2", 1500, "Tomates 3 tas"),
    e("b2", "p2", 600, "Piment"),
    e("b3", "p2", 4000, "Plantain"),
    e("c1", "p3", 1500, "Tomates 3 tas"),
    e("c2", "p3", 600, "Piment"),
    e("c3", "p3", 3000, "Macabo"),
    e("c4", "p3", 200, "Gombo"),
  ];
  const sources = [
    { id: "p1", createdAt: "2026-07-14T19:00:00Z" },
    { id: "p2", createdAt: "2026-07-14T19:05:00Z" },
    { id: "p3", createdAt: "2026-07-14T19:10:00Z" },
  ];
  const overlaps = findDuplicatePages(entries, sources);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].earlier, "p1");
  assert.equal(overlaps[0].later, "p2");
  assert.deepEqual(overlaps[0].entryIds, ["b1", "b2", "b3"]);

  const declared = findDuplicatePages(entries, [
    { ...sources[0], distinctFrom: ["p2"] },
    sources[1],
    sources[2],
  ]);
  assert.equal(declared.length, 0, "the trader can declare two pages distinct");
});
