import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPhone, parseSms, splitMessages } from "./sms.ts";

const TODAY = "2026-09-30";

test("reads an MTN MoMo payment received in French", () => {
  const r = parseSms(
    "Vous avez reçu 5 000 FCFA de MARIE N. (237677123456) le 21/07/2026 à 10:42. Nouveau solde: 48 250 FCFA. ID transaction: 8812345678. MTN MoMo",
    TODAY,
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tx.provider, "mtn");
  assert.equal(r.tx.direction, "in");
  assert.equal(r.tx.kind, "received");
  assert.equal(r.tx.amount, 5000);
  assert.equal(r.tx.balance, 48250);
  assert.equal(r.tx.date, "2026-07-21");
  assert.equal(r.tx.time, "10:42");
  assert.equal(r.tx.ref, "8812345678");
  assert.equal(r.tx.counterparty, "MARIE N.");
  assert.equal(r.tx.phone, "677123456");
});

test("reads an Orange Money transfer received", () => {
  const r = parseSms(
    "Transfert de 3000 FCFA reçu de 237699112233 PAUL T. le 21/07/2026 14:05. Solde: 25400 FCFA. Ref: CI260721.1405.A12345. Orange Money",
    TODAY,
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tx.provider, "orange");
  assert.equal(r.tx.direction, "in");
  assert.equal(r.tx.amount, 3000);
  assert.equal(r.tx.balance, 25400);
  assert.equal(r.tx.ref, "CI260721.1405.A12345");
  assert.equal(r.tx.counterparty, "PAUL T.");
});

test("reads an Orange Money transfer sent with vers", () => {
  const r = parseSms(
    "Transfert de 15000 FCFA vers 237650998877 GROSSISTE effectué le 22/07/2026 06:15. Frais: 150 FCFA. Solde: 10250 FCFA. Ref: CI260722.0615.B99881. Orange Money",
    TODAY,
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tx.direction, "out");
  assert.equal(r.tx.kind, "sent");
  assert.equal(r.tx.amount, 15000);
  assert.equal(r.tx.fee, 150);
  assert.equal(r.tx.balance, 10250);
});

test("keeps fee and balance apart from the amount in English", () => {
  const r = parseSms(
    "You have sent 25,000 FCFA to GROSSISTE (237650998877) on 03/08/2026 at 07:10. Fee: 250 FCFA. New balance: 4,100 FCFA. Transaction Id: 7712004411. MTN MoMo",
    TODAY,
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tx.amount, 25000);
  assert.equal(r.tx.fee, 250);
  assert.equal(r.tx.balance, 4100);
  assert.equal(r.tx.direction, "out");
});

test("a deposit is recognised as the trader's own cash-in", () => {
  const r = parseSms("Vous avez reçu un dépôt de 20 000 FCFA le 05/08/2026 à 09:00. Solde: 30 000 FCFA. ID transaction: 5566778899", TODAY);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.tx.kind, "deposit");
});

test("never guesses a missing date", () => {
  const r = parseSms("Vous avez reçu 5 000 FCFA de MARIE N. ID transaction: 8812345678", TODAY);
  assert.deepEqual(r, { ok: false, raw: "Vous avez reçu 5 000 FCFA de MARIE N. ID transaction: 8812345678", reason: "no_date" });
});

test("reports messages without an amount or direction", () => {
  const noAmount = parseSms("Bonjour, votre forfait internet expire le 21/07/2026.", TODAY);
  assert.equal(noAmount.ok, false);
  if (!noAmount.ok) assert.equal(noAmount.reason, "no_amount");
  const noDirection = parseSms("Promo: gagnez 5000 FCFA le 21/07/2026!", TODAY);
  assert.equal(noDirection.ok, false);
  if (!noDirection.ok) assert.equal(noDirection.reason, "no_direction");
});

test("splits pasted blocks into messages", () => {
  const block = [
    "Vous avez reçu 5 000 FCFA de A B. le 21/07/2026 à 10:42. ID transaction: 1234567890",
    "",
    "Vous avez reçu 2 000 FCFA de C D. le 21/07/2026 à 11:00. ID transaction: 1234567891",
  ].join("\n");
  assert.equal(splitMessages(block).length, 2);

  const perLine = [
    "You have received 1,000 FCFA from A B. on 21/07/2026 at 10:42. Transaction Id: 1111111111",
    "You have received 2,000 FCFA from C D. on 21/07/2026 at 10:50. Transaction Id: 2222222222",
    "You have received 3,000 FCFA from E F. on 21/07/2026 at 11:02. Transaction Id: 3333333333",
  ].join("\n");
  assert.equal(splitMessages(perLine).length, 3);

  const wrapped = "Vous avez reçu 5 000 FCFA de A B.\nle 21/07/2026 à 10:42.\nID transaction: 1234567890";
  assert.equal(splitMessages(wrapped).length, 1);
});

test("masks phone numbers for display", () => {
  assert.equal(maskPhone("677123456"), "6•• ••• •56");
  assert.equal(maskPhone(undefined), undefined);
});
