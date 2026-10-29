"use server";

// 29/10/2026: Fretes (CT-e) do CD — ler detalhe, vincular NF-e a um CT-e sem nota e subir o XML de um CT-e que o robô
// não pegou. Mesmo padrão das actions da logística (sessão do CD por PIN ou equipe; nome do operador vai para a ponte).
import { revalidatePath } from "next/cache";
import { exigirOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { mensagemDeErro } from "@/lib/odoo/logistica";
import { lerCte, subirXmlCte, vincularNfeCte, type CteFrete, type VinculoCteResposta, type XmlCteResposta } from "@/lib/odoo/cte";
import type { ResultadoAcao } from "@/lib/odoo/logisticaTipos";

const ROTA = "/assistencia/logistica/fretes";

async function executar<T>(fn: (operador: string) => Promise<T>, revalidar = false): Promise<ResultadoAcao<T>> {
  try {
    const op = await exigirOperadorLogistica();
    const dados = await fn(op.operadorOdoo);
    if (revalidar) revalidatePath(ROTA);
    return { ok: true, dados };
  } catch (err) {
    console.error("[logistica-cte]", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function lerCteAction(chave: string): Promise<ResultadoAcao<CteFrete>> {
  return executar(() => lerCte(chave));
}
export async function vincularNfeCteAction(chave: string, nfeChaves: string[]): Promise<ResultadoAcao<VinculoCteResposta>> {
  if (!nfeChaves.length) return { ok: false, erro: "Informe a chave da NF-e (44 números)." };
  return executar((operador) => vincularNfeCte(chave, nfeChaves, operador), true);
}
export async function subirXmlCteAction(xml: string, nome: string): Promise<ResultadoAcao<XmlCteResposta>> {
  if (!xml || xml.length < 100) return { ok: false, erro: "Arquivo vazio. Escolha o XML do CT-e." };
  if (xml.length > 1_500_000) return { ok: false, erro: "Arquivo grande demais para um CT-e." };
  return executar((operador) => subirXmlCte(xml, nome, operador), true);
}
