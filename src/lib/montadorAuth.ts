import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

export const MONTADOR_COOKIE_NAME = "montador_session";
export const MONTADOR_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — sessão de longa duração no celular do montador

function secret(): string {
  const s = process.env.MONTADOR_SESSION_SECRET;
  if (!s) throw new Error("MONTADOR_SESSION_SECRET ausente");
  return s;
}

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

export function signMontadorSession(assemblerName: string): string {
  const payload = Buffer.from(assemblerName, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyMontadorSession(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expectedSig = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, "base64url").toString("utf8");
}
