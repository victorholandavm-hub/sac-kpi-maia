import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const CAIXA_COOKIE_NAME = "encomenda_caixa_session";
export const CAIXA_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const SECRET_ENV_VAR = "CAIXA_SESSION_SECRET";

export { hashPin, verifyPin };

// Assunto da sessão é o NOME da caixa (não mais a loja) — caixa virou
// individual, mesmo padrão de vendedorAuth.ts. A loja é sempre resolvida
// fresca do banco via getCaixaStoreId (src/lib/caixas.ts), nunca confiada no
// cookie.
export function signCaixaSession(name: string): string {
  return signPinSession(name, SECRET_ENV_VAR);
}

export function verifyCaixaSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, CAIXA_SESSION_MAX_AGE * 1000);
}
