import { test } from "node:test";
import assert from "node:assert/strict";
import { auditAnswer, buildEvidencePack, findUntracedNumbers } from "./ask.ts";
import { buildDemoDatabase } from "../demo/seed.ts";
import { buildProfile } from "./profile.ts";
import { buildLedger } from "../organize/ledger.ts";
import type { TraderBundle } from "../types.ts";

const TODAY = "2026-09-30";

function estellePack() {
  const db = buildDemoDatabase(TODAY);
  const trader = db.traders[0];
  const bundle: TraderBundle = {
    trader,
    sources: db.sources.filter((s) => s.traderId === trader.id),
    entries: db.entries.filter((e) => e.traderId === trader.id),
    momo: db.momo.filter((m) => m.traderId === trader.id),
    events: db.events.filter((e) => e.traderId === trader.id),
  };
  const profile = buildProfile(bundle, TODAY);
  const ledger = buildLedger(bundle);
  return { profile, pack: buildEvidencePack(trader, profile, ledger.counted, ledger.momo) };
}

test("the evidence pack gives every line and week a citation code", () => {
  const { profile, pack } = estellePack();
  assert.ok(pack.text.includes("SUMMARY"));
  assert.ok(pack.refs.E1?.kind === "entry");
  assert.ok(pack.refs[`W${profile.weeks[0].key}`]?.kind === "week");
  assert.ok(pack.numbers.includes(profile.sales.total));
});

test("audits citations: keeps real codes, drops invented ones", () => {
  const { profile, pack } = estellePack();
  const week = `W${profile.weeks[1].key}`;
  const audited = auditAnswer(
    {
      answerable: true,
      answer: `Sales were strong that week [${week}, E99999]. Tomatoes lead [E1].`,
      citations: ["E2", "FAKE"],
      confidence: "high",
    },
    pack,
  );
  const codes = audited.citations.map((c) => c.code);
  assert.deepEqual(codes, [week, "E1", "E2"]);
  assert.ok(audited.segments.some((s) => s.type === "cite" && s.code === week));
  assert.ok(!audited.segments.some((s) => s.type === "cite" && s.code === "E99999"));
});

test("flags figures that cannot be traced to the evidence", () => {
  const { profile, pack } = estellePack();
  const real = profile.sales.avgWeekly;
  const spaced = String(real).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  assert.deepEqual(findUntracedNumbers(`Average week: ${spaced} FCFA, in 2026, 12 days.`, pack), []);
  assert.deepEqual(findUntracedNumbers("She sells 987 654 FCFA a week.", pack), [987654]);
  assert.deepEqual(findUntracedNumbers("Growth of 999% per month.", pack), [999]);
});

test("items can be cited, and dropped markers leave clean text", () => {
  const { pack } = estellePack();
  assert.equal(pack.refs.I1?.kind, "item");
  const audited = auditAnswer(
    { answerable: true, answer: "Growth was steady [SUMMARY]. Plantain leads [I1] .", citations: [], confidence: "high" },
    pack,
  );
  const text = audited.segments.map((s) => (s.type === "text" ? s.text : `{${s.code}}`)).join("");
  assert.equal(text, "Growth was steady. Plantain leads {I1}.");
});

test("summary figures are citable, bare codes become chips, silence is flagged", () => {
  const { profile, pack } = estellePack();
  assert.deepEqual(pack.refs.G1, { kind: "group", key: "sales" });
  assert.equal(pack.refs.G4?.kind, "group");
  const month = `MO${profile.months[1].key}`;
  const bare = auditAnswer({ answerable: true, answer: `Sales rose in ${month} to a record.`, citations: [], confidence: "high" }, pack);
  assert.ok(bare.segments.some((s) => s.type === "cite" && s.code === month), "a code written in the sentence becomes a chip");
  assert.equal(bare.uncited, false);
  const silent = auditAnswer({ answerable: true, answer: "Sales are good.", citations: [], confidence: "high" }, pack);
  assert.equal(silent.uncited, true);
  const refused = auditAnswer({ answerable: false, answer: "The records do not cover loans.", citations: [], confidence: "low" }, pack);
  assert.equal(refused.uncited, false);
});
