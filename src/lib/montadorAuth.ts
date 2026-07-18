import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const MONTADOR_COOKIE_NAME = "montador_session";
export const MONTADOR_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — sessão de longa duração no celular do montador

const SECRET_ENV_VAR = "MONTADOR_SESSION_SECRET";

export { hashPin, verifyPin };

export function signMontadorSession(assemblerName: string): string {
  return signPinSession(assemblerName, SECRET_ENV_VAR);
}

export function verifyMontadorSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, MONTADOR_SESSION_MAX_AGE * 1000);
}
