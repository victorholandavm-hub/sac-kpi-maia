// Histórico em ordem cronológica de cada pedido na consulta -- Victor
// 27/10/2026 ("onde aparece o histórico de um pedido: quando foi faturado,
// quem faturou, se já houve tentativa de entrega"). Tudo no horário de Recife.
// Protheus: venda (totvs_orders) + passos de cada carga do CSV do Pedro
// (protheus_cargas_historico, 0212) + a baixa da tentativa. Odoo: venda e
// notas (/consulta/pedidos) + eventos da carga (ponte) com quem fez cada passo
// (odoo_carga_acoes, 0206).

export type EventoHistorico = { quando: string; texto: string; quem?: string | null; tom?: "bom" | "atencao" | "critico" };

const RECIFE = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

// Data do Odoo/ISO em UTC -> "AAAA-MM-DD HH:MM" em Recife.
export function quandoUtc(v: string | null | undefined): string | null {
  if (!v) return null;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v.replace(" ", "T")}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : RECIFE.format(d).replace(",", "");
}

// Data + hora já em Recife (Protheus) -> "AAAA-MM-DD HH:MM" ("AAAA-MM-DD" sem hora).
export function quandoLocal(dia: string | null | undefined, hora?: string | null): string | null {
  if (!dia || !/^\d{4}-\d{2}-\d{2}/.test(dia)) return null;
  const h = (hora ?? "").match(/^(\d{1,2}):(\d{2})/);
  return h ? `${dia.slice(0, 10)} ${h[1].padStart(2, "0")}:${h[2]}` : dia.slice(0, 10);
}

export const ordenar = (eventos: EventoHistorico[]) => [...eventos].sort((a, b) => a.quando.localeCompare(b.quando));

export type CargaHistoricoProtheus = {
  carga: string;
  incluida_em: string | null;
  incluida_por: string | null;
  separacao_em: string | null;
  separacao_hora: string | null;
  separacao_por: string | null;
  faturada_em: string | null;
  faturada_hora: string | null;
  faturada_por: string | null;
  liberada_em: string | null;
  liberada_hora: string | null;
  em_rota_em: string | null;
  em_rota_hora: string | null;
  conferente_nome: string | null;
};

type TentativaParaHistorico = {
  carga: string;
  tentativa: number | null;
  motorista: string | null;
  comResultado: boolean;
  resultadoCodigo: string | null;
  baixaDia: string | null;
  baixaHora: string | null;
  ocorrencia: string | null;
};

const RESULTADO_PROTHEUS: Record<string, { texto: string; tom: EventoHistorico["tom"] }> = {
  "1": { texto: "Entregue", tom: "bom" },
  "2": { texto: "Entregue em parte", tom: "atencao" },
  "3": { texto: "Não entregue (voltou)", tom: "critico" },
  "4": { texto: "Entrega cancelada", tom: "critico" },
};

export function historicoProtheus(
  venda: { data: string; notaFiscal: string; vendedor: string | null } | null,
  tentativas: TentativaParaHistorico[],
  cargas: Map<string, CargaHistoricoProtheus>
): EventoHistorico[] {
  const ev: EventoHistorico[] = [];
  const push = (quando: string | null, texto: string, quem?: string | null, tom?: EventoHistorico["tom"]) => {
    if (quando) ev.push({ quando, texto, quem: quem || null, tom });
  };
  if (venda) push(quandoLocal(venda.data), `Venda — NF ${venda.notaFiscal.replace(/^0+/, "")}`, venda.vendedor);
  for (const t of tentativas) {
    const h = cargas.get(t.carga);
    const n = t.tentativa ? ` (${t.tentativa}ª tentativa)` : "";
    if (h) {
      push(quandoLocal(h.incluida_em), `Incluído na carga ${t.carga}${n}`, h.incluida_por);
      push(quandoLocal(h.separacao_em, h.separacao_hora), `Separação da carga ${t.carga}`, h.separacao_por);
      push(quandoLocal(h.faturada_em, h.faturada_hora), `Nota de entrega faturada (carga ${t.carga})`, h.faturada_por);
      push(quandoLocal(h.liberada_em, h.liberada_hora), `Carga ${t.carga} liberada${h.conferente_nome ? ` — conferida por ${h.conferente_nome}` : ""}`);
      push(quandoLocal(h.em_rota_em, h.em_rota_hora), `Saiu em rota (carga ${t.carga})`, t.motorista);
    }
    if (t.comResultado && t.resultadoCodigo) {
      const r = RESULTADO_PROTHEUS[t.resultadoCodigo] ?? { texto: "Baixa", tom: undefined };
      push(quandoLocal(t.baixaDia, t.baixaHora), `${r.texto}${t.resultadoCodigo !== "1" && t.ocorrencia ? ` — ${t.ocorrencia}` : ""}`, t.motorista, r.tom);
    }
  }
  return ordenar(ev);
}

