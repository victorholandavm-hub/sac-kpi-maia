import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const LOJA_GERENTE_COOKIE_NAME = "loja_gerente_session";
export const LOJA_GERENTE_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const SECRET_ENV_VAR = "LOJA_SESSION_SECRET";

export { hashPin, verifyPin };

export function signLojaGerenteSession(storeId: string): string {
  return signPinSession(storeId, SECRET_ENV_VAR);
}

export function verifyLojaGerenteSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, LOJA_GERENTE_SESSION_MAX_AGE * 1000);
}
