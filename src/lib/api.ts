"use client";

/** Browser side of the API: typed calls, one error shape, upload progress. */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

function toError(status: number, env: Envelope<unknown> | null): ApiError {
  if (env?.error) return new ApiError(env.error.code, env.error.message, status, env.error.details);
  return new ApiError(status === 0 ? "offline" : "internal", "Request failed", status);
}

export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("offline", "Network error", 0);
  }
  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    /* empty body */
  }
  if (!res.ok || !env || env.error) throw toError(res.status, env);
  return env.data as T;
}

/** fetch() cannot report upload progress; XHR can. On slow networks that matters. */
export function uploadForm<T>(url: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError("offline", "Network error", 0));
    xhr.onload = () => {
      const env = xhr.response as Envelope<T> | null;
      if (xhr.status >= 200 && xhr.status < 300 && env && !env.error) resolve(env.data as T);
      else reject(toError(xhr.status, env));
    };
    xhr.send(form);
  });
}

export function errorText(err: unknown, errors: Record<string, string>): string {
  if (err instanceof ApiError) {
    if (err.code === "duplicate_photo" && (err.details as { crossTrader?: boolean } | undefined)?.crossTrader) {
      return errors.duplicate_photo_cross;
    }
    return errors[err.code] ?? errors.generic;
  }
  return errors.generic;
}
