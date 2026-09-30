import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entry, MomoTx, TraderBundle } from "../types.ts";
import { buildProfile } from "./profile.ts";
import { corroborate } from "./corroborate.ts";
import { evidenceStrength, WEIGHTS } from "./strength.ts";
import { buildDemoDatabase } from "../demo/seed.ts";
import { addDays } from "../dates.ts";

const TODAY = "2026-09-30";

function entry(id: string, date: string, amount: number, over: Partial<Entry> = {}): Entry {
  return {
    id,
    traderId: "tr_x",
    sourceId: "src_1",
    seq: 0,
    origin: "ai",
    status: "confirmed",
    date,
    description: "Tomates",
    amount,
    type: "sale",
    raw: "",
    confidence: 0.95,
    flags: [],
    ...over,
  };
}

function momo(id: string, date: string, amount: number, over: Partial<MomoTx> = {}): MomoTx {
  return {
    id,
    traderId: "tr_x",
    sourceId: "src_m",
    provider: "mtn",
    direction: "in",
    kind: "received",
    amount,
    date,
    raw: id,
    confidence: 0.95,
    method: "rules",
    ...over,
  };
}

function bundle(entries: Entry[], momoTx: MomoTx[] = []): TraderBundle {
  return {
    trader: {
      id: "tr_x",
      createdAt: "",
      updatedAt: "",
      name: "Test",
      business: "Produce",
      market: "Mokolo",
      city: "Yaoundé",
      providers: ["mtn"],
      consent: { granted: false },
    },
    sources: [{ id: "src_1", traderId: "tr_x", kind: "notebook", createdAt: "2026-07-01T00:00:00Z", status: "read" }],
    entries,
    momo: momoTx,
    events: [],
  };
}

test("corroborates mobile money against notebook sales in three passes", () => {
  const sales = [entry("e1", "2026-07-14", 5000), entry("e2", "2026-07-14", 3000), entry("e3", "2026-07-15", 2000)];
  const result = corroborate(
    sales,
    [
      momo("exact", "2026-07-14", 3000),
      momo("covered", "2026-07-14", 4000),
      momo("adjacent", "2026-07-16", 2000, { time: "06:10" }),
      momo("unmatched", "2026-07-15", 9000),
      momo("deposit", "2026-07-15", 20000, { kind: "deposit" }),
      momo("outside", "2026-08-30", 1000),
      momo("sent", "2026-07-14", 15000, { direction: "out", kind: "sent" }),
    ],
    { start: "2026-07-14", end: "2026-07-15" },
  );
  assert.deepEqual(result.exact, [{ momoId: "exact", entryId: "e2" }]);
  assert.deepEqual(result.corroboratedIds.sort(), ["adjacent", "covered", "exact"]);
  assert.deepEqual(result.unmatchedIds, ["unmatched"]);
  assert.deepEqual(result.depositIds, ["deposit"]);
  assert.deepEqual(result.outsidePeriodIds, ["outside"]);
  assert.deepEqual(result.outflowIds, ["sent"]);
  assert.equal(result.inflowAmount, 18000);
  assert.equal(result.corroboratedAmount, 9000);
});

test("builds weeks, averages and flags partial weeks", () => {
  // Wed 2026-07-01 .. Sat 2026-07-25, trading Mon–Sat, 10 000 a day.
  const entries: Entry[] = [];
  let i = 0;
  for (let d = "2026-07-01"; d <= "2026-07-25"; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd !== 0) entries.push(entry(`e${i++}`, d, 10000));
  }
  entries.push(entry("pending", "2026-07-20", 99999, { status: "pending" }));
  entries.push(entry("rejected", "2026-07-20", 99999, { status: "rejected" }));
  entries.push(entry("exp", "2026-07-20", 4000, { type: "expense" }));

  const p = buildProfile(bundle(entries), TODAY);
  assert.equal(p.period?.start, "2026-07-01");
  assert.equal(p.weeks.length, 4);
  assert.equal(p.weeks[0].partial, true, "Wed–Sun is a partial week");
  assert.equal(p.weeks[1].partial, false);
  assert.equal(p.sales.avgWeekly, 60000, "full weeks only");
  assert.equal(p.sales.weeklyBasis, "full");
  assert.equal(p.counts.entriesPending, 1);
  assert.equal(p.counts.entriesRejected, 1);
  assert.equal(p.expenses.total, 4000);
  assert.equal(p.trend, null, "three full weeks is not enough for a trend");
  assert.equal(p.consistency?.label, "very_steady");
  assert.equal(p.weekdays.find((d) => d.day === 1)?.avgSales, 10000);
});

