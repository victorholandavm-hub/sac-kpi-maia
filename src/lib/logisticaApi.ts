import { createHash, timingSafeEqual } from "crypto";

// API de logística (/api/logistica/v1): contrato em
// lojas-maia-integracao/apis/logistica-v1/openapi.yaml.

export const JANELA_MAXIMA_DIAS = 92;
export const TIPOS_CARGA = ["Entrega", "Express", "Retirada"] as const;

export type ErroApi = { erro: string; mensagem: string };

function digest(valor: string) {
  return createHash("sha256").update(valor).digest();
}

// LOGISTICA_API_KEYS: chaves separadas por vírgula, uma por consumidor.
// Sem a variável, ninguém entra (falha fechada).
export function apiKeyValida(recebida: string | null, configuradas: string | undefined): boolean {
  if (!recebida || !configuradas) return false;
  const alvo = digest(recebida);
  let ok = false;
  for (const chave of configuradas.split(",").map((c) => c.trim())) {
    if (chave && timingSafeEqual(alvo, digest(chave))) ok = true;
  }
  return ok;
}

function parseData(valor: string | null): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor ? data : null;
}

export type PeriodoKpis = { de: string; ate: string; tipo: string | null };

export function parsePeriodoKpis(params: URLSearchParams): { ok: true; periodo: PeriodoKpis } | { ok: false; erro: ErroApi } {
  const de = params.get("de");
  const ate = params.get("ate");
  const inicio = parseData(de);
  const fim = parseData(ate);
  if (!inicio || !fim) {
    return { ok: false, erro: { erro: "periodo_invalido", mensagem: "Informe de e ate no formato AAAA-MM-DD." } };
  }
  if (fim < inicio) {
    return { ok: false, erro: { erro: "periodo_invalido", mensagem: "ate não pode ser anterior a de." } };
  }
  const dias = (fim.getTime() - inicio.getTime()) / 86_400_000 + 1;
  if (dias > JANELA_MAXIMA_DIAS) {
    return {
      ok: false,
      erro: { erro: "periodo_invalido", mensagem: `Janela máxima de ${JANELA_MAXIMA_DIAS} dias.` },
    };
  }
  const tipo = params.get("tipo");
  if (tipo !== null && !(TIPOS_CARGA as readonly string[]).includes(tipo)) {
    return {
      ok: false,
      erro: { erro: "tipo_invalido", mensagem: `tipo deve ser um de: ${TIPOS_CARGA.join(", ")}.` },
    };
  }
  return { ok: true, periodo: { de: de!, ate: ate!, tipo } };
}
