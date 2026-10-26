import { getSupabaseAdmin } from "./supabaseAdmin";
import { comTrava } from "./travaSync";
import { lerExpedicao, listarEmpresas, mensagemDeErro } from "./odoo/logistica";
import type { EntregaOdoo } from "./odoo/logisticaTipos";
import { nomePedidoOdoo } from "./pedidoOdoo";

// Retrato da expedição do Odoo em odoo_expedicao (0203) -- Victor 26/10/2026:
// dá o id numérico do pedido no Odoo pra imprimir a nota pela ponte, sem
// depender de rota nova do Pedro. Roda junto do cron do /api/totvs-sync
// (30 min): 16 empresas, 2 de cada vez (~4 s cada no CD).

const SIMULTANEAS = 2;

export type ResumoExpedicao = { empresas: number; saidas: number; falhas: { empresa: string; erro: string }[] };

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
    visto_em: agora,
  };
}

export async function sincronizarExpedicaoOdoo(): Promise<ResumoExpedicao | { skipped: string }> {
  const admin = getSupabaseAdmin();
  return comTrava(admin, "odoo_expedicao", "cron", 15 * 60, async () => {
    const empresas = await listarEmpresas("logistica");
    const resumo: ResumoExpedicao = { empresas: empresas.length, saidas: 0, falhas: [] };
    const agora = new Date().toISOString();
    for (let i = 0; i < empresas.length; i += SIMULTANEAS) {
      await Promise.all(
        empresas.slice(i, i + SIMULTANEAS).map(async (emp) => {
          try {
            const r = await lerExpedicao(emp.id);
            const linhas = [...(r.entregas ?? []), ...(r.pendencias ?? [])]
              .filter((e) => e.picking_id && (e.pedido || e.origem))
              .map((e) => linhaDaSaida(e, emp.id, emp.name, agora));
            const unicas = [...new Map(linhas.map((l) => [l.picking_id, l])).values()];
            for (let j = 0; j < unicas.length; j += 500) {
              const { error } = await admin.from("odoo_expedicao").upsert(unicas.slice(j, j + 500), { onConflict: "picking_id" });
              if (error) throw new Error(error.message);
            }
            resumo.saidas += unicas.length;
          } catch (err) {
            resumo.falhas.push({ empresa: emp.name, erro: mensagemDeErro(err) });
          }
        })
      );
    }
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
