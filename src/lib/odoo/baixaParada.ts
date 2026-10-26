// Baixa de uma parada do Odoo pelo motorista -- regra única usada pela
// Server Action (registrarParadaAction) e pela rota POST
// /assistencia/motorista/odoo/baixa (fila offline da PWA: a página e o
// service worker reenviam por ela, porque o service worker não consegue
// chamar Server Action).

import { mensagemDeErro, registrarResultadoParada } from "./logistica";
import type { MotoristaSessao } from "./logisticaAuth";
import { exigirCargaDoMotorista } from "./rotaMotorista";
import { montarObservacao, type ResultadoParada, type ResultadoParadaResposta } from "./logisticaTipos";
import { classificarErroBaixa, criarDedupEventos, eventoUidValido, observacaoComHorario, type FalhaBaixa } from "./baixaIdempotencia";

export type EntradaBaixa = {
  cargaId: number;
  paradaId: number;
  resultado: ResultadoParada;
  motivo?: string | null;
  obs?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  fotoUrls?: string[];
  itens?: { codigo: string; qtd_entregue: number }[];
  eventoUid?: string | null;
  registradoEm?: string | null; // ISO, hora do toque no celular
};

export type ResultadoBaixa = { ok: true; dados: ResultadoParadaResposta } | { ok: false; erro: string; tipo: FalhaBaixa };

const RESULTADOS: ResultadoParada[] = ["entregue", "entrega_parcial", "insucesso"];

const dedup = criarDedupEventos<ResultadoBaixa>();

function recusa(erro: string, tipo: FalhaBaixa = "recusada"): ResultadoBaixa {
  return { ok: false, erro, tipo };
}

async function executar(s: MotoristaSessao, e: EntradaBaixa): Promise<ResultadoBaixa> {
  if (!RESULTADOS.includes(e.resultado)) return recusa("Resultado inválido.");
  if (e.resultado === "insucesso" && !e.motivo) return recusa("Escolha o motivo.");
  if (e.resultado === "entrega_parcial" && !(e.itens ?? []).length) return recusa("Entrega parcial: informe o que foi entregue de cada item.");
  try {
    const { carga, employeeId } = await exigirCargaDoMotorista(s, e.cargaId);
    if (carga.estado !== "em_rota") return recusa(`A baixa só abre com a carga em rota (carga está "${carga.estado}").`);
    const parada = carga.paradas.find((p) => p.parada_id === e.paradaId);
    if (!parada) return recusa("Essa parada não é desta carga.");
    if (parada.resultado) return recusa(`Parada já registrada como "${parada.resultado}".`, "ja_registrada");

    // Links só do nosso próprio storage de fotos (não aceita URL arbitrária
    // vinda do navegador dentro do histórico do Odoo).
    const fotos = (e.fotoUrls ?? []).filter((u) => typeof u === "string" && /^https?:\/\/[^\s]+\/api\/photos\/odoo-entregas\//.test(u)).slice(0, 4);
    const geoOk = typeof e.geoLat === "number" && typeof e.geoLng === "number" && Number.isFinite(e.geoLat) && Number.isFinite(e.geoLng);
    const dados = await registrarResultadoParada(e.paradaId, {
      resultado: e.resultado,
      motivo: e.resultado === "insucesso" ? e.motivo : null,
      itens: e.resultado === "entrega_parcial" ? (e.itens ?? []).map((i) => ({ codigo: String(i.codigo).trim().toUpperCase(), qtd_entregue: Number(i.qtd_entregue) || 0 })) : null,
      geo_lat: geoOk ? e.geoLat : null,
      geo_lng: geoOk ? e.geoLng : null,
      origem: "app",
      motorista_id: employeeId,
      obs: montarObservacao(observacaoComHorario(e.obs, e.registradoEm), fotos),
      evento_uid: eventoUidValido(e.eventoUid) ? e.eventoUid : null,
    });
    return { ok: true, dados };
  } catch (err) {
    console.error("[motorista-odoo] parada", err);
    return recusa(mensagemDeErro(err), classificarErroBaixa(err));
  }
}

export async function registrarBaixaParada(s: MotoristaSessao | null, e: EntradaBaixa): Promise<ResultadoBaixa> {
  if (!s) return recusa("Sessão expirada. Faça login de novo.", "sessao");
  const uid = eventoUidValido(e.eventoUid) ? e.eventoUid : null;
  if (!uid) return executar(s, e);

  const inicio = dedup.iniciar(uid);
  if (inicio.tipo === "feito") return inicio.resposta;
  if (inicio.tipo === "andamento") return recusa("Essa baixa já está sendo enviada. Tentando de novo em instantes.", "transitorio");
  const r = await executar(s, e);
  // Só o sucesso fica lembrado (reenvio do mesmo uid recebe a mesma
  // resposta, mesmo que a resposta original tenha se perdido na rede). Recusa
  // não: o motorista pode corrigir e mandar "Tentar de novo" com o mesmo uid.
  if (r.ok) dedup.concluir(uid, r);
  else dedup.liberar(uid);
  return r;
}
