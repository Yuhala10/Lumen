import { TrustError } from "@/core/errors";

/**
 * Gemini over plain HTTPS (no SDK, nothing extra to download).
 *
 * Built for the free tier: one request at a time with a minimum gap, retries
 * that honour the server's retry hint, and an automatic switch to the
 * fallback model when the main one is unavailable or out of quota.
 * The key is read on the server only and never reaches the browser.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Hosted functions have a hard time limit (60 s on Vercel's free plan), so
// retries must fit inside it. Locally there is room to be more patient.
const HOSTED = Boolean(process.env.VERCEL);
const REQUEST_TIMEOUT_MS = HOSTED ? 40_000 : 90_000;
const MAX_RETRY_WAIT_MS = HOSTED ? 6_000 : 30_000;
const TOTAL_BUDGET_MS = HOSTED ? 52_000 : 170_000;

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export interface GenerateOptions {
  system: string;
  parts: GeminiPart[];
  schema: object;
  /** Models to try, in order. Defaults to the fast model, then the careful one. */
  models?: string[];
}

export interface GenerateResult {
  data: unknown;
  model: string;
  ms: number;
  attempts: number;
}

export function aiConfig() {
  const key = process.env.GEMINI_API_KEY?.trim() ?? "";
  return {
    key,
    configured: key.length > 10,
    // Fast model reads first; the careful model is the backup and the second opinion.
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
    fallback: process.env.GEMINI_FALLBACK_MODEL?.trim() || "gemini-3.8-flash",
    minGapMs: Number(process.env.GEMINI_MIN_GAP_MS ?? 1200) || 0,
    hosted: HOSTED,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Pace {
  chain: Promise<unknown>;
  last: number;
}
const g = globalThis as typeof globalThis & { __trustAiPace?: Pace };
const pace: Pace = (g.__trustAiPace ??= { chain: Promise.resolve(), last: 0 });

function paced<T>(fn: () => Promise<T>, minGapMs: number): Promise<T> {
  const run = pace.chain.then(async () => {
    const wait = pace.last + minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      pace.last = Date.now();
    }
  });
  pace.chain = run.catch(() => undefined);
  return run;
}

type Outcome =
  | { ok: true; data: unknown }
  | { ok: false; kind: "retry"; error: TrustError; waitMs?: number }
  | { ok: false; kind: "schema"; error: TrustError }
  | { ok: false; kind: "next_model"; error: TrustError }
  | { ok: false; kind: "bad_output"; error: TrustError }
  | { ok: false; kind: "fatal"; error: TrustError };

interface ApiError {
  error?: { code?: number; message?: string; status?: string; details?: { "@type"?: string; retryDelay?: string }[] };
}

function retryDelayMs(body: ApiError): number | undefined {
  const info = body.error?.details?.find((d) => d["@type"]?.includes("RetryInfo"));
  const m = info?.retryDelay?.match(/^([\d.]+)s$/);
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined;
}

function stripFences(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

async function callOnce(model: string, opts: GenerateOptions, useSchema: boolean, key: string): Promise<Outcome> {
  const system = useSchema
    ? opts.system
    : `${opts.system}\n\nRespond with JSON only, matching this JSON Schema exactly:\n${JSON.stringify(opts.schema)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: useSchema
      ? { responseMimeType: "application/json", responseJsonSchema: opts.schema }
      : { responseMimeType: "application/json" },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return {
      ok: false,
      kind: "retry",
      error: new TrustError("ai_unavailable", aborted ? "The AI took too long to answer." : "Could not reach the AI service.", 503),
    };
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* handled below */
  }

  if (!res.ok) {
    const err = (json ?? {}) as ApiError;
    const message = err.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400) {
      if (/api key/i.test(message)) return { ok: false, kind: "fatal", error: new TrustError("ai_bad_key", message, 401) };
      if (/schema|responseJsonSchema|response_json_schema|unknown name/i.test(message)) {
        return { ok: false, kind: "schema", error: new TrustError("ai_bad_output", message, 502) };
      }
      if (/image|inline_data|mime/i.test(message)) return { ok: false, kind: "fatal", error: new TrustError("image_invalid", message, 422) };
      return { ok: false, kind: "next_model", error: new TrustError("ai_unavailable", message, 502) };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, kind: "fatal", error: new TrustError("ai_bad_key", message, 401) };
    }
    if (res.status === 404) return { ok: false, kind: "next_model", error: new TrustError("ai_unavailable", message, 502) };
    if (res.status === 429) {
      const waitMs = retryDelayMs(err);
      const error = new TrustError("ai_rate_limited", message, 429);
      if (/per ?day|daily/i.test(message) || (waitMs !== undefined && waitMs > MAX_RETRY_WAIT_MS)) {
        return { ok: false, kind: "next_model", error };
      }
      return { ok: false, kind: "retry", error, waitMs };
    }
    return { ok: false, kind: "retry", error: new TrustError("ai_unavailable", message, 503) };
  }

  const data = json as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  } | null;
  if (data?.promptFeedback?.blockReason) {
    return { ok: false, kind: "fatal", error: new TrustError("ai_blocked", `Blocked: ${data.promptFeedback.blockReason}`, 422) };
  }
  const candidate = data?.candidates?.[0];
  const finish = candidate?.finishReason ?? "";
  if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(finish)) {
    return { ok: false, kind: "fatal", error: new TrustError("ai_blocked", `Stopped: ${finish}`, 422) };
  }
  const out = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  try {
    return { ok: true, data: JSON.parse(stripFences(out)) };
  } catch {
    return {
      ok: false,
      kind: "bad_output",
      error: new TrustError("ai_bad_output", finish === "MAX_TOKENS" ? "The answer was cut off." : "The AI answer was not valid JSON.", 502),
    };
  }
}

export async function generateJson(opts: GenerateOptions): Promise<GenerateResult> {
  const cfg = aiConfig();
  if (!cfg.configured) {
    throw new TrustError("no_ai_key", "AI reading is off: GEMINI_API_KEY is not set in .env.local.", 503);
  }
  const models = (opts.models ?? [cfg.model, cfg.fallback]).filter((m, i, all) => m && all.indexOf(m) === i);
  const started = Date.now();
  let attempts = 0;
  let lastError: TrustError | null = null;

  for (const model of models) {
    let useSchema = true;
    let tries = 0;
    while (tries < 3) {
      if (Date.now() - started > TOTAL_BUDGET_MS) break;
      attempts++;
      tries++;
      const outcome = await paced(() => callOnce(model, opts, useSchema, cfg.key), cfg.minGapMs);
      if (outcome.ok) return { data: outcome.data, model, ms: Date.now() - started, attempts };
      lastError = outcome.error;
      if (outcome.kind === "fatal") throw outcome.error;
      if (outcome.kind === "next_model") break;
      if (outcome.kind === "schema" && useSchema) {
        useSchema = false; // fall back to schema-in-prompt; our own validation still applies
        tries--;
        continue;
      }
      if (outcome.kind === "retry") {
        const backoff = 1500 * 2 ** (tries - 1) + Math.floor(Math.random() * 400);
        await sleep(Math.min(MAX_RETRY_WAIT_MS, outcome.waitMs ?? backoff));
      }
    }
  }
  throw lastError ?? new TrustError("ai_unavailable", "The AI service is unavailable.", 503);
}
