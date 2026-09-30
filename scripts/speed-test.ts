// Compares Gemini reading speed and accuracy with different thinking levels on one photo.
// Usage: node --env-file=.env.local scripts/speed-test.ts <photo-path>
// The key is read from the environment and never printed.
import { readFileSync } from "node:fs";
import { PAGE_JSON_SCHEMA } from "../src/core/refine/schema.ts";
import { refinePage } from "../src/core/refine/validate.ts";

const key = process.env.GEMINI_API_KEY ?? "";
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const photo = process.argv[2];
if (!key || !photo) throw new Error("Need GEMINI_API_KEY and a photo path");
const data = readFileSync(photo).toString("base64");
const mime = data.startsWith("/9j") ? "image/jpeg" : "image/png";

async function run(label: string, thinking?: Record<string, unknown>) {
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "Read this handwritten sales notebook page from a market trader in Cameroon. One item per written line. Copy amounts as written; never do arithmetic. Dates are day-first." }] },
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data } }, { text: "Today is 2026-09-30. Read this notebook page." }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: PAGE_JSON_SCHEMA, ...(thinking ? { thinkingConfig: thinking } : {}) },
    }),
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const body = await res.json();
  if (!res.ok) {
    console.log(`${label}: HTTP ${res.status} in ${seconds}s: ${body.error?.message?.slice(0, 160)}`);
    return;
  }
  const text = body.candidates?.[0]?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text).join("") ?? "";
  const page = refinePage(JSON.parse(text), "2026-09-30");
  const total = page.entries.filter((e) => e.type === "sale").reduce((s, e) => s + e.amount, 0);
  const usage = body.usageMetadata ?? {};
  console.log(
    `${label}: ${seconds}s | lines ${page.entries.length} | sum ${total} | written total ${page.writtenTotals[0]?.amount ?? "-"} | thinking tokens ${usage.thoughtsTokenCount ?? 0} | flags ${page.entries.flatMap((e) => e.flags).length}`,
  );
}

await run("default");
await run("thinking low", { thinkingLevel: "low" });
await run("thinking minimal", { thinkingLevel: "minimal" });
