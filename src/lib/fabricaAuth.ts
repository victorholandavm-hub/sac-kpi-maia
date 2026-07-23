import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const FABRICA_COOKIE_NAME = "fabrica_session";
export const FABRICA_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const SECRET_ENV_VAR = "FABRICA_SESSION_SECRET";

export { hashPin, verifyPin };

export function signFabricaSession(operadorName: string): string {
  return signPinSession(operadorName, SECRET_ENV_VAR);
}

export function verifyFabricaSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, FABRICA_SESSION_MAX_AGE * 1000);
}
