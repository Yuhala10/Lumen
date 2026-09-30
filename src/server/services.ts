import { createHash } from "node:crypto";
import type {
  Database,
  Entry,
  EntryValues,
  EventType,
  MomoTx,
  Source,
  SourceKind,
  Trader,
  TraderBundle,
  TrustEvent,
} from "@/core/types";
import { TrustError } from "@/core/errors";
import { todayIso } from "@/core/dates";
import { isId, newId, newShareCode, normalizeShareCode } from "@/core/ids";
import { parseSms, splitMessages, type SmsFailure } from "@/core/discover/sms";
import { findPhotoDuplicate, markMomoDuplicates } from "@/core/refine/dedupe";
import { blockingIssues, flagsAfterTraderEdit, type MomoDraft } from "@/core/refine/validate";
import { buildLedger } from "@/core/organize/ledger";
import { buildProfile, type Profile, type TrendDirection } from "@/core/understand/profile";
import type { Grade } from "@/core/understand/strength";
import { askSystemPrompt, ASK_JSON_SCHEMA, auditAnswer, buildEvidencePack, type AuditedAnswer } from "@/core/understand/ask";
import {
  AskInputSchema,
  EntryAddSchema,
  EntryPatchSchema,
  MAX_PHOTO_BYTES,
  PHOTO_KINDS,
  TraderInputSchema,
} from "@/core/validation";
import { deleteUpload, mutate, readDb, readUpload, resetStore, saveUpload } from "./store";
import { readMessages, readPhoto } from "./reader";
import { aiConfig, generateJson } from "./gemini";
import type { z } from "zod";

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString();

function event(db: Database, traderId: string, type: EventType, extra: Partial<TrustEvent> = {}): void {
  db.events.push({ id: newId("ev"), traderId, at: now(), type, ...extra });
}

function touch(db: Database, traderId: string): void {
  const t = db.traders.find((x) => x.id === traderId);
  if (t) t.updatedAt = now();
}

function notFound(what: string): TrustError {
  return new TrustError("not_found", `${what} not found.`, 404);
}

