import { getSupabaseAdmin } from "./supabaseAdmin";
import type { BuscaEntrega } from "./odoo/logistica";
import { consultarPedidosOdoo } from "./consultaOdooPonte";

// "Não entregue" do motorista nas cargas do Odoo -- Victor 30/10/2026. Lê as
// linhas que odooCargasComoProtheus.ts grava (pedido ODOO-S…, resultado 3).
//  - corrigirBusca: a busca da ponte chama de "Entregue" a saída concluída
//    cuja parada voltou (Jhon, S01825 Tania); aqui vira "Não entregue".
//  - naoEntreguesSemReentrega: quem voltou e ficou sem saída aberta nem carga
//    depois -- conferência diária, pra não sumir pedido de novo.

type Admin = ReturnType<typeof getSupabaseAdmin>;
type Falha = { pedido: string; cliente: string | null; carga: string; dia: string | null; motivo: string | null; motorista: string | null };

async function falhasDosPedidos(admin: Admin, pedidos: string[] | null, desde?: string): Promise<Falha[]> {
  let q = admin
    .from("totvs_delivery_cargas")
    .select("carga, dt_retorno, ocorrencia_descricao, motorista_nome, totvs_deliveries!inner(pedido, client_name)")
    .eq("status_origem", "ENTREGA")
    .eq("status_entrega_codigo", "3");
  q = pedidos ? q.in("totvs_deliveries.pedido", pedidos.map((p) => `ODOO-${p}`)) : q.like("totvs_deliveries.pedido", "ODOO-%");
  if (desde) q = q.gte("dt_retorno", desde);
  const { data, error } = await q.returns<
    { carga: string; dt_retorno: string | null; ocorrencia_descricao: string | null; motorista_nome: string | null; totvs_deliveries: { pedido: string; client_name: string | null } }[]
  >();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    pedido: r.totvs_deliveries.pedido.slice(5),
    cliente: r.totvs_deliveries.client_name,
    carga: r.carga,
    dia: r.dt_retorno,
    motivo: r.ocorrencia_descricao,
    motorista: r.motorista_nome,
  }));
}

export function corrigirSituacao(itens: BuscaEntrega[], falhas: Falha[]): BuscaEntrega[] {
  return itens.map((i) => {
    if (!/^entregue/i.test(i.situacao ?? "")) return i;
    const carga = (i.situacao ?? "").match(/carga (\S+)/)?.[1];
    const f = falhas.find((x) => x.pedido === i.pedido && x.carga === carga);
    if (!f) return i;
    const dia = f.dia ? f.dia.split("-").reverse().join("/") : "";
    return { ...i, cor: "alerta", situacao: `Não entregue · voltou da carga ${f.carga}${dia ? ` em ${dia}` : ""}${f.motivo ? ` (${f.motivo})` : ""}` };
  });
}

export async function corrigirBusca(itens: BuscaEntrega[]): Promise<BuscaEntrega[]> {
  const suspeitos = [...new Set(itens.filter((i) => /^entregue/i.test(i.situacao ?? "")).map((i) => i.pedido).filter(Boolean))];
  if (suspeitos.length === 0) return itens;
  const falhas = await falhasDosPedidos(getSupabaseAdmin(), suspeitos).catch(() => []);
  return corrigirSituacao(itens, falhas);
}

export type SemReentrega = Falha;

// Última falha de cada pedido (30 dias) que não tem saída aberta em
// odoo_expedicao nem carga depois da falha.
export function filtrarSemReentrega(
  falhas: Falha[],
  outrasCargas: { pedido: string; carga: string; dia: string | null }[],
  abertos: Set<string>,
): SemReentrega[] {
  const ultima = new Map<string, Falha>();
  for (const f of falhas) if (!ultima.has(f.pedido) || (f.dia ?? "") > (ultima.get(f.pedido)!.dia ?? "")) ultima.set(f.pedido, f);
  return [...ultima.values()]
    .filter((f) => !/teste/i.test(f.cliente ?? ""))
    .filter((f) => !abertos.has(f.pedido))
    .filter((f) => !outrasCargas.some((o) => o.pedido === f.pedido && o.carga !== f.carga && (o.dia ?? "") >= (f.dia ?? "")))
    .sort((a, b) => (b.dia ?? "").localeCompare(a.dia ?? "") || a.pedido.localeCompare(b.pedido));
}

export async function naoEntreguesSemReentrega(): Promise<SemReentrega[]> {
  const admin = getSupabaseAdmin();
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const falhas = await falhasDosPedidos(admin, null, desde);
  if (falhas.length === 0) return [];
  const pedidos = [...new Set(falhas.map((f) => f.pedido))];
  const [{ data: cargas }, { data: saidas }] = await Promise.all([
    admin
      .from("totvs_delivery_cargas")
      .select("carga, dt_previsao, totvs_deliveries!inner(pedido)")
      .in("totvs_deliveries.pedido", pedidos.map((p) => `ODOO-${p}`))
      .returns<{ carga: string; dt_previsao: string | null; totvs_deliveries: { pedido: string } }[]>(),
    // Só saída vista na leitura das últimas 3 h (a de 30 min): linha velha de saída que já fechou não conta como aberta.
    admin
      .from("odoo_expedicao")
      .select("pedido, estado")
      .in("pedido", pedidos)
      .gte("visto_em", new Date(Date.now() - 3 * 3_600_000).toISOString())
      .returns<{ pedido: string; estado: string | null }[]>(),
  ]);
  const abertos = new Set((saidas ?? []).filter((s) => s.estado && !["done", "cancel"].includes(s.estado)).map((s) => s.pedido));
  const candidatos = filtrarSemReentrega(
    falhas,
    (cargas ?? []).map((c) => ({ pedido: c.totvs_deliveries.pedido.slice(5), carga: c.carga, dia: c.dt_previsao })),
    abertos,
  );
  // Confirma no Odoo (a saída reaberta pode ainda não ter passado pela leitura de 30 min): 2 por vez.
  const confirmados: SemReentrega[] = [];
  for (let i = 0; i < candidatos.length; i += 2) {
    const lote = await Promise.all(
      candidatos.slice(i, i + 2).map(async (f) => {
        const p = (await consultarPedidosOdoo(f.pedido).catch(() => null))?.find((x) => x.pedido === f.pedido);
        if (!p) return f;
        return (p.entregas ?? []).some((e) => !["done", "cancel"].includes(e.estado)) ? null : f;
      }),
    );
    confirmados.push(...lote.filter((f): f is SemReentrega => !!f));
  }
  return confirmados;
}
