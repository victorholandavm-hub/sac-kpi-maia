import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(8).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function secret(envVar: string): string {
  const s = process.env[envVar];
  if (!s) throw new Error(`${envVar} ausente`);
  return s;
}

// Sessão leve por HMAC (sem Supabase Auth) pra login por PIN — usada tanto pelo
// montador quanto pelo gerente de loja, cada um com seu próprio cookie/segredo.
// Inclui um timestamp de emissão pra permitir expiração checada no servidor,
// não só via maxAge do cookie (que o navegador poderia ignorar).
export function signPinSession(subject: string, envVar: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: subject, iat: Date.now() }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret(envVar)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPinSession(token: string | undefined | null, envVar: string, maxAgeMs: number): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expectedSig = createHmac("sha256", secret(envVar)).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { sub, iat } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof sub !== "string" || typeof iat !== "number") return null;
    if (Date.now() - iat > maxAgeMs) return null;
    return sub;
  } catch {
    return null;
  }
}
