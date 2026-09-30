import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "@/core/types";
import { buildDemoDatabase } from "@/core/demo/seed";
import { todayIso } from "@/core/dates";
import { isId } from "@/core/ids";

/**
 * Organize: storage.
 *
 * One JSON document plus a folder of photos, kept in .data/. Writes are
 * serialised through a single queue and land atomically (write to a temp
 * file, then rename), so a crash can never leave a half-written database.
 * The interface is small on purpose: swapping in a hosted database later
 * means reimplementing readDb, mutate and the three upload functions.
 */

// On Vercel the project folder is read-only, so data lives in the temporary
// folder: fine for a demo, not durable. Real deployments swap in a database.
const DATA_DIR = process.env.TRUST_DATA_DIR
  ? path.resolve(process.env.TRUST_DATA_DIR)
  : process.env.VERCEL
    ? path.join(os.tmpdir(), "trust-data")
    : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "trust.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

interface StoreState {
  db: Database | null;
  mtimeMs: number;
  queue: Promise<unknown>;
}

const g = globalThis as typeof globalThis & { __trustStore?: StoreState };
const state: StoreState = (g.__trustStore ??= { db: null, mtimeMs: 0, queue: Promise.resolve() });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function migrate(raw: unknown): Database {
  const d = (raw ?? {}) as Partial<Database>;
  return {
    version: 1,
    traders: Array.isArray(d.traders) ? d.traders : [],
    sources: Array.isArray(d.sources) ? d.sources : [],
    entries: Array.isArray(d.entries) ? d.entries : [],
    momo: Array.isArray(d.momo) ? d.momo : [],
    events: Array.isArray(d.events) ? d.events : [],
  };
}

async function save(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db), "utf8");
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, DB_FILE);
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // Windows can briefly lock a file (antivirus, indexer). Retry, then give up cleanly.
      if ((code === "EPERM" || code === "EBUSY" || code === "EACCES") && attempt < 8) {
        await sleep(40 * (attempt + 1));
        continue;
      }
      await fs.rm(tmp, { force: true });
      throw err;
    }
  }
  const stat = await fs.stat(DB_FILE);
  state.db = db;
  state.mtimeMs = stat.mtimeMs;
}

async function load(): Promise<Database> {
  try {
    const stat = await fs.stat(DB_FILE);
    if (state.db && stat.mtimeMs === state.mtimeMs) return state.db;
    const db = migrate(JSON.parse(await fs.readFile(DB_FILE, "utf8")));
    state.db = db;
    state.mtimeMs = stat.mtimeMs;
    return db;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const db = buildDemoDatabase(todayIso());
    await save(db);
    return db;
  }
}

/** A read-only snapshot. Never modify it; use mutate(). */
export async function readDb(): Promise<Database> {
  await state.queue;
  return load();
}

/**
 * Applies a change atomically. The callback receives a private copy; if it
 * throws, nothing is written. Never call mutate from inside mutate.
 */
export function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = state.queue.then(async () => {
    const draft = structuredClone(await load());
    const result = await fn(draft);
    await save(draft);
    return result;
  });
  state.queue = run.catch(() => undefined);
  return run;
}

function uploadPath(sourceId: string): string {
  if (!isId(sourceId, "src")) throw new Error("Invalid source id");
  return path.join(UPLOAD_DIR, `${sourceId}.bin`);
}

export async function saveUpload(sourceId: string, bytes: Uint8Array): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(uploadPath(sourceId), bytes);
}

export async function readUpload(sourceId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(uploadPath(sourceId));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function deleteUpload(sourceId: string): Promise<void> {
  await fs.rm(uploadPath(sourceId), { force: true });
}

/** Wipes everything and rebuilds the demo businesses. */
export function resetStore(): Promise<Database> {
  const run = state.queue.then(async () => {
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
    const db = buildDemoDatabase(todayIso());
    await save(db);
    return db;
  });
  state.queue = run.catch(() => undefined);
  return run;
}
