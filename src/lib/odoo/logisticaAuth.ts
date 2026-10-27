// Quem pode operar a logística do Odoo dentro deste sistema.
//
// - CD (roteirizador/expedição/cargas): login PIN do CD que já existe
//   (cd_operadores, cookie cd_session -- Rafael/Eduardo e equipe) OU login
//   da equipe com papel admin/assistencia (Supabase Auth).
// - Motorista: login PIN do motorista que já existe (drivers, cookie
//   driver_session). O casamento motorista daqui x hr.employee do Odoo fica
//   em ./motoristaMap.ts.
//
// Lê os cookies com os helpers puros de @/lib/*Auth (não importa nenhum
// arquivo "use server" -- ver comentário em api/motorista/upload-photo).

import { cookies } from "next/headers";
import { CD_COOKIE_NAME, verifyCdSession } from "@/lib/cdAuth";
import { DRIVER_COOKIE_NAME, verifyDriverSession } from "@/lib/driverAuth";
import { getOptionalProfile } from "@/lib/dal";
import { DISPATCH_SUPERVISOR_DRIVERS } from "@/lib/assistenciaLabels";
import { operadorLoja, type OperadorLoja } from "@/lib/operadorLoja";

export type OperadorLogistica = { nome: string; origem: "cd" | "equipe"; operadorOdoo: string; loja?: OperadorLoja | null };

export async function getOperadorLogistica(): Promise<OperadorLogistica | null> {
  const store = await cookies();
  const cd = verifyCdSession(store.get(CD_COOKIE_NAME)?.value);
  if (cd) {
    const loja = operadorLoja(cd);
    return { nome: cd, origem: "cd", operadorOdoo: loja ? `Loja ${loja.filial} ${cd}` : `CD ${cd}`, loja };
  }
  const profile = await getOptionalProfile();
  if (profile && (profile.role === "admin" || profile.role === "assistencia")) {
    return { nome: profile.fullName, origem: "equipe", operadorOdoo: `Equipe ${profile.fullName}` };
  }
  return null;
}

export async function exigirOperadorLogistica(): Promise<OperadorLogistica> {
  const op = await getOperadorLogistica();
  if (!op) throw new Error("Sessão do CD expirada. Entre de novo pelo login do CD.");
  return op;
}

export type MotoristaSessao = { nome: string; supervisor: boolean };

export async function getMotoristaSessao(): Promise<MotoristaSessao | null> {
  const store = await cookies();
  const nome = verifyDriverSession(store.get(DRIVER_COOKIE_NAME)?.value);
  if (!nome) return null;
  return { nome, supervisor: DISPATCH_SUPERVISOR_DRIVERS.includes(nome) };
}

// Empresa (res.company do Odoo) que a tela abre por padrão. A lista de
// empresas vem do Odoo (/empresas); a escolhida vai na URL (?empresa=).
export function empresaPadrao(): number {
  const n = Number(process.env.ODOO_COMPANY_ID_PADRAO);
  return Number.isInteger(n) && n > 0 ? n : 13;
}

export function empresaDaUrl(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return Number.isInteger(n) && n > 0 ? n : empresaPadrao();
}

// Empresas onde procurar a carga do motorista (o CD e, se houver, filiais
// que também despacham). Lista separada por vírgula.
export function empresasDoMotorista(): number[] {
  const lista = (process.env.ODOO_COMPANY_IDS_MOTORISTA ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return lista.length ? lista : [empresaPadrao()];
}
