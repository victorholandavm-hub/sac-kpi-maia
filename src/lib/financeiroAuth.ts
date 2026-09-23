import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

// Financeiro: acesso restrito só à fila de solicitação de estorno (ver
// estornoRequests.ts) -- login por nome+PIN, mesmo padrão de
// tecnicoAuth.ts (sem loja fixa, um time central que vê todas as lojas).

export const FINANCEIRO_COOKIE_NAME = "financeiro_session";
export const FINANCEIRO_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias -- mesma duração de tecnico/montador/motorista

const SECRET_ENV_VAR = "FINANCEIRO_SESSION_SECRET";

export { hashPin, verifyPin };

export function signFinanceiroSession(name: string): string {
  return signPinSession(name, SECRET_ENV_VAR);
}

export function verifyFinanceiroSession(token: string | undefined | null): string | null {
  return verifyPinSession(token, SECRET_ENV_VAR, FINANCEIRO_SESSION_MAX_AGE * 1000);
}
