"use server";

// Verbos do motorista sobre a carga do Odoo: sair para a rota (emite as NF
// 5117 da carga), dar baixa em cada parada (entregue / parcial / não
// consegui com motivo do catálogo, observação, geo e links das fotos) e
// encerrar a rota. A sessão é o login PIN do motorista deste sistema.

import { revalidatePath } from "next/cache";
import { executarAcaoCarga, mensagemDeErro, registrarChegadaParada } from "@/lib/odoo/logistica";
import { registrarBaixaParada, type EntradaBaixa } from "@/lib/odoo/baixaParada";
import { getMotoristaSessao } from "@/lib/odoo/logisticaAuth";
import { exigirCargaDoMotorista } from "@/lib/odoo/rotaMotorista";
import type { AcaoCargaResposta, ResultadoAcao, ResultadoParadaResposta } from "@/lib/odoo/logisticaTipos";

const BASE = "/assistencia/motorista/odoo";

async function sessaoOuErro() {
  const s = await getMotoristaSessao();
  if (!s) throw new Error("Sessão expirada. Faça login de novo.");
  return s;
}

export async function sairParaRotaAction(cargaId: number): Promise<ResultadoAcao<AcaoCargaResposta>> {
  try {
    const s = await sessaoOuErro();
    const { carga, employeeId } = await exigirCargaDoMotorista(s, cargaId);
    if (carga.estado !== "liberada") return { ok: false, erro: `A carga está "${carga.estado}", não "liberada".` };
    const r = await executarAcaoCarga(cargaId, "sair", { operador: `Motorista ${s.nome}`, motorista_id: employeeId, perfil: "motorista" });
    revalidatePath(BASE);
    return { ok: true, dados: r };
  } catch (err) {
    console.error("[motorista-odoo] sair", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function encerrarRotaAction(cargaId: number): Promise<ResultadoAcao<AcaoCargaResposta>> {
  try {
    const s = await sessaoOuErro();
    const { carga } = await exigirCargaDoMotorista(s, cargaId);
    if (carga.estado !== "em_rota") return { ok: false, erro: "Só dá para encerrar uma rota em andamento." };
    const faltam = carga.paradas.filter((p) => !p.resultado).length;
    if (faltam) return { ok: false, erro: `Ainda falta dar baixa em ${faltam} parada(s).` };
    const r = await executarAcaoCarga(cargaId, "finalizar", { operador: `Motorista ${s.nome}`, perfil: "motorista" });
    revalidatePath(BASE);
    return { ok: true, dados: r };
  } catch (err) {
    console.error("[motorista-odoo] finalizar", err);
    return { ok: false, erro: mensagemDeErro(err) };
  }
}

export async function registrarParadaAction(
  cargaId: number,
  paradaId: number,
  entrada: Omit<EntradaBaixa, "cargaId" | "paradaId">,
): Promise<ResultadoAcao<ResultadoParadaResposta>> {
  // Regra única em lib/odoo/baixaParada.ts (a rota da fila offline da PWA
  // usa a mesma). Aqui o erro volta só como texto, igual às outras actions.
  const r = await registrarBaixaParada(await getMotoristaSessao(), { ...entrada, cargaId, paradaId });
  if (r.ok) revalidatePath(BASE);
  return r.ok ? r : { ok: false, erro: r.erro };
}

// Chegada no cliente (26/10): GPS + hora no Odoo, 1 por parada.
export async function registrarChegadaAction(cargaId: number, paradaId: number, lat: number | null, lng: number | null): Promise<ResultadoAcao<{ em?: string; ja_registrada?: boolean }>> {
  try {
    const sessao = await getMotoristaSessao();
    if (!sessao) return { ok: false, erro: "Sessão expirada. Entre de novo." };
    const { carga, employeeId } = await exigirCargaDoMotorista(sessao, cargaId);
    if (!carga.paradas.some((p) => p.parada_id === paradaId)) return { ok: false, erro: "Essa parada não é desta carga." };
    const r = await registrarChegadaParada(paradaId, lat, lng, employeeId);
    revalidatePath(BASE);
    return { ok: true, dados: { em: r.em, ja_registrada: r.ja_registrada } };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}
