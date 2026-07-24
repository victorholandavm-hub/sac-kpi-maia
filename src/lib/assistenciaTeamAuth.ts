import { signPinSession, verifyPinSession } from "./pinAuth";

export const ASSISTENCIA_TEAM_COOKIE_NAME = "assistencia_team_pending";
// Só o tempo de escolher o nome na tela seguinte, não uma sessão de verdade —
// a sessão real é a do Supabase Auth criada depois de escolher quem é.
export const ASSISTENCIA_TEAM_PENDING_MAX_AGE = 60 * 5;

const SECRET_ENV_VAR = "ASSISTENCIA_TEAM_SECRET";

export type AssistenciaTeam = "assistencia" | "sac";

// O time (assistência ou SAC) vai codificado no próprio token assinado — cada
// um tem sua credencial compartilhada própria (ver signIn em actions.ts), e
// "quem é você" só lista gente do time que efetivamente logou, nunca os dois
// juntos.
export function signAssistenciaTeamPending(team: AssistenciaTeam): string {
  return signPinSession(team, SECRET_ENV_VAR);
}

export function verifyAssistenciaTeamPending(token: string | undefined | null): AssistenciaTeam | null {
  const sub = verifyPinSession(token, SECRET_ENV_VAR, ASSISTENCIA_TEAM_PENDING_MAX_AGE * 1000);
  return sub === "assistencia" || sub === "sac" ? sub : null;
}
