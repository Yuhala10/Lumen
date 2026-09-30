import { ZodError } from "zod";
import { TrustError } from "@/core/errors";

/** Consistent JSON responses for every route: { data } or { error: { code, message } }. */

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data }, { status, headers: { "cache-control": "no-store" } });
}

export function fail(err: unknown): Response {
  if (err instanceof TrustError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status, headers: { "cache-control": "no-store" } },
    );
  }
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return Response.json(
      { error: { code: "invalid_input", message: issues.map((i) => `${i.path}: ${i.message}`).join("; "), details: { issues } } },
      { status: 400 },
    );
  }
  console.error("[trust] unexpected error", err);
  return Response.json({ error: { code: "internal", message: "Something went wrong on our side." } }, { status: 500 });
}

export async function handle(fn: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    return ok(await fn(), status);
  } catch (err) {
    return fail(err);
  }
}

export async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new TrustError("invalid_input", "The request body must be JSON.", 400);
  }
}