export function bundleOf(db: Database, traderId: string): TraderBundle {
  const trader = db.traders.find((t) => t.id === traderId);
  if (!trader) throw notFound("Business");
  return {
    trader,
    sources: db.sources.filter((s) => s.traderId === traderId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    entries: db.entries.filter((e) => e.traderId === traderId).sort((a, b) => a.seq - b.seq),
    momo: db.momo.filter((m) => m.traderId === traderId),
    events: db.events.filter((e) => e.traderId === traderId).sort((a, b) => a.at.localeCompare(b.at)),
  };
}

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

/** Trust the bytes, not the file name or the browser's claim. */
export function sniffImage(b: Uint8Array): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (b.length > 12 && ascii(b, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1|heif)$/.test(ascii(b, 8, 12))) {
    return "image/heic";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* reading views                                                        */
/* ------------------------------------------------------------------ */

export interface TraderSummary {
  trader: Trader;
  strength: { score: number; grade: Grade };
  avgWeekly: number;
  trend: { direction: TrendDirection; pct: number } | null;
  period: Profile["period"];
  pages: number;
  pagesAwaitingReview: number;
  entriesPending: number;
  momoRate: number;
  momoInflows: number;
  lastActivity: string;
}

export async function listSummaries(): Promise<TraderSummary[]> {
  const db = await readDb();
  const today = todayIso();
  return db.traders
    .map((trader) => {
      const b = bundleOf(db, trader.id);
      const p = buildProfile(b, today);
      return {
        trader,
        strength: { score: p.strength.score, grade: p.strength.grade },
        avgWeekly: p.sales.avgWeekly,
        trend: p.trend ? { direction: p.trend.direction, pct: p.trend.pctPer4Weeks } : null,
        period: p.period,
        pages: p.counts.pages,
        pagesAwaitingReview: p.counts.pagesAwaitingReview,
        entriesPending: p.counts.entriesPending,
        momoRate: p.momo.rateAmount,
        momoInflows: p.momo.inflowIds.length,
        lastActivity: b.events.at(-1)?.at ?? trader.updatedAt,
      };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export async function getTraderView(traderId: string): Promise<{ bundle: TraderBundle; profile: Profile }> {
  const db = await readDb();
  const bundle = bundleOf(db, traderId);
  return { bundle, profile: buildProfile(bundle, todayIso()) };
}

export async function findSharedByCode(code: string): Promise<Trader | null> {
  const db = await readDb();
  const wanted = normalizeShareCode(code);
  return db.traders.find((t) => t.consent.granted && t.consent.code === wanted) ?? null;
}

export async function getSourceImage(sourceId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!isId(sourceId, "src")) return null;
  const db = await readDb();
  const source = db.sources.find((s) => s.id === sourceId);
  if (!source?.file) return null;
  const bytes = await readUpload(sourceId);
  return bytes ? { bytes, mime: source.file.mime } : null;
}

export function aiStatus() {
  const cfg = aiConfig();
  return { configured: cfg.configured, model: cfg.model, fallback: cfg.fallback };
}

/* ------------------------------------------------------------------ */
/* traders                                                              */
/* ------------------------------------------------------------------ */

export async function createTrader(input: z.input<typeof TraderInputSchema>): Promise<Trader> {
  const v = TraderInputSchema.parse(input);
  return mutate((db) => {
    const at = now();
    const trader: Trader = {
      id: newId("tr"),
      createdAt: at,
      updatedAt: at,
      name: v.name,
      business: v.business,
      market: v.market,
      city: v.city,
      phone: v.phone || undefined,
      providers: v.providers,
      consent: { granted: false },
    };
    db.traders.push(trader);
    event(db, trader.id, "trader_created");
    return trader;
  });
}

export async function deleteTrader(traderId: string): Promise<void> {
  const removed = await mutate((db) => {
    bundleOf(db, traderId);
    const files = db.sources.filter((s) => s.traderId === traderId && s.file).map((s) => s.id);
    db.traders = db.traders.filter((t) => t.id !== traderId);
    db.sources = db.sources.filter((s) => s.traderId !== traderId);
    db.entries = db.entries.filter((e) => e.traderId !== traderId);
    db.momo = db.momo.filter((m) => m.traderId !== traderId);
    db.events = db.events.filter((e) => e.traderId !== traderId);
    return files;
  });
  await Promise.all(removed.map(deleteUpload));
}

export async function setConsent(traderId: string, granted: boolean): Promise<Trader> {
  return mutate((db) => {
    const trader = bundleOf(db, traderId).trader;
    if (granted && !trader.consent.granted) {
      const taken = new Set(db.traders.map((t) => t.consent.code).filter(Boolean));
      let code = newShareCode();
      while (taken.has(code)) code = newShareCode();
      trader.consent = { granted: true, grantedAt: now(), code };
      event(db, traderId, "consent_granted");
    } else if (!granted && trader.consent.granted) {
      // Revoking kills the code: an old link or code never works again.
      trader.consent = { granted: false, revokedAt: now() };
      event(db, traderId, "consent_revoked");
    }
    touch(db, traderId);
    return trader;
  });
}

/* ------------------------------------------------------------------ */
/* Discover: photos and messages                                        */
/* ------------------------------------------------------------------ */

export interface PhotoUpload {
  bytes: Uint8Array;
  kind: string;
  dhash: string;
  width: number;
  height: number;
  name?: string;
}

export async function addPhoto(traderId: string, upload: PhotoUpload): Promise<Source> {
  if (!PHOTO_KINDS.includes(upload.kind as (typeof PHOTO_KINDS)[number])) {
    throw new TrustError("invalid_input", "Unknown photo kind.", 400);
  }
  if (upload.bytes.length > MAX_PHOTO_BYTES) throw new TrustError("image_too_large", "Photo is larger than 10 MB.", 413);
  const mime = sniffImage(upload.bytes);
  if (!mime) throw new TrustError("image_invalid", "This file is not a photo Trust can read.", 415);

  const sha256 = createHash("sha256").update(upload.bytes).digest("hex");
  const dhash = /^[0-9a-f]{64}$/.test(upload.dhash) ? upload.dhash : "";
  const kind = upload.kind as Exclude<SourceKind, "momo_sms">;

  const result = await mutate((db) => {
    bundleOf(db, traderId);
    const match = findPhotoDuplicate({ sha256, dhash }, db.sources, traderId);
    if (match?.kind === "exact") {
      event(db, traderId, "photo_duplicate_blocked", {
        detail: { of: match.sourceId, crossTrader: match.crossTrader, match: "exact" },
      });
      return { blocked: match } as const;
    }
    const source: Source = {
      id: newId("src"),
      traderId,
      kind,
      createdAt: now(),
      status: match ? "duplicate" : "pending",
      duplicateOf: match?.sourceId,
      file: {
        mime,
        bytes: upload.bytes.length,
        width: Math.max(1, Math.round(upload.width) || 1),
        height: Math.max(1, Math.round(upload.height) || 1),
        sha256,
        dhash,
        name: upload.name?.slice(0, 120),
      },
    };
    db.sources.push(source);
    event(db, traderId, "photo_added", { sourceId: source.id });
    if (match) {
      event(db, traderId, "photo_duplicate_flagged", {
        sourceId: source.id,
        detail: { of: match.sourceId, crossTrader: match.crossTrader, distance: match.distance },
      });
    }
    touch(db, traderId);
    return { source } as const;
  });

  if (result.blocked) {
    const m = result.blocked;
    throw new TrustError(
      "duplicate_photo",
      m.crossTrader ? "This photo already belongs to another business." : "This exact photo was already added.",
      409,
      { of: m.traderId === traderId ? m.sourceId : undefined, crossTrader: m.crossTrader },
    );
  }

  try {
    await saveUpload(result.source.id, upload.bytes);
  } catch (err) {
    await mutate((db) => {
      db.sources = db.sources.filter((s) => s.id !== result.source.id);
    });
    throw err;
  }
  return result.source;
}

export async function keepDuplicate(sourceId: string): Promise<Source> {
  return mutate((db) => {
    const s = db.sources.find((x) => x.id === sourceId);
    if (!s) throw notFound("Photo");
    if (s.status === "duplicate") {
      s.status = "pending";
      s.duplicateKept = true;
      event(db, s.traderId, "photo_duplicate_kept", { sourceId });
    }
    return s;
  });
}

export async function deleteSource(sourceId: string): Promise<void> {
  const hadFile = await mutate((db) => {
    const s = db.sources.find((x) => x.id === sourceId);
    if (!s) throw notFound("Photo");
    db.sources = db.sources.filter((x) => x.id !== sourceId);
    db.entries = db.entries.filter((e) => e.sourceId !== sourceId);
    db.momo = db.momo.filter((m) => m.sourceId !== sourceId);
    for (const other of db.sources) other.distinctFrom = other.distinctFrom?.filter((id) => id !== sourceId);
    event(db, s.traderId, "page_deleted", { detail: { kind: s.kind } });
    touch(db, s.traderId);
    return Boolean(s.file);
  });
  if (hadFile) await deleteUpload(sourceId);
}

export interface ReadResult {
  source: Source;
  entries: Entry[];
  momo: MomoTx[];
  unread: { raw: string; reason: SmsFailure }[];
}

/**
 * Reads one photo with the AI. The lock is held only to change status, never
 * during the slow AI call, so the rest of the app stays responsive.
 */
export async function readSource(sourceId: string): Promise<ReadResult> {
  const today = todayIso();
  const { source, trader } = await mutate((db) => {
    const s = db.sources.find((x) => x.id === sourceId);
    if (!s || !s.file) throw notFound("Photo");
    if (s.status === "duplicate") throw new TrustError("duplicate_photo", "Decide about the possible duplicate first.", 409);
    if (s.confirmedAt) throw new TrustError("page_confirmed", "This page is already confirmed.", 409);
    s.status = "reading";
    s.error = undefined;
    return { source: { ...s }, trader: bundleOf(db, s.traderId).trader };
  });

  const bytes = await readUpload(sourceId);
  try {
    if (!bytes || !source.file) throw new TrustError("image_invalid", "The photo file is missing.", 410);
    const reading = await readPhoto({
      kind: source.kind as Exclude<SourceKind, "momo_sms">,
      bytes,
      mime: source.file.mime,
      trader,
      today,
    });

    return await mutate((db) => {
      const s = db.sources.find((x) => x.id === sourceId);
      if (!s) throw notFound("Photo");
      const at = now();
      db.entries = db.entries.filter((e) => !(e.sourceId === sourceId && e.origin === "ai"));
      db.momo = db.momo.filter((m) => m.sourceId !== sourceId);
      const added: Entry[] = [];
      let addedMomo: MomoTx[] = [];
      let unread: ReadResult["unread"] = [];

      if (reading.kind === "page") {
        const p = reading.page;
        const keptSeq = db.entries.filter((e) => e.sourceId === sourceId).length;
        for (const d of p.entries) {
          const entry: Entry = {
            id: newId("en"),
            traderId: s.traderId,
            sourceId,
            seq: d.seq + keptSeq,
            origin: "ai",
            status: "pending",
            date: d.date,
            description: d.description,
            amount: d.amount,
            type: d.type,
            quantity: d.quantity,
            unit: d.unit,
            unitPrice: d.unitPrice,
            raw: d.raw,
            box: d.box,
            confidence: d.confidence,
            flags: d.flags,
          };
          db.entries.push(entry);
          added.push(entry);
        }
        s.reading = {
          model: reading.model,
          at,
          ms: reading.ms,
          attempts: reading.attempts,
          document: p.document,
          legible: p.legible,
          language: p.language,
          note: p.note,
          pageDate: p.pageDate,
          writtenTotals: p.writtenTotals,
        };
      } else {
        const m = reading.momo;
        const drafts = m.transactions.map((t) => toMomo(t, s.traderId, sourceId, "ai"));
        const existing = db.momo.filter((x) => x.traderId === s.traderId);
        addedMomo = markMomoDuplicates(existing, drafts);
        db.momo.push(...addedMomo);
        unread = m.unread;
        s.reading = {
          model: reading.model,
          at,
          ms: reading.ms,
          attempts: reading.attempts,
          document: m.document,
          legible: m.legible,
          note: m.note,
          writtenTotals: [],
        };
      }
      s.status = "read";
      s.error = undefined;
      event(db, s.traderId, "page_read", {
        sourceId,
        detail: { lines: added.length + addedMomo.length, model: reading.model, ms: reading.ms },
      });
      touch(db, s.traderId);
      return { source: s, entries: added, momo: addedMomo, unread };
    });
  } catch (err) {
    const error = err instanceof TrustError ? err : new TrustError("internal", (err as Error).message, 500);
    await mutate((db) => {
      const s = db.sources.find((x) => x.id === sourceId);
      if (!s) return;
      s.status = "failed";
      s.error = { code: error.code, message: error.message };
      event(db, s.traderId, "page_read_failed", { sourceId, detail: { code: error.code } });
    });
    throw error;
  }
}

function toMomo(t: MomoDraft & { phone?: string }, traderId: string, sourceId: string, method: "rules" | "ai"): MomoTx {
  return {
    id: newId("mm"),
    traderId,
    sourceId,
    provider: t.provider,
    direction: t.direction,
    kind: t.kind,
    amount: t.amount,
    fee: t.fee,
    balance: t.balance,
    date: t.date,
    time: t.time,
    ref: t.ref,
    counterparty: t.counterparty,
    phone: t.phone,
    raw: t.raw,
    box: t.box,
    confidence: t.confidence,
    method,
  };
}

export interface MessagesResult {
  source: Source | null;
  added: MomoTx[];
  duplicates: MomoTx[];
  unread: { raw: string; reason: SmsFailure }[];
  usedAi: boolean;
}

export async function addMessages(traderId: string, text: string): Promise<MessagesResult> {
  const today = todayIso();
  const db0 = await readDb();
  const trader = bundleOf(db0, traderId).trader;

  const drafts: { tx: MomoDraft & { phone?: string }; method: "rules" | "ai" }[] = [];
  let unread: MessagesResult["unread"] = [];
  for (const raw of splitMessages(text)) {
    const r = parseSms(raw, today);
    if (r.ok) drafts.push({ tx: r.tx, method: "rules" });
    else unread.push({ raw: r.raw, reason: r.reason });
  }

  // Rules first. The AI only gets messages the rules could not place, and
  // never messages without a date: a date cannot be recovered by reading harder.
  let usedAi = false;
  const retry = unread.filter((u) => u.reason !== "no_date");
  if (retry.length && aiConfig().configured) {
    try {
      const ai = await readMessages(retry.map((u) => u.raw), trader, today);
      usedAi = true;
      for (const t of ai.transactions) drafts.push({ tx: t, method: "ai" });
      unread = [...unread.filter((u) => u.reason === "no_date"), ...ai.unread];
    } catch {
      /* keep the rule-based result; the unread list tells the trader what to fix */
    }
  }

  if (!drafts.length) return { source: null, added: [], duplicates: [], unread, usedAi };

  return mutate((db) => {
    bundleOf(db, traderId);
    const source: Source = { id: newId("src"), traderId, kind: "momo_sms", createdAt: now(), status: "read", text };
    const incoming = drafts.map((d) => toMomo(d.tx, traderId, source.id, d.method));
    const existing = db.momo.filter((m) => m.traderId === traderId);
    const marked = markMomoDuplicates(existing, incoming);
    db.sources.push(source);
    db.momo.push(...marked);
    const duplicates = marked.filter((m) => m.duplicateOf);
    event(db, traderId, "messages_added", {
      sourceId: source.id,
      detail: { found: marked.length - duplicates.length, duplicates: duplicates.length, unread: unread.length },
    });
    touch(db, traderId);
    return { source, added: marked.filter((m) => !m.duplicateOf), duplicates, unread, usedAi };
  });
}

/* ------------------------------------------------------------------ */
/* Refine: the trader's review                                          */
/* ------------------------------------------------------------------ */

export async function updateEntry(entryId: string, input: unknown): Promise<Entry> {
  const patch = EntryPatchSchema.parse(input);
  const today = todayIso();
  return mutate((db) => {
    const e = db.entries.find((x) => x.id === entryId);
    if (!e) throw notFound("Line");
    const at = now();

    if (patch.status === "rejected") {
      if (e.status !== "rejected") {
        e.status = "rejected";
        e.confirmedAt = undefined;
        event(db, e.traderId, "entry_rejected", { sourceId: e.sourceId, entryId: e.id });
      }
      touch(db, e.traderId);
      return e;
    }

    const before: EntryValues = { date: e.date, description: e.description, amount: e.amount, type: e.type };
    const after: EntryValues = {
      date: patch.date ?? e.date,
      description: patch.description ?? e.description,
      amount: patch.amount ?? e.amount,
      type: patch.type ?? e.type,
    };
    const changed = (Object.keys(after) as (keyof EntryValues)[]).some((k) => after[k] !== before[k]);

    if (e.status === "rejected") {
      e.status = "pending";
      event(db, e.traderId, "entry_restored", { sourceId: e.sourceId, entryId: e.id });
    }
    if (changed) {
      if (e.origin === "ai" && !e.original) e.original = before;
      Object.assign(e, after);
      e.flags = flagsAfterTraderEdit(after, today);
      event(db, e.traderId, "entry_corrected", {
        sourceId: e.sourceId,
        entryId: e.id,
        detail: { from: before.amount, to: after.amount, dateChanged: before.date !== after.date },
      });
    }

    const issues = blockingIssues({ ...e, status: "pending" }, today);
    const target = patch.status ?? (changed ? (issues.length ? "pending" : "confirmed") : e.status);
    if (target === "confirmed") {
      if (issues.length) {
        throw new TrustError("page_has_issues", "This line still needs a valid date and amount.", 422, {
          entries: [{ id: e.id, issues }],
        });
      }
      e.status = "confirmed";
      e.confirmedAt ??= at;
    } else if (target === "pending") {
      e.status = "pending";
      e.confirmedAt = undefined;
    }
    touch(db, e.traderId);
    return e;
  });
}

export async function addEntry(input: unknown): Promise<Entry> {
  const v = EntryAddSchema.parse(input);
  const today = todayIso();
  const flags = flagsAfterTraderEdit({ date: v.date, amount: v.amount }, today);
  if (flags.length) throw new TrustError("page_has_issues", "The date must be within the last year.", 422, { issues: flags });
  return mutate((db) => {
    const s = db.sources.find((x) => x.id === v.sourceId);
    if (!s) throw notFound("Photo");
    const seq = Math.max(-1, ...db.entries.filter((e) => e.sourceId === s.id).map((e) => e.seq)) + 1;
    const entry: Entry = {
      id: newId("en"),
      traderId: s.traderId,
      sourceId: s.id,
      seq,
      origin: "trader",
      status: "confirmed",
      date: v.date,
      description: v.description,
      amount: v.amount,
      type: v.type,
      raw: "",
      confidence: 1,
      flags: [],
      confirmedAt: now(),
    };
    db.entries.push(entry);
    event(db, s.traderId, "entry_added", { sourceId: s.id, entryId: entry.id, detail: { amount: v.amount } });
    touch(db, s.traderId);
    return entry;
  });
}

export async function confirmPage(sourceId: string): Promise<Source> {
  const today = todayIso();
  return mutate((db) => {
    const s = db.sources.find((x) => x.id === sourceId);
    if (!s) throw notFound("Photo");
    if (s.status !== "read") throw new TrustError("invalid_input", "Only a page that has been read can be confirmed.", 409);
    const lines = db.entries.filter((e) => e.sourceId === sourceId && e.status === "pending");
    const problems = lines
      .map((e) => ({ id: e.id, issues: blockingIssues(e, today) }))
      .filter((p) => p.issues.length);
    if (problems.length) {
      throw new TrustError("page_has_issues", `${problems.length} line(s) still need a date or an amount.`, 422, { entries: problems });
    }
    const at = now();
    for (const e of lines) {
      e.status = "confirmed";
      e.confirmedAt = at;
    }
    s.confirmedAt = at;
    event(db, s.traderId, "page_confirmed", { sourceId, detail: { lines: lines.length } });
    touch(db, s.traderId);
    return s;
  });
}

export async function markDistinct(sourceId: string, otherId: string): Promise<void> {
  await mutate((db) => {
    const a = db.sources.find((x) => x.id === sourceId);
    const b = db.sources.find((x) => x.id === otherId);
    if (!a || !b || a.traderId !== b.traderId) throw notFound("Photo");
    a.distinctFrom = [...new Set([...(a.distinctFrom ?? []), otherId])];
    b.distinctFrom = [...new Set([...(b.distinctFrom ?? []), sourceId])];
    event(db, a.traderId, "pages_marked_distinct", { sourceId, detail: { other: otherId } });
  });
}

/* ------------------------------------------------------------------ */
/* Understand: questions                                                */
/* ------------------------------------------------------------------ */

export interface AskResult extends AuditedAnswer {
  model: string;
  ms: number;
}

export async function ask(traderId: string, input: unknown): Promise<AskResult> {
  const { question, locale } = AskInputSchema.parse(input);
  const db = await readDb();
  const bundle = bundleOf(db, traderId);
  const profile = buildProfile(bundle, todayIso());
  if (!profile.hasData) throw new TrustError("nothing_to_ask", "There are no confirmed records to ask about yet.", 409);
  const ledger = buildLedger(bundle);
  const pack = buildEvidencePack(bundle.trader, profile, ledger.counted, ledger.momo);
  const result = await generateJson({
    system: askSystemPrompt(locale),
    parts: [{ text: `EVIDENCE PACK\n${pack.text}\n\nQUESTION: ${question}` }],
    schema: ASK_JSON_SCHEMA,
  });
  return { ...auditAnswer(result.data, pack), model: result.model, ms: result.ms };
}

export async function resetDemo(): Promise<void> {
  await resetStore();
}
