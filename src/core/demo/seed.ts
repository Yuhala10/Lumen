import type {
  Database,
  DemoLine,
  DemoPage,
  Entry,
  IsoDate,
  MomoTx,
  Provider,
  Source,
  Trader,
  TrustEvent,
  EventType,
} from "../types.ts";
import { addDays, weekday } from "../dates.ts";
import { groupThousands } from "../money.ts";
import { parseSms } from "../discover/sms.ts";
import { markMomoDuplicates } from "../refine/dedupe.ts";
import { layoutDemoPage, mulberry32, MAX_DEMO_LINES } from "./layout.ts";

/**
 * Demo businesses. Four fictional traders across Cameroon with generated
 * notebook pages and mobile money messages. The messages are run through the
 * real parser, so the demo exercises exactly the same logic as real use.
 */

type Rand = () => number;

interface ItemSpec {
  name: string;
  unit: string;
  prices: number[];
  qty: [number, number];
  weight: number;
}

interface ExpenseSpec {
  text: string;
  amounts: number[];
  chance: number;
  viaMomo?: boolean;
}

interface MomoSpec {
  lang: "fr" | "en";
  providers: Provider[];
  customerShare: number;
  familyTransfers: number;
  oversizedPayments: number;
  duplicateMessages: number;
}

interface DemoSpec {
  name: string;
  business: string;
  market: string;
  city: string;
  phone: string;
  providers: Provider[];
  weeks: number;
  openDays: number[];
  sundayChance: number;
  dailyTarget: number;
  growthPerWeek: number;
  noise: number;
  items: ItemSpec[];
  expenses: ExpenseSpec[];
  header: (d: IsoDate) => string;
  amountStyle: (n: number) => string;
  ink: "blue" | "black";
  language: string;
  totalLabel: string | null;
  momo: MomoSpec | null;
  consent: boolean;
  missedDays: number;
  pendingDays: number;
  correctionRate: number;
  blockedDuplicates: number;
  mismatchPages: number;
  seed: number;
}

const FR_DAYS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const FR_SHORT = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const EN_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dd = (d: IsoDate) => d.slice(8, 10);
const mm = (d: IsoDate) => d.slice(5, 7);
const yyyy = (d: IsoDate) => d.slice(0, 4);
const yy = (d: IsoDate) => d.slice(2, 4);

const CUSTOMERS = [
  "MARIE N.", "PAUL T.", "JEAN-CLAUDE M.", "CHANTAL E.", "BLAISE K.", "SANDRINE F.",
  "ROGER A.", "FLORE B.", "ERIC D.", "NADEGE O.", "HERVE P.", "CLARISSE Y.", "BORIS L.",
];
const FAMILY = ["EMILIENNE M.", "GASTON N.", "PRISCA W."];

