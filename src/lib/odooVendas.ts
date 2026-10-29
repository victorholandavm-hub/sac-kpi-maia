import type { getSupabaseAdmin } from "./supabaseAdmin";
import type { PedidoOdooPonte } from "./consultaOdooPonte";
import { diaHoraRecife } from "./odooCargasComoProtheus";
import { separarVendedorOdoo } from "./vendaNpsOdoo";

// Vendas do Odoo em totvs_orders -- Victor 29/10/2026. A compat do Pedro
// gravava só parte das vendas desde a virada (27/10: 152 linhas, R$ 163 mil;
// a ponte: 326 vendas, R$ 330 mil). A ponte agora lista todas as vendas do dia
// (GET /consulta/vendas?dia=, inclusive balcão), no formato da
// /consulta/pedidos: uma linha por venda, com o pedido do Odoo no lugar da
// nota ("S02308", série ODOO), e os itens em totvs_order_items. As linhas da
// compat do mesmo dia (séries O1/O2/OABA) saem.

type Admin = ReturnType<typeof getSupabaseAdmin>;

export const PRIMEIRO_DIA_ODOO = "2026-10-25";
export const SERIE_ODOO = "ODOO";
const SERIES_COMPAT = ["O1", "O2", "OABA"];
const TIMEOUT_MS = 30_000;

export type VendaOdoo = PedidoOdooPonte & { cliente: PedidoOdooPonte["cliente"] & { telefone2?: string } };

export async function vendasDoDia(dia: string): Promise<VendaOdoo[]> {
  const base = (process.env.ODOO_BRIDGE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.ODOO_KEY_LOGISTICA;
  if (!base || !chave) throw new Error("Ponte do Odoo não configurada.");
  const r = await fetch(`${base}/consulta/vendas?dia=${encodeURIComponent(dia)}`, {
    headers: { "X-Maia-Perfil": "logistica", "X-Maia-Key": chave, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`ponte respondeu ${r.status}`);
  const j = (await r.json()) as { vendas?: VendaOdoo[] };
  return j.vendas ?? [];
}

export function vendaComoProtheus(v: VendaOdoo, dia: string) {
  const vendedor = separarVendedorOdoo(v.vendedor);
  const nota = (v.notas ?? []).find((n) => n.tipo === "5922" && n.chave) ?? (v.notas ?? []).find((n) => /nfc/i.test(n.tipo) && n.chave);
  const cpf = (v.cliente?.cpf ?? "").replace(/\D/g, "");
  return {
    venda: {
      invoice: v.pedido,
      serie: SERIE_ODOO,
      branch: v.loja,
      issue_date: diaHoraRecife(v.data)?.[0] ?? dia,
      payment_method: v.modo === "na_hora" ? "Balcão" : null,
      invoice_total: Number(v.total ?? 0),
      type: "Venda",
      nfe_key: nota?.chave ?? null,
      seller_id: vendedor.codigo,
      seller_name: vendedor.nome,
      client_id: v.cliente?.id ? `ODOO${v.cliente.id}` : null,
      client_cpf_cnpj: cpf || null,
      client_name: v.cliente?.nome || null,
      client_loja: null,
    },
    itens: (v.itens ?? []).map((i, n) => ({
      item_number: String(n + 1).padStart(2, "0"),
      product: i.codigo || null,
      description: i.nome || null,
      manufacturer: null,
      unit: null,
      quantity: Number(i.qtd ?? 0),
      unit_price: Number(i.preco ?? 0),
      sale_price: Number(i.preco ?? 0),
      total: Number(i.subtotal ?? 0),
      discount: null,
      tes: null,
      cfop: null,
    })),
  };
}

// Grava as vendas de um dia e tira as linhas da compat desse dia. Devolve quantas gravou.
export async function gravarVendasDoDia(admin: Admin, dia: string): Promise<number> {
  const vendas = (await vendasDoDia(dia)).filter((v) => v.estado !== "cancel" && v.pedido && v.loja);
  const linhas = vendas.map((v) => vendaComoProtheus(v, dia));
  if (linhas.length) {
    const { data, error } = await admin
      .from("totvs_orders")
      .upsert(
        linhas.map((l) => l.venda),
        { onConflict: "invoice,serie,branch" }
      )
      .select("id, invoice, branch")
      .returns<{ id: string; invoice: string; branch: string }[]>();
    if (error) throw new Error(error.message);
    const id = new Map((data ?? []).map((d) => [`${d.invoice}|${d.branch}`, d.id]));
    const itens = linhas.flatMap((l) => {
      const orderId = id.get(`${l.venda.invoice}|${l.venda.branch}`);
      return orderId ? l.itens.map((i) => ({ ...i, order_id: orderId })) : [];
    });
    for (let i = 0; i < itens.length; i += 500) {
      const { error: e2 } = await admin.from("totvs_order_items").upsert(itens.slice(i, i + 500), { onConflict: "order_id,item_number" });
      if (e2) throw new Error(e2.message);
    }
  }
  // Só depois de gravar as da ponte: um dia sem resposta não fica vazio.
  const { error: e3 } = await admin.from("totvs_orders").delete().eq("issue_date", dia).in("serie", SERIES_COMPAT);
  if (e3) throw new Error(e3.message);
  return linhas.length;
}

const CHAVE_RECUPERACAO = "odoo_vendas_recuperar_desde";
const proximoDia = (dia: string) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
const hojeRecife = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());

export type ResumoVendasOdoo = { dias: string[]; vendas: number; falhas: string[] };

// A cada leitura (30 min): hoje e ontem, mais um dia atrasado (de 25/10 em
// diante) até chegar em anteontem -- 3 chamadas de ~2 s.
export async function sincronizarVendasOdoo(admin: Admin): Promise<ResumoVendasOdoo> {
  const hoje = hojeRecife();
  const ontem = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const { data: estado } = await admin.from("totvs_sync_state").select("value").eq("key", CHAVE_RECUPERACAO).maybeSingle();
  const atrasado = (estado?.value as string | undefined) ?? PRIMEIRO_DIA_ODOO;
  const dias = [hoje, ontem, ...(atrasado < ontem ? [atrasado] : [])];
  const resumo: ResumoVendasOdoo = { dias, vendas: 0, falhas: [] };
  for (const dia of dias) {
    try {
      resumo.vendas += await gravarVendasDoDia(admin, dia);
      if (dia === atrasado && atrasado < ontem) await admin.from("totvs_sync_state").upsert({ key: CHAVE_RECUPERACAO, value: proximoDia(atrasado) }, { onConflict: "key" });
    } catch (err) {
      resumo.falhas.push(`${dia}: ${(err as Error).message}`);
    }
  }
  return resumo;
}
