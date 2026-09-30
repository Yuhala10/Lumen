/** Error codes are stable identifiers; the UI translates them for people. */
export type TrustErrorCode =
  | "not_found"
  | "invalid_input"
  | "not_shared"
  | "no_ai_key"
  | "ai_bad_key"
  | "ai_rate_limited"
  | "ai_unavailable"
  | "ai_bad_output"
  | "ai_blocked"
  | "image_invalid"
  | "image_too_large"
  | "duplicate_photo"
  | "page_has_issues"
  | "page_confirmed"
  | "nothing_to_ask"
  | "internal";

export class TrustError extends Error {
  readonly code: TrustErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: TrustErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "TrustError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
