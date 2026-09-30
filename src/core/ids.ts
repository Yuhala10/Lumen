/** Identifiers. Short, URL-safe, and validated before touching the file system. */

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomChars(length: number, alphabet: string): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export type IdPrefix = "tr" | "src" | "en" | "mm" | "ev";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomChars(12, ALPHABET)}`;
}

export function isId(value: unknown, prefix?: IdPrefix): value is string {
  if (typeof value !== "string") return false;
  const re = prefix ? new RegExp(`^${prefix}_[0-9a-z]{6,24}$`) : /^[a-z]{2,3}_[0-9a-z]{6,24}$/;
  return re.test(value);
}

/** A share code a trader can read out loud: TR-7Q4K-2M9X */
export function newShareCode(): string {
  return `TR-${randomChars(4, CODE_ALPHABET)}-${randomChars(4, CODE_ALPHABET)}`;
}

export function normalizeShareCode(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("TR") ? s.slice(2) : s;
  return body.length === 8 ? `TR-${body.slice(0, 4)}-${body.slice(4)}` : input.trim().toUpperCase();
}