export const DEMO_SPECS: DemoSpec[] = [
  {
    name: "Estelle Mbarga",
    business: "Bayam-sellam, fresh produce",
    market: "Marché Mokolo",
    city: "Yaoundé",
    phone: "677123456",
    providers: ["mtn", "orange"],
    weeks: 10,
    openDays: [1, 2, 3, 4, 5, 6],
    sundayChance: 0,
    dailyTarget: 15500,
    growthPerWeek: 0.03,
    noise: 0.16,
    items: [
      { name: "Tomates", unit: "tas", prices: [500, 1000], qty: [1, 4], weight: 5 },
      { name: "Piment", unit: "tas", prices: [200, 300], qty: [1, 3], weight: 3 },
      { name: "Plantain", unit: "régime", prices: [3500, 4000, 5000], qty: [1, 1], weight: 3 },
      { name: "Oignons", unit: "tas", prices: [500], qty: [1, 3], weight: 3 },
      { name: "Ndolé", unit: "bottes", prices: [250], qty: [2, 6], weight: 2 },
      { name: "Macabo", unit: "tas", prices: [1000], qty: [1, 2], weight: 2 },
      { name: "Pommes de terre", unit: "seau", prices: [3000], qty: [1, 1], weight: 2 },
      { name: "Gombo", unit: "tas", prices: [200], qty: [1, 3], weight: 2 },
    ],
    expenses: [
      { text: "Achat cageot tomates", amounts: [15000, 16000, 18000], chance: 0.34, viaMomo: true },
      { text: "Achat régime plantain", amounts: [12000, 13500], chance: 0.14 },
      { text: "Transport", amounts: [1000, 1500], chance: 0.4 },
      { text: "Ticket marché", amounts: [100], chance: 0.85 },
    ],
    header: (d) => `${FR_DAYS[weekday(d)]} ${dd(d)}/${mm(d)}/${yyyy(d)}`,
    amountStyle: (n) => groupThousands(n),
    ink: "blue",
    language: "fr",
    totalLabel: "Total ventes",
    momo: { lang: "fr", providers: ["mtn", "orange"], customerShare: 0.5, familyTransfers: 3, oversizedPayments: 0, duplicateMessages: 1 },
    consent: true,
    missedDays: 2,
    pendingDays: 0,
    correctionRate: 0.03,
    blockedDuplicates: 1,
    mismatchPages: 1,
    seed: 20260720,
  },
  {
    name: "Joseph Tchinda",
    business: "Phone accessories kiosk",
    market: "Marché Central",
    city: "Douala",
    phone: "670998877",
    providers: ["mtn"],
    weeks: 6,
    openDays: [1, 2, 3, 4, 5, 6],
    sundayChance: 0,
    dailyTarget: 29000,
    growthPerWeek: 0,
    noise: 0.22,
    items: [
      { name: "Chargeur", unit: "", prices: [2500, 3000], qty: [1, 2], weight: 3 },
      { name: "Écouteurs", unit: "", prices: [3000, 3500], qty: [1, 2], weight: 3 },
      { name: "Protège-écran", unit: "", prices: [1500], qty: [1, 3], weight: 4 },
      { name: "Coque", unit: "", prices: [2000], qty: [1, 2], weight: 3 },
      { name: "Câble USB", unit: "", prices: [1500], qty: [1, 2], weight: 3 },
      { name: "Carte mémoire 32G", unit: "", prices: [5000], qty: [1, 1], weight: 1 },
      { name: "Batterie externe", unit: "", prices: [10000], qty: [1, 1], weight: 1 },
    ],
    expenses: [
      { text: "Achat stock Akwa", amounts: [45000, 60000, 75000], chance: 0.12, viaMomo: true },
      { text: "Transport", amounts: [1000], chance: 0.2 },
      { text: "Crédit téléphone", amounts: [1000], chance: 0.1 },
    ],
    header: (d) => `${FR_SHORT[weekday(d)]} ${dd(d)}-${mm(d)}`,
    amountStyle: (n) => `${n}f`,
    ink: "black",
    language: "fr",
    totalLabel: null,
    momo: { lang: "fr", providers: ["mtn"], customerShare: 0.45, familyTransfers: 3, oversizedPayments: 4, duplicateMessages: 0 },
    consent: true,
    missedDays: 3,
    pendingDays: 0,
    correctionRate: 0.02,
    blockedDuplicates: 0,
    mismatchPages: 0,
    seed: 20260801,
  },
  {
    name: "Brenda Ngwa",
    business: "Provisions store",
    market: "Main Market",
    city: "Bamenda",
    phone: "699554433",
    providers: ["orange", "mtn"],
    weeks: 12,
    openDays: [1, 2, 3, 4, 5, 6],
    sundayChance: 0.5,
    dailyTarget: 12000,
    growthPerWeek: 0.012,
    noise: 0.12,
    items: [
      { name: "Rice", unit: "kg", prices: [700], qty: [1, 5], weight: 4 },
      { name: "Sugar", unit: "pack", prices: [900], qty: [1, 2], weight: 3 },
      { name: "Groundnut oil", unit: "litre", prices: [1400], qty: [1, 2], weight: 3 },
      { name: "Maggi", unit: "packet", prices: [500], qty: [1, 2], weight: 3 },
      { name: "Soap", unit: "bar", prices: [350], qty: [1, 3], weight: 2 },
      { name: "Tomato paste", unit: "tin", prices: [250], qty: [1, 4], weight: 2 },
      { name: "Spaghetti", unit: "packet", prices: [400], qty: [1, 3], weight: 2 },
      { name: "Milk", unit: "tin", prices: [600], qty: [1, 2], weight: 2 },
    ],
    expenses: [
      { text: "Stock from wholesaler", amounts: [25000, 30000], chance: 0.15, viaMomo: true },
      { text: "Council ticket", amounts: [200], chance: 0.5 },
      { text: "Transport", amounts: [500], chance: 0.2 },
    ],
    header: (d) => `${EN_SHORT[weekday(d)]} ${dd(d)}/${mm(d)}/${yy(d)}`,
    amountStyle: (n) => `${groupThousands(n).replace(/ /g, ",")}frs`,
    ink: "blue",
    language: "en",
    totalLabel: "Total sales",
    momo: { lang: "en", providers: ["orange", "mtn"], customerShare: 0.6, familyTransfers: 1, oversizedPayments: 0, duplicateMessages: 1 },
    consent: true,
    missedDays: 1,
    pendingDays: 0,
    correctionRate: 0.025,
    blockedDuplicates: 0,
    mismatchPages: 0,
    seed: 20260610,
  },
  {
    name: "Aïcha Bello",
    business: "Beignets and bouillie stand",
    market: "Grand Marché",
    city: "Garoua",
    phone: "655443322",
    providers: ["orange"],
    weeks: 3,
    openDays: [1, 2, 3, 4, 5, 6, 7],
    sundayChance: 1,
    dailyTarget: 8200,
    growthPerWeek: 0,
    noise: 0.15,
    items: [
      { name: "Beignets", unit: "", prices: [25], qty: [20, 80], weight: 4 },
      { name: "Bouillie", unit: "bols", prices: [100], qty: [5, 20], weight: 3 },
      { name: "Haricots", unit: "assiettes", prices: [200], qty: [3, 10], weight: 3 },
    ],
    expenses: [
      { text: "Farine", amounts: [6500], chance: 0.3 },
      { text: "Huile", amounts: [3000], chance: 0.25 },
      { text: "Sucre", amounts: [900], chance: 0.3 },
      { text: "Charbon", amounts: [1500], chance: 0.3 },
    ],
    header: (d) => `${dd(d)}/${mm(d)}`,
    amountStyle: (n) => String(n),
    ink: "black",
    language: "fr",
    totalLabel: "Total",
    momo: null,
    consent: false,
    missedDays: 1,
    pendingDays: 4,
    correctionRate: 0.02,
    blockedDuplicates: 0,
    mismatchPages: 0,
    seed: 20260905,
  },
];