test("evidence strength weights add up to 100 and no evidence scores 0", () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  const empty = evidenceStrength({
    weeksSpan: 0, recordedWeeks: 0, fullRecordedWeeks: 0, confirmed: 0, pending: 0, momoInflows: 0,
    corroborationRate: 0, checksPassed: 0, checksTotal: 0, entriesCounted: 0, duplicateLines: 0,
    blockedDuplicates: 0, crossTraderAttempts: 0,
  });
  assert.equal(empty.score, 0);
  const perfect = evidenceStrength({
    weeksSpan: 8, recordedWeeks: 8, fullRecordedWeeks: 8, confirmed: 400, pending: 0, momoInflows: 30,
    corroborationRate: 1, checksPassed: 48, checksTotal: 48, entriesCounted: 400, duplicateLines: 0,
    blockedDuplicates: 0, crossTraderAttempts: 0,
  });
  assert.equal(perfect.score, 100);
  assert.equal(perfect.grade, "strong");
});

test("demo businesses are consistent end to end", () => {
  const db = buildDemoDatabase(TODAY);
  assert.equal(db.traders.length, 4);
  const byName = (name: string) => {
    const trader = db.traders.find((t) => t.name.startsWith(name));
    assert.ok(trader);
    const b: TraderBundle = {
      trader,
      sources: db.sources.filter((s) => s.traderId === trader.id),
      entries: db.entries.filter((e) => e.traderId === trader.id),
      momo: db.momo.filter((m) => m.traderId === trader.id),
      events: db.events.filter((e) => e.traderId === trader.id),
    };
    return { b, p: buildProfile(b, TODAY) };
  };

  const estelle = byName("Estelle");
  assert.ok(estelle.p.hasData);
  assert.equal(estelle.p.trend?.direction, "growing");
  assert.equal(estelle.p.checks.failing.length, 1, "one written total does not match");
  assert.equal(estelle.p.integrity.blockedDuplicates, 1);
  assert.equal(estelle.p.counts.momoDuplicates, 1);
  assert.ok(estelle.p.momo.unmatchedIds.length >= 3, "family transfers are not sales");
  assert.ok(estelle.p.momo.rateAmount > 0.5);
  assert.ok(estelle.p.strength.score >= 70, `strength ${estelle.p.strength.score}`);
  assert.equal(estelle.b.trader.consent.granted, true);

  const joseph = byName("Joseph");
  assert.equal(joseph.p.checks.total, 0, "Joseph never writes totals");
  assert.ok(joseph.p.momo.unmatchedIds.length >= 4);

  const brenda = byName("Brenda");
  assert.equal(brenda.p.checks.failing.length, 0);
  assert.ok(brenda.p.strength.score > joseph.p.strength.score);

  const aicha = byName("Aïcha");
  assert.equal(aicha.b.trader.consent.granted, false);
  assert.ok(aicha.p.counts.entriesPending > 10, "Aïcha has pages waiting for review");
  assert.ok(aicha.b.entries.some((e) => e.flags.includes("math_mismatch")));

  // every entry points at a real source with a box on the page
  const sourceIds = new Set(db.sources.map((s) => s.id));
  assert.ok(db.entries.every((e) => sourceIds.has(e.sourceId) && e.box));
});
