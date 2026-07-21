import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

export const DRIVER_COOKIE_NAME = "driver_session";
export const DRIVER_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — sessão de longa duração no celular do motorista

const SECRET_ENV_VAR = "DRIVER_SESSION_SECRET";

export { hashPin, verifyPin };

export function signDriverSession(driverName: string): string {
  return signPinSession(driverName, SECRET_ENV_VAR);
}

export function verifyDriverSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, DRIVER_SESSION_MAX_AGE * 1000);
}
