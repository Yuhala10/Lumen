/**
 * Trust — domain model.
 *
 * Everything the product knows is one of five things:
 *   Trader   – the business being profiled
 *   Source   – a piece of raw evidence (a photo or a batch of pasted messages)
 *   Entry    – one line read from a notebook page or receipt
 *   MomoTx   – one mobile money transaction
 *   TrustEvent – the audit trail of who did what, when
 *
 * Dates are calendar dates in ISO form (YYYY-MM-DD). Money is whole FCFA (XAF).
 */

export type IsoDate = string;

/** [ymin, xmin, ymax, xmax] normalised to 0–1000 over the source image. */
export type Box = [number, number, number, number];

export type Provider = "mtn" | "orange";
export type Locale = "en" | "fr";

export interface Consent {
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  code?: string;
}

export interface Trader {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  business: string;
  market: string;
  city: string;
  phone?: string;
  providers: Provider[];
  consent: Consent;
  demo?: boolean;
}

export type SourceKind = "notebook" | "receipt" | "momo_screenshot" | "momo_sms";
export type SourceStatus = "pending" | "reading" | "read" | "failed" | "duplicate";

export interface ImageFile {
  mime: string;
  bytes: number;
  width: number;
  height: number;
  sha256: string;
  /** 256-bit difference hash (hex) used to spot re-photographed pages. */
  dhash: string;
  name?: string;
}

export interface DemoLine {
  text: string;
  amount: string;
}

/** A generated notebook page used by the built-in demo businesses. */
export interface DemoPage {
  header: string;
  lines: DemoLine[];
  total?: DemoLine;
  ink: "blue" | "black";
  tilt: number;
  seed: number;
}

export type MoneyDirection = "sale" | "expense";

export interface WrittenTotal {
  label: string;
  amount: number;
  type: MoneyDirection;
  date?: IsoDate;
  box?: Box;
}

export interface PageCheck {
  kind: "written_total";
  type: MoneyDirection;
  date?: IsoDate;
  written: number;
  computed: number;
  difference: number;
  ok: boolean;
  box?: Box;
}

export interface SourceReading {
  model: string;
  at: string;
  ms: number;
  attempts: number;
  document: string;
  legible: boolean;
  language?: string;
  note?: string;
  pageDate?: IsoDate;
  writtenTotals: WrittenTotal[];
}

export interface Source {
  id: string;
  traderId: string;
  kind: SourceKind;
  createdAt: string;
  status: SourceStatus;
  file?: ImageFile;
  demo?: DemoPage;
  /** Pasted mobile money messages (for kind "momo_sms"). */
  text?: string;
  /** Near-duplicate candidate: the earlier source this one resembles. */
  duplicateOf?: string;
  /** The trader looked at the duplicate warning and kept the page anyway. */
  duplicateKept?: boolean;
  /** Sources the trader declared are genuinely different pages. */
  distinctFrom?: string[];
  error?: { code: string; message: string };
  reading?: SourceReading;
  confirmedAt?: string;
}

export type EntryType = "sale" | "expense";
export type EntryStatus = "pending" | "confirmed" | "rejected";
export type EntryOrigin = "ai" | "trader";

export type EntryFlag =
  | "low_confidence"
  | "date_missing"
  | "date_out_of_range"
  | "amount_missing"
  | "amount_computed"
  | "math_mismatch"
  | "unusual_amount";

export interface EntryValues {
  date: IsoDate | "";
  description: string;
  amount: number;
  type: EntryType;
}

export interface Entry extends EntryValues {
  id: string;
  traderId: string;
  sourceId: string;
  seq: number;
  origin: EntryOrigin;
  status: EntryStatus;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  raw: string;
  box?: Box;
  confidence: number;
  flags: EntryFlag[];
  /** What the AI originally read, kept whenever the trader corrected it. */
  original?: EntryValues;
  confirmedAt?: string;
}

export type MomoDirection = "in" | "out";
export type MomoKind =
  | "received"
  | "payment_in"
  | "deposit"
  | "sent"
  | "payment_out"
  | "withdrawal"
  | "unknown";

export interface MomoTx {
  id: string;
  traderId: string;
  sourceId: string;
  provider: Provider | "unknown";
  direction: MomoDirection;
  kind: MomoKind;
  amount: number;
  fee?: number;
  balance?: number;
  date: IsoDate;
  time?: string;
  ref?: string;
  counterparty?: string;
  phone?: string;
  raw: string;
  box?: Box;
  confidence: number;
  method: "rules" | "ai";
  /** Set when this transaction repeats one already on file. */
  duplicateOf?: string;
}

export type EventType =
  | "trader_created"
  | "photo_added"
  | "photo_duplicate_blocked"
  | "photo_duplicate_flagged"
  | "photo_duplicate_kept"
  | "page_read"
  | "page_read_failed"
  | "entry_corrected"
  | "entry_added"
  | "entry_rejected"
  | "entry_restored"
  | "page_confirmed"
  | "page_deleted"
  | "pages_marked_distinct"
  | "messages_added"
  | "consent_granted"
  | "consent_revoked";

export interface TrustEvent {
  id: string;
  traderId: string;
  at: string;
  type: EventType;
  sourceId?: string;
  entryId?: string;
  detail?: Record<string, string | number | boolean>;
}

export interface Database {
  version: 1;
  traders: Trader[];
  sources: Source[];
  entries: Entry[];
  momo: MomoTx[];
  events: TrustEvent[];
}

/** Everything known about one trader. */
export interface TraderBundle {
  trader: Trader;
  sources: Source[];
  entries: Entry[];
  momo: MomoTx[];
  events: TrustEvent[];
}
