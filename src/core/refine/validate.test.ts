import { test } from "node:test";
import assert from "node:assert/strict";
import { blockingIssues, flagsAfterTraderEdit, normalizeBox, pageChecks, refinePage } from "./validate.ts";
import { parseLooseDate } from "../dates.ts";
import { parseAmount } from "../money.ts";

const TODAY = "2026-09-30";

const line = (over: Record<string, unknown>) => ({
  rawText: "",
  kind: "sale",
  description: "",
  date: "",
  dateText: "",
  quantity: 0,
  unit: "",
  unitPrice: 0,
  amount: 0,
  box: [100, 100, 150, 900],
  confidence: 0.95,
  ...over,
});

test("parses dates the way traders write them", () => {
  assert.equal(parseLooseDate("14/07", TODAY), "2026-07-14");
  assert.equal(parseLooseDate("Lundi 14/07/2026", TODAY), "2026-07-14");
  assert.equal(parseLooseDate("14-07-26", TODAY), "2026-07-14");
  assert.equal(parseLooseDate("25/12", TODAY), "2025-12-25", "a future day without a year means last year");
  assert.equal(parseLooseDate("07/14/2026", TODAY), "2026-07-14", "month-first only when day-first is impossible");
  assert.equal(parseLooseDate("14 juillet", TODAY), "2026-07-14");
  assert.equal(parseLooseDate("July 14, 2026", TODAY), "2026-07-14");
  assert.equal(parseLooseDate("31/02/2026", TODAY), null);
  assert.equal(parseLooseDate("Tomates", TODAY), null);
});

test("parses amounts in every local style", () => {
  assert.equal(parseAmount("2 500"), 2500);
  assert.equal(parseAmount("2.500"), 2500);
  assert.equal(parseAmount("2,500 FCFA"), 2500);
  assert.equal(parseAmount("2500f"), 2500);
  assert.equal(parseAmount("1500frs"), 1500);
  assert.equal(parseAmount("2k5"), 2500);
  assert.equal(parseAmount("2,5k"), 2500);
  assert.equal(parseAmount("15k"), 15000);
  assert.equal(parseAmount("FCFA 12 500"), 12500);
  assert.equal(parseAmount("abc"), null);
});

test("refines a page: headers, carried dates, totals and flags", () => {
  const page = refinePage(
    {
      document: "sales_notebook",
      legible: true,
      language: "fr",
      pageDate: "",
      pageDateText: "",
      note: "",
      lines: [
        line({ kind: "date_header", rawText: "Lundi 14/07", dateText: "Lundi 14/07" }),
        line({ description: "Tomates 3 tas", amount: 1500, confidence: 0.97 }),
        line({ description: "Piment", quantity: 3, unitPrice: 200, amount: 0 }),
        line({ description: "Plantain", quantity: 2, unitPrice: 4000, amount: 5000 }),
        line({ description: "Oignons", amount: 1003 }),
        line({ kind: "expense", description: "Transport", amount: 1000, confidence: 72 }),
        line({ kind: "total_sales", description: "Total ventes", amount: 8100 }),
        line({ kind: "other", rawText: "merci" }),
      ],
    },
    TODAY,
  );

  assert.equal(page.entries.length, 5);
  assert.ok(page.entries.every((e) => e.date === "2026-07-14"), "lines inherit the date heading");

  const [tomates, piment, plantain, oignons, transport] = page.entries;
  assert.deepEqual(tomates.flags, []);
  assert.equal(piment.amount, 600, "missing amount computed from quantity x price");
  assert.ok(piment.flags.includes("amount_computed"));
  assert.ok(plantain.flags.includes("math_mismatch"), "2 x 4000 is not 5000");
  assert.ok(plantain.flags.includes("low_confidence"));
  assert.ok(oignons.flags.includes("unusual_amount"));
  assert.equal(transport.type, "expense");
  assert.equal(transport.confidence, 0.72, "percent confidence is rescaled");
  assert.ok(transport.flags.includes("low_confidence"));

  assert.equal(page.writtenTotals.length, 1);
  assert.equal(page.writtenTotals[0].amount, 8100);
  assert.equal(page.writtenTotals[0].date, "2026-07-14");
});

test("flags lines with no date and blocks confirmation", () => {
  const page = refinePage(
    { document: "sales_notebook", legible: true, lines: [line({ description: "Gombo", amount: 400 })] },
    TODAY,
  );
  const e = page.entries[0];
  assert.ok(e.flags.includes("date_missing"));
  assert.deepEqual(blockingIssues({ ...e, status: "pending" }, TODAY), ["date_missing"]);
  assert.deepEqual(blockingIssues({ ...e, date: "2026-07-14", status: "pending" }, TODAY), []);
  assert.deepEqual(flagsAfterTraderEdit({ date: "2026-07-14", amount: 400 }, TODAY), []);
  assert.deepEqual(flagsAfterTraderEdit({ date: "2031-01-01", amount: 0 }, TODAY), ["date_out_of_range", "amount_missing"]);
});

test("rejects output that is not a page", () => {
  assert.throws(() => refinePage("nonsense", TODAY), { name: "TrustError" });
});

test("normalises boxes from either scale and rejects broken ones", () => {
  assert.deepEqual(normalizeBox([0.1, 0.2, 0.15, 0.9]), [100, 200, 150, 900]);
  assert.deepEqual(normalizeBox([150, 900, 100, 200]), [100, 200, 150, 900]);
  assert.equal(normalizeBox([1, 2, 3]), undefined);
  assert.equal(normalizeBox([100, 100, 100, 900]), undefined);
});

test("checks written totals against the lines", () => {
  const entries = [
    { date: "2026-07-14", amount: 1500, type: "sale" as const, status: "confirmed" as const },
    { date: "2026-07-14", amount: 2000, type: "sale" as const, status: "confirmed" as const },
    { date: "2026-07-14", amount: 900, type: "sale" as const, status: "rejected" as const },
    { date: "2026-07-14", amount: 1000, type: "expense" as const, status: "confirmed" as const },
  ];
  const [ok] = pageChecks(entries, [{ label: "Total", amount: 3500, type: "sale" }]);
  assert.equal(ok.ok, true);
  const [bad] = pageChecks(entries, [{ label: "Total", amount: 4500, type: "sale" }]);
  assert.equal(bad.ok, false);
  assert.equal(bad.difference, 1000);
});
