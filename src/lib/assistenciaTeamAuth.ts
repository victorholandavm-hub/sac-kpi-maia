import { signPinSession, verifyPinSession } from "./pinAuth";

export const ASSISTENCIA_TEAM_COOKIE_NAME = "assistencia_team_pending";
// Só o tempo de escolher o nome na tela seguinte, não uma sessão de verdade —
// a sessão real é a do Supabase Auth criada depois de escolher quem é.
export const ASSISTENCIA_TEAM_PENDING_MAX_AGE = 60 * 5;

const SECRET_ENV_VAR = "ASSISTENCIA_TEAM_SECRET";

export function signAssistenciaTeamPending(): string {
  return signPinSession("pending", SECRET_ENV_VAR);
}

export function verifyAssistenciaTeamPending(token: string | undefined | null): boolean {
  return verifyPinSession(token, SECRET_ENV_VAR, ASSISTENCIA_TEAM_PENDING_MAX_AGE * 1000) !== null;
}
