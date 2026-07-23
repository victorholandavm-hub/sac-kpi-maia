import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const CAIXA_COOKIE_NAME = "encomenda_caixa_session";
export const CAIXA_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const SECRET_ENV_VAR = "CAIXA_SESSION_SECRET";

export { hashPin, verifyPin };

// Assunto da sessão é o store_id (PIN é por loja, não por pessoa — ver
// supabase/migrations/0028_encomenda_pin_auth.sql).
export function signCaixaSession(storeId: string): string {
  return signPinSession(storeId, SECRET_ENV_VAR);
}

export function verifyCaixaSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, CAIXA_SESSION_MAX_AGE * 1000);
}