/* ------------------------------------------------------------------ */

function int(rand: Rand, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function pick<T>(rand: Rand, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

function weighted(rand: Rand, items: ItemSpec[]): ItemSpec {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

function digits(rand: Rand, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String(int(rand, 0, 9));
  return s;
}

function stamp(date: IsoDate, hour: number, minute: number, second = 0): string {
  // Local Cameroon time (UTC+1) stored as UTC.
  const h = hour - 1;
  const day = h < 0 ? addDays(date, -1) : date;
  const hh = String((h + 24) % 24).padStart(2, "0");
  return `${day}T${hh}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.000Z`;
}

/** The last Saturday on or before the given date: demo data ends there. */
export function demoAnchor(today: IsoDate): IsoDate {
  const wd = weekday(today);
  return addDays(today, wd === 6 ? 0 : wd === 7 ? -1 : -(wd + 1));
}

interface PlannedLine {
  text: string;
  amount: number;
  type: "sale" | "expense";
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  viaMomo?: boolean;
}

function planDay(spec: DemoSpec, rand: Rand, target: number): PlannedLine[] {
  const expenses: PlannedLine[] = [];
  for (const e of spec.expenses) {
    if (rand() < e.chance) expenses.push({ text: e.text, amount: pick(rand, e.amounts), type: "expense", viaMomo: e.viaMomo });
  }
  const maxSales = Math.max(4, MAX_DEMO_LINES - expenses.length);
  const drafts: { item: ItemSpec; quantity: number; unitPrice: number }[] = [];
  let total = 0;
  while (total < target && drafts.length < maxSales) {
    const item = weighted(rand, spec.items);
    const quantity = int(rand, item.qty[0], item.qty[1]);
    const unitPrice = pick(rand, item.prices);
    drafts.push({ item, quantity, unitPrice });
    total += quantity * unitPrice;
  }
  // A busier day on a full page means bigger sales per line, not more lines.
  for (let tries = 0; total < target * 0.95 && tries < 40; tries++) {
    const d = pick(rand, drafts);
    if (d.quantity < d.item.qty[1] * 2 + 1) {
      d.quantity += 1;
      total += d.unitPrice;
    }
  }
  const sales: PlannedLine[] = drafts.map(({ item, quantity, unitPrice }) => ({
    text: item.unit ? `${item.name} ${quantity} ${item.unit}` : quantity > 1 ? `${item.name} x${quantity}` : item.name,
    amount: quantity * unitPrice,
    type: "sale",
    quantity,
    unit: item.unit || undefined,
    unitPrice,
  }));
  return [...sales, ...expenses].slice(0, MAX_DEMO_LINES);
}

function misread(amount: number): number {
  const s = String(amount);
  if (s.includes("1")) return Number(s.replace("1", "7"));
  if (s.includes("5")) return Number(s.replace("5", "6"));
  return amount * 10;
}

interface MessageDraft {
  text: string;
  date: IsoDate;
}

function momoMessage(
  rand: Rand,
  lang: "fr" | "en",
  provider: Provider,
  direction: "in" | "out",
  amount: number,
  date: IsoDate,
  name: string,
  balance: number,
): string {
  const time = `${String(int(rand, 7, 19)).padStart(2, "0")}:${String(int(rand, 0, 59)).padStart(2, "0")}`;
  const phone = `2376${digits(rand, 8)}`;
  const dmy = `${dd(date)}/${mm(date)}/${yyyy(date)}`;
  const fee = direction === "out" ? Math.max(50, Math.round((amount * 0.01) / 25) * 25) : 0;
  if (provider === "mtn") {
    const ref = digits(rand, 10);
    if (lang === "fr") {
      return direction === "in"
        ? `Vous avez reçu ${groupThousands(amount)} FCFA de ${name} (${phone}) le ${dmy} à ${time}. Nouveau solde: ${groupThousands(balance)} FCFA. ID transaction: ${ref}. MTN MoMo`
        : `Vous avez envoyé ${groupThousands(amount)} FCFA à ${name} (${phone}) le ${dmy} à ${time}. Frais: ${fee} FCFA. Nouveau solde: ${groupThousands(balance)} FCFA. ID transaction: ${ref}. MTN MoMo`;
    }
    const en = (n: number) => groupThousands(n).replace(/ /g, ",");
    return direction === "in"
      ? `You have received ${en(amount)} FCFA from ${name} (${phone}) on ${dmy} at ${time}. New balance: ${en(balance)} FCFA. Transaction Id: ${ref}. MTN MoMo`
      : `You have sent ${en(amount)} FCFA to ${name} (${phone}) on ${dmy} at ${time}. Fee: ${fee} FCFA. New balance: ${en(balance)} FCFA. Transaction Id: ${ref}. MTN MoMo`;
  }
  const ref = `CI${yy(date)}${mm(date)}${dd(date)}.${time.replace(":", "")}.${String.fromCharCode(65 + int(rand, 0, 25))}${digits(rand, 5)}`;
  if (lang === "fr") {
    return direction === "in"
      ? `Transfert de ${amount} FCFA reçu de ${phone} ${name} le ${dmy} ${time}. Solde: ${balance} FCFA. Ref: ${ref}. Orange Money`
      : `Transfert de ${amount} FCFA vers ${phone} ${name} effectué le ${dmy} ${time}. Frais: ${fee} FCFA. Solde: ${balance} FCFA. Ref: ${ref}. Orange Money`;
  }
  return direction === "in"
    ? `Orange Money: you have received ${amount} FCFA from ${name} ${phone} on ${dmy} ${time}. Balance: ${balance} FCFA. Ref: ${ref}`
    : `Orange Money: you have sent ${amount} FCFA to ${name} ${phone} on ${dmy} ${time}. Fee: ${fee} FCFA. Balance: ${balance} FCFA. Ref: ${ref}`;
}

function uid(rand: Rand, prefix: string): string {
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
  let s = "";
  for (let i = 0; i < 12; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return `${prefix}_${s}`;
}

function shareCode(rand: Rand): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const chunk = () => Array.from({ length: 4 }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
  return `TR-${chunk()}-${chunk()}`;
}

function buildTrader(spec: DemoSpec, anchor: IsoDate, today: IsoDate): Omit<Database, "version"> {
  const rand = mulberry32(spec.seed);
  const traderId = uid(rand, "tr");
  const sources: Source[] = [];
  const entries: Entry[] = [];
  const events: TrustEvent[] = [];
  const messages: MessageDraft[] = [];

  const event = (type: EventType, at: string, extra: Partial<TrustEvent> = {}) =>
    events.push({ id: uid(rand, "ev"), traderId, at, type, ...extra });

  const end = spec.pendingDays ? today : anchor;
  const start = addDays(anchor, -(spec.weeks * 7) + 2);
  const days: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const wd = weekday(d);
    const open = spec.openDays.includes(wd) || (wd === 7 && rand() < spec.sundayChance);
    if (open) days.push(d);
  }
  // Missed market days fall in the first half, so they never distort the recent trend.
  for (let i = 0; i < spec.missedDays && days.length > 10; i++) {
    days.splice(int(rand, 3, Math.floor(days.length / 2)), 1);
  }
  const pendingFrom = spec.pendingDays ? days[Math.max(0, days.length - spec.pendingDays)] : "9999-12-31";
  const mismatchDays = new Set<IsoDate>();
  while (mismatchDays.size < spec.mismatchPages) mismatchDays.add(pick(rand, days.slice(5, -5)));

  const createdAt = stamp(addDays(start, -1), 18, 12);
  const trader: Trader = {
    id: traderId,
    createdAt,
    updatedAt: createdAt,
    name: spec.name,
    business: spec.business,
    market: spec.market,
    city: spec.city,
    phone: spec.phone,
    providers: spec.providers,
    consent: { granted: false },
    demo: true,
  };
  event("trader_created", createdAt);

  let balance = int(rand, 18000, 42000);
  const closedDays = new Set<IsoDate>();
  for (let d = start; d <= end; d = addDays(d, 1)) if (!days.includes(d)) closedDays.add(d);

  days.forEach((date, dayIndex) => {
    const weekIndex = Math.floor(dayIndex / Math.max(1, spec.openDays.length));
    const growth = 1 + spec.growthPerWeek * weekIndex;
    const target = spec.dailyTarget * growth * (1 + (rand() - 0.5) * 2 * spec.noise);
    const planned = planDay(spec, rand, target);
    const salesTotal = planned.filter((l) => l.type === "sale").reduce((s, l) => s + l.amount, 0);
    const pending = date >= pendingFrom;

    const writtenTotal = spec.totalLabel ? salesTotal + (mismatchDays.has(date) ? 1000 : 0) : 0;
    const demo: DemoPage = {
      header: spec.header(date),
      lines: planned.map<DemoLine>((l) => ({ text: l.text, amount: spec.amountStyle(l.amount) })),
      total: spec.totalLabel ? { text: spec.totalLabel, amount: spec.amountStyle(writtenTotal) } : undefined,
      ink: spec.ink,
      tilt: (rand() - 0.5) * 1.6,
      seed: int(rand, 1, 2_000_000_000),
    };
    const layout = layoutDemoPage(demo);
    const sourceId = uid(rand, "src");
    const photoAt = stamp(date, int(rand, 18, 21), int(rand, 0, 59));
    const readAt = new Date(new Date(photoAt).getTime() + int(rand, 6, 14) * 1000).toISOString();
    const confirmedAt = pending ? undefined : new Date(new Date(readAt).getTime() + int(rand, 2, 40) * 60_000).toISOString();

    sources.push({
      id: sourceId,
      traderId,
      kind: "notebook",
      createdAt: photoAt,
      status: "read",
      demo,
      reading: {
        model: "gemini-3.8-flash",
        at: readAt,
        ms: int(rand, 3800, 9200),
        attempts: 1,
        document: "sales_notebook",
        legible: true,
        language: spec.language,
        pageDate: date,
        writtenTotals: spec.totalLabel
          ? [{ label: spec.totalLabel, amount: writtenTotal, type: "sale", date, box: layout.total?.box }]
          : [],
      },
      confirmedAt,
    });
    event("photo_added", photoAt, { sourceId });
    event("page_read", readAt, { sourceId, detail: { lines: planned.length } });

    planned.forEach((line, seq) => {
      const entry: Entry = {
        id: uid(rand, "en"),
        traderId,
        sourceId,
        seq,
        origin: "ai",
        status: pending ? "pending" : "confirmed",
        date,
        description: line.text,
        amount: line.amount,
        type: line.type,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        raw: `${line.text} ${spec.amountStyle(line.amount)}`,
        box: layout.lines[seq]?.box,
        confidence: Math.round((0.86 + rand() * 0.13) * 100) / 100,
        flags: [],
        confirmedAt,
      };
      if (!pending && rand() < spec.correctionRate) {
        entry.original = { date, description: line.text, amount: misread(line.amount), type: line.type };
        entry.confidence = Math.round((0.52 + rand() * 0.2) * 100) / 100;
        entry.flags = ["low_confidence"];
        event("entry_corrected", confirmedAt ?? readAt, {
          sourceId,
          entryId: entry.id,
          detail: { from: entry.original.amount, to: line.amount },
        });
      }
      entries.push(entry);
    });
    if (confirmedAt) event("page_confirmed", confirmedAt, { sourceId });

    /* mobile money for this day */
    const m = spec.momo;
    if (!m) return;
    const saleLines = planned.filter((l) => l.type === "sale" && l.amount >= 1000);
    if (saleLines.length && rand() < m.customerShare) {
      const count = rand() < 0.35 && saleLines.length > 2 ? 2 : 1;
      const chosen = new Set<number>();
      while (chosen.size < count) chosen.add(int(rand, 0, saleLines.length - 1));
      for (const i of chosen) {
        balance += saleLines[i].amount;
        messages.push({
          text: momoMessage(rand, m.lang, pick(rand, m.providers), "in", saleLines[i].amount, date, pick(rand, CUSTOMERS), balance),
          date,
        });
      }
    }
    for (const exp of planned.filter((l) => l.type === "expense" && l.viaMomo)) {
      balance = Math.max(0, balance - exp.amount);
      messages.push({
        text: momoMessage(rand, m.lang, pick(rand, m.providers), "out", exp.amount, date, "GROSSISTE", balance),
        date,
      });
    }
  });

  /* transfers that are not sales, and payments larger than a day's records */
  const m = spec.momo;
  if (m) {
    const closed = [...closedDays].filter((d) => d < anchor);
    for (let i = 0; i < m.familyTransfers && closed.length; i++) {
      const date = closed.splice(int(rand, 0, closed.length - 1), 1)[0];
      const amount = pick(rand, [10000, 15000, 20000, 25000]);
      balance += amount;
      messages.push({ text: momoMessage(rand, m.lang, pick(rand, m.providers), "in", amount, date, pick(rand, FAMILY), balance), date });
    }
    for (let i = 0; i < m.oversizedPayments; i++) {
      const date = pick(rand, days.slice(0, -2));
      const amount = pick(rand, [60000, 80000, 100000]);
      balance += amount;
      messages.push({ text: momoMessage(rand, m.lang, "mtn", "in", amount, date, pick(rand, CUSTOMERS), balance), date });
    }
    messages.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < m.duplicateMessages && messages.length > 6; i++) {
      const copy = messages[int(rand, 2, messages.length - 3)];
      messages.push({ ...copy });
    }
  }

  /* group messages into weekly pastes, parse them with the real parser */
  const momo: MomoTx[] = [];
  const byWeek = new Map<string, MessageDraft[]>();
  for (const msg of messages) {
    const key = addDays(msg.date, 7 - weekday(msg.date) - 1);
    const list = byWeek.get(key);
    if (list) list.push(msg);
    else byWeek.set(key, [msg]);
  }
  for (const [saturday, list] of [...byWeek.entries()].sort()) {
    const sourceId = uid(rand, "src");
    const at = stamp(saturday > end ? end : saturday, 21, int(rand, 0, 59));
    sources.push({
      id: sourceId,
      traderId,
      kind: "momo_sms",
      createdAt: at,
      status: "read",
      text: list.map((l) => l.text).join("\n\n"),
    });
    let found = 0;
    for (const msg of list) {
      const parsed = parseSms(msg.text, today);
      if (!parsed.ok) throw new Error(`Demo message failed to parse (${parsed.reason}): ${msg.text}`);
      momo.push({ ...parsed.tx, id: uid(rand, "mm"), traderId, sourceId, method: "rules" });
      found++;
    }
    event("messages_added", at, { sourceId, detail: { found } });
  }
  const deduped = markMomoDuplicates([], momo);

  for (let i = 0; i < spec.blockedDuplicates; i++) {
    const original = pick(rand, sources.filter((s) => s.kind === "notebook"));
    event("photo_duplicate_blocked", new Date(new Date(original.createdAt).getTime() + 90_000).toISOString(), {
      detail: { of: original.id, crossTrader: false, match: "exact" },
    });
  }

  /* a few lines in the review queue need the trader's eyes */
  if (spec.pendingDays) {
    const queue = entries.filter((e) => e.status === "pending");
    const sales = queue.filter((e) => e.type === "sale");
    const unsure = sales.filter((_, i) => i % 5 === 1).slice(0, 3);
    for (const e of unsure) {
      e.confidence = Math.round((0.55 + rand() * 0.18) * 100) / 100;
      e.flags = ["low_confidence"];
    }
    const withMath = sales.find((e) => e.quantity && e.unitPrice && !unsure.includes(e));
    if (withMath) {
      withMath.amount = withMath.amount * 10;
      withMath.confidence = 0.6;
      withMath.flags = ["math_mismatch", "low_confidence"];
    }
    const computed = sales.find((e) => e.quantity && e.unitPrice && e !== withMath && !unsure.includes(e));
    if (computed) {
      computed.confidence = 0.85;
      computed.flags = ["amount_computed"];
      computed.raw = computed.raw.replace(/\s\S+$/, "");
    }
  }

  if (spec.consent) {
    const at = stamp(anchor, 21, 40);
    trader.consent = { granted: true, grantedAt: at, code: shareCode(rand) };
    event("consent_granted", at);
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  return { traders: [trader], sources, entries, momo: deduped, events };
}

export function buildDemoDatabase(today: IsoDate): Database {
  const anchor = demoAnchor(today);
  const db: Database = { version: 1, traders: [], sources: [], entries: [], momo: [], events: [] };
  for (const spec of DEMO_SPECS) {
    const part = buildTrader(spec, anchor, today);
    db.traders.push(...part.traders);
    db.sources.push(...part.sources);
    db.entries.push(...part.entries);
    db.momo.push(...part.momo);
    db.events.push(...part.events);
  }
  return db;
}