export type EventoCargaOdoo = { tipo: string; em: string | false; picking: string; parada_id?: number | false };
export type AcaoCargaOdoo = { acao: string; operador: string; em: string };

const EVENTO_ODOO: Record<string, { texto: string; acao?: string; tom?: EventoHistorico["tom"]; daParada?: boolean }> = {
  separacao_iniciada: { texto: "Separação iniciada", acao: "separacao" },
  conferida: { texto: "Carga conferida", acao: "conferir" },
  liberada: { texto: "Carga liberada", acao: "liberar" },
  saiu_em_rota: { texto: "Saiu em rota (nota de entrega emitida)", acao: "sair" },
  chegada_cliente: { texto: "Motorista chegou no cliente", daParada: true },
  entregue: { texto: "Entregue", tom: "bom", daParada: true },
  entrega_parcial: { texto: "Entregue em parte", tom: "atencao", daParada: true },
  insucesso: { texto: "Não entregue", tom: "critico", daParada: true },
  reagendada: { texto: "Reagendada", tom: "atencao", daParada: true },
  fim_de_rota: { texto: "Fim da rota", acao: "finalizar" },
};

// Eventos da carga do Odoo: os da carga inteira (separação, conferência,
// liberação, saída, fim) e os da parada só quando são da parada/saídas deste
// pedido. Passo da carga anterior à venda (o pedido entrou depois) fica de fora.
export function historicoOdoo(
  venda: { data: string | null; vendedor: string | null; loja: string | null } | null,
  notas: { tipo: string; numero: string; data?: string | null }[],
  cargas: { romaneio: string; eventos: EventoCargaOdoo[]; acoes: AcaoCargaOdoo[]; motorista: string | null }[],
  doPedido: { pickings: Set<string>; paradas: Set<number> }
): EventoHistorico[] {
  const ev: EventoHistorico[] = [];
  if (venda?.data) {
    const q = quandoUtc(venda.data);
    if (q) ev.push({ quando: q, texto: `Venda${venda.loja ? ` — loja ${venda.loja}` : ""}`, quem: venda.vendedor });
  }
  for (const n of notas) {
    const q = quandoUtc(n.data ?? null);
    if (q) ev.push({ quando: q, texto: `${n.tipo.startsWith("5117") ? "Nota de entrega" : n.tipo.startsWith("5922") ? "Nota de venda" : `Nota ${n.tipo}`} ${n.numero} emitida` });
  }
  const vendaEm = ev[0]?.quando ?? "";
  for (const c of cargas) {
    for (const e of c.eventos) {
      const def = EVENTO_ODOO[e.tipo];
      if (!def) continue;
      if (def.daParada && !doPedido.pickings.has(e.picking) && !(e.parada_id && doPedido.paradas.has(e.parada_id))) continue;
      const q = quandoUtc(e.em || null);
      if (!q || (!def.daParada && q < vendaEm)) continue;
      const operador = def.acao ? [...c.acoes].reverse().find((a) => a.acao === def.acao)?.operador.replace(/^(CD|Equipe) /, "") : null;
      const quem = operador ?? (def.daParada || e.tipo === "saiu_em_rota" ? c.motorista : null);
      ev.push({ quando: q, texto: `${def.texto} — carga ${c.romaneio}`, quem: quem ?? null, tom: def.tom });
    }
  }
  return ordenar(ev);
}
