import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const CD_COOKIE_NAME = "cd_session";
export const CD_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const SECRET_ENV_VAR = "CD_SESSION_SECRET";

export { hashPin, verifyPin };

export function signCdSession(operadorName: string): string {
  return signPinSession(operadorName, SECRET_ENV_VAR);
}

export function verifyCdSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, CD_SESSION_MAX_AGE * 1000);
}
