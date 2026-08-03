import type { PaymentGatewayRow } from "../types";

/** Fetch com timeout + parse JSON tolerante. */
export async function apiFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<{ ok: boolean; status: number; body: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

/** HMAC-SHA256 hex — usado por MP/Pagar.me/Stripe webhooks. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : (await import('node:crypto')).webcrypto;
  const key = await cryptoObj.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await cryptoObj.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA1 hex — usado por Pagar.me v4/v5 webhooks. */
export async function hmacSha1Hex(secret: string, message: string): Promise<string> {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : (await import('node:crypto')).webcrypto;
  const key = await cryptoObj.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await cryptoObj.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparação timing-safe entre strings hex. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function requireCred(gw: PaymentGatewayRow, key: string): string {
  const v = gw.credentials?.[key];
  if (!v) throw new Error(`${gw.provider}: credencial "${key}" não configurada`);
  return v;
}

export function requireHttpsUrl(url: string, provider: string): void {
  if (!/^https:\/\//i.test(url)) {
    throw new Error(`${provider} exige URL HTTPS pública (não funciona em preview local).`);
  }
}
