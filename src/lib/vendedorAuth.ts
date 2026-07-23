import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const VENDEDOR_COOKIE_NAME = "encomenda_vendedor_session";
export const VENDEDOR_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const SECRET_ENV_VAR = "VENDEDOR_SESSION_SECRET";

export { hashPin, verifyPin };

// Assunto da sessão é o NOME do vendedor (não a loja) — mesmo padrão de
// lojaAuth.ts. A loja é sempre resolvida fresca do banco via
// getVendedorStoreId (src/lib/vendedores.ts), nunca confiada no cookie.
export function signVendedorSession(name: string): string {
  return signPinSession(name, SECRET_ENV_VAR);
}

export function verifyVendedorSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, VENDEDOR_SESSION_MAX_AGE * 1000);
}
