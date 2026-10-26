import { getSupabaseAdmin } from "./supabaseAdmin";
import { comTrava } from "./travaSync";
import { lerCarga, lerExpedicao, listarCargas, listarEmpresas, mensagemDeErro } from "./odoo/logistica";
import type { CargaDetalhe, CargaOdoo, EntregaOdoo } from "./odoo/logisticaTipos";
import { nomePedidoOdoo } from "./pedidoOdoo";

// Retrato da expedição do Odoo em odoo_expedicao (0203) -- Victor 26/10/2026:
// dá o id numérico do pedido no Odoo pra imprimir a nota pela ponte, sem
// depender de rota nova do Pedro. Cron próprio (/api/sync-odoo-expedicao,
// 30 min): 16 empresas, 2 de cada vez (~4 s cada no CD).
// A expedição só lista saída PENDENTE: o pedido que já saiu numa carga some
// dela (no 1º teste, 2 dos 52 pedidos do Odoo da consulta). Por isso também
// lê as cargas dos últimos 30 dias -- cada parada traz o pedido e o id. Carga
// finalizada é lida uma vez por processo; as abertas, a cada rodada.

const SIMULTANEAS = 2;
const DIAS_CARGAS = 30;
const cargasFechadasLidas = new Set<number>();

export type ResumoExpedicao = { empresas: number; saidas: number; cargas: number; falhas: { empresa: string; erro: string }[] };

export function linhasDaCarga(c: CargaDetalhe, empresa: string, agora: string) {
  return (c.paradas ?? []).flatMap((p) =>
    (p.pickings ?? [])
      .filter((k) => k.picking_id && k.pedido)
      .map((k) => ({
        picking_id: k.picking_id,
        pedido: k.pedido,
        pedido_id: k.pedido_id || null,
        company_id: c.company_id,
        empresa,
        cliente: p.cliente || null,
        cliente_id: p.cliente_id || null,
        telefone: p.telefone || null,
        legado: !!k.legado,
        estado: k.estado || null,
        carga_id: c.carga_id,
        carga_romaneio: c.romaneio || null,
        carga_estado: c.cancelada ? "cancelada" : c.estado || null,
        carga_prevista: odooDia(c.data_prevista),
        carga_saiu_em: odooUtc(c.saiu_em),
        carga_fim_em: odooUtc(c.fim_rota_em),
        resultado: p.resultado || null,
        visto_em: agora,
      }))
  );
}

async function emPares<T>(itens: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < itens.length; i += SIMULTANEAS) await Promise.all(itens.slice(i, i + SIMULTANEAS).map(fn));
}

async function gravar(admin: ReturnType<typeof getSupabaseAdmin>, linhas: { picking_id: number }[]) {
  const unicas = [...new Map(linhas.map((l) => [l.picking_id, l])).values()];
  for (let j = 0; j < unicas.length; j += 500) {
    const { error } = await admin.from("odoo_expedicao").upsert(unicas.slice(j, j + 500), { onConflict: "picking_id" });
    if (error) throw new Error(error.message);
  }
  return unicas.length;
}

// Datas do Odoo vêm em UTC sem fuso ("2026-10-26 15:36:38"). Formato fora do
// esperado vira null: uma data estranha não pode derrubar a gravação da empresa.
function odooUtc(v: string | false | null | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(v) ? `${v.slice(0, 19).replace(" ", "T")}Z` : null;
}
function odooDia(v: string | false | null | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

export function linhaDaSaida(e: EntregaOdoo, companyId: number, empresa: string, agora: string) {
  return {
    picking_id: e.picking_id,
    pedido: e.pedido || e.origem,
    pedido_id: e.pedido_id || null,
    company_id: companyId,
    empresa,
    cliente: e.cliente || null,
    cliente_id: e.cliente_id || null,
    telefone: e.telefone || null,
    nf5922: e.nf5922 || null,
    nf5117: e.nf5117 || null,
    legado: !!e.legado,
    modo: e.modo || null,
    estado: e.estado || null,
    filial_entrega: e.filial_entrega || null,
    retira_em: e.retira_em || null,
    expresso: !!e.expresso,
    data_programada: odooDia(e.data_programada),
    pendencia_motivo: e.pendencia ? e.pendencia_motivo || "pendência" : null,
    // Situação da carga: zerada aqui e preenchida pela leitura das cargas, logo
    // depois na mesma rodada (saída que voltou pra fila não fica com a carga
    // antiga). O resultado da última tentativa não é apagado.
    carga_id: e.carga_id || null,
    carga_romaneio: e.carga_id ? e.carga || null : null,
    carga_estado: null,
    carga_prevista: null,
    carga_saiu_em: null,
    carga_fim_em: null,
    visto_em: agora,
  };
}

export async function sincronizarExpedicaoOdoo(): Promise<ResumoExpedicao | { skipped: string }> {
  const admin = getSupabaseAdmin();
  return comTrava(admin, "odoo_expedicao", "cron", 15 * 60, async () => {
    const empresas = await listarEmpresas("logistica");
    const resumo: ResumoExpedicao = { empresas: empresas.length, saidas: 0, cargas: 0, falhas: [] };
    const agora = new Date().toISOString();
    const nomeEmpresa = new Map(empresas.map((e) => [e.id, e.name]));
    const cargas: CargaOdoo[] = [];
    await emPares(empresas, async (emp) => {
      try {
        const r = await lerExpedicao(emp.id);
        const linhas = [...(r.entregas ?? []), ...(r.pendencias ?? [])]
          .filter((e) => e.picking_id && (e.pedido || e.origem))
          .map((e) => linhaDaSaida(e, emp.id, emp.name, agora));
        const gravadas = await gravar(admin, linhas);
        resumo.saidas += gravadas;
        cargas.push(...(await listarCargas(emp.id, { dias: DIAS_CARGAS })));
      } catch (err) {
        resumo.falhas.push({ empresa: emp.name, erro: mensagemDeErro(err) });
      }
    });
    const aLer = [...new Map(cargas.map((c) => [c.carga_id, c])).values()].filter((c) => !cargasFechadasLidas.has(c.carga_id));
    await emPares(aLer, async (c) => {
      try {
        const detalhe = await lerCarga(c.carga_id);
        const gravadas = await gravar(admin, linhasDaCarga(detalhe, nomeEmpresa.get(detalhe.company_id) ?? c.empresa ?? "", agora));
        resumo.saidas += gravadas;
        resumo.cargas += 1;
        if (c.estado === "finalizada" || c.cancelada) cargasFechadasLidas.add(c.carga_id);
      } catch (err) {
        resumo.falhas.push({ empresa: `carga ${c.romaneio}`, erro: mensagemDeErro(err) });
      }
    });
    return resumo;
  });
}

export async function pedidoIdOdoo(pedido: string): Promise<number | null> {
  const nome = nomePedidoOdoo(pedido);
  if (!nome) return null;
  const { data } = await getSupabaseAdmin()
    .from("odoo_expedicao")
    .select("pedido_id")
    .eq("pedido", nome)
    .not("pedido_id", "is", null)
    .limit(1);
  return data?.[0]?.pedido_id ?? null;
}
