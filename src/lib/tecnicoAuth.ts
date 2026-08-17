import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const TECNICO_COOKIE_NAME = "tecnico_session";
export const TECNICO_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — mesma duração de montador/motorista

const SECRET_ENV_VAR = "TECNICO_SESSION_SECRET";

export { hashPin, verifyPin };

export function signTecnicoSession(tecnicoName: string): string {
  return signPinSession(tecnicoName, SECRET_ENV_VAR);
}

export function verifyTecnicoSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, TECNICO_SESSION_MAX_AGE * 1000);
}
