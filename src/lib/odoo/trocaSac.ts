// Troca de produto na nota pelo SAC -- Victor 30/10/2026. Ponte do Pedro com
// perfil próprio "sac" (chave ODOO_KEY_SAC, só no servidor): prévia do crédito,
// busca de produto, trazer venda do Protheus e a troca em si. A troca exige
// autorizado_por + chamado (sem eles a ponte devolve 403); quem autoriza é só
// o Victor (AUTORIZADOR_TROCA_SAC).

export const AUTORIZADOR_TROCA_SAC = "8089880c-ee01-435d-8eeb-523a5c37e8a8";

export const MOTIVOS_TROCA = [
  { codigo: "defeito", nome: "Defeito / avaria" },
  { codigo: "cor_modelo", nome: "Cor ou modelo diferente" },
  { codigo: "tamanho_medida", nome: "Tamanho / medida errada" },
  { codigo: "produto_errado", nome: "Produto errado entregue" },
  { codigo: "entrega_atrasada", nome: "Entrega atrasada" },
  { codigo: "nao_quis_esperar", nome: "Cliente não quis esperar" },
  { codigo: "desistencia", nome: "Desistência" },
  { codigo: "outro", nome: "Outro" },
] as const;

export const MODOS_TROCA = [
  { codigo: "entrega", nome: "Entrega (vai na rota do CD)" },
  { codigo: "retira_depois", nome: "Cliente retira depois na loja" },
  { codigo: "na_hora", nome: "Cliente leva agora" },
] as const;

export type ItemVolta = { codigo: string; qtd: number; descricao?: string; preco?: number };
export type ItemNovo = { codigo: string; qtd: number; preco: number; nome: string };
export type PedidoTroca = {
  itens: ItemVolta[];
  novos: ItemNovo[];
  modo: (typeof MODOS_TROCA)[number]["codigo"];
  filial_retirada?: string;
  data_entrega?: string;
  motivo: (typeof MOTIVOS_TROCA)[number]["codigo"];
  justificativa: string;
};

const TIMEOUT_MS = 90_000;

async function ponteSac<T>(caminho: string, init: { metodo?: "GET" | "POST"; corpo?: unknown } = {}): Promise<T> {
  const base = (process.env.ODOO_BRIDGE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.ODOO_KEY_SAC;
  if (!base || !chave) throw new Error("A chave do SAC na ponte não está configurada no servidor.");
  const r = await fetch(`${base}${caminho}`, {
    method: init.metodo ?? "GET",
    headers: { "X-Maia-Perfil": "sac", "X-Maia-Key": chave, Accept: "application/json", ...(init.corpo ? { "Content-Type": "application/json" } : {}) },
    body: init.corpo ? JSON.stringify(init.corpo) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => null)) as (T & { ok?: boolean; erro?: string }) | null;
  if (!j) throw new Error(`a ponte respondeu ${r.status} sem dados`);
  if (!r.ok && !("parcial" in (j as object))) throw new Error(j.erro || `a ponte respondeu ${r.status}`);
  return j;
}

export type PreviaTroca = { pedido: string; cliente: string; itens: { codigo: string; descricao: string; qtd: number; preco: number }[]; valor: number };

export function previaTroca(pedidoId: number, itens: ItemVolta[]): Promise<PreviaTroca> {
  const q = itens.map((i) => `${encodeURIComponent(i.codigo)}:${i.qtd}`).join(",");
  return ponteSac<PreviaTroca>(`/pedido/${Math.trunc(pedidoId)}/troca-previa?itens=${q}`);
}

export type ProdutoOdoo = { id: number; default_code: string; name: string; list_price: number };

export async function buscarProdutos(q: string): Promise<ProdutoOdoo[]> {
  const r = await ponteSac<ProdutoOdoo[] | { produtos?: ProdutoOdoo[] }>(`/produtos?q=${encodeURIComponent(q)}`);
  return Array.isArray(r) ? r : (r.produtos ?? []);
}

export type ResultadoTroca = {
  ok: boolean;
  parcial?: boolean;
  credito?: string;
  valor_credito?: number;
  nf_troca?: string;
  numero?: string;
  pedido_novo?: string;
  pedido_novo_id?: number;
  total_novo?: number;
  usou_credito?: number;
  sobra_credito?: number;
  erro?: string | null;
};

export function executarTroca(pedidoId: number, p: PedidoTroca, extra: { autorizadoPor: string; chamado: string; operador: string; diferencaPix: number }): Promise<ResultadoTroca> {
  return ponteSac<ResultadoTroca>(`/pedido/${Math.trunc(pedidoId)}/troca-produto`, {
    metodo: "POST",
    corpo: {
      tipo: "credito",
      itens: p.itens.map((i) => ({ codigo: i.codigo, qtd: i.qtd })),
      novos: p.novos,
      modo: p.modo,
      filial_retirada: p.filial_retirada || "",
      data_entrega: p.data_entrega || "",
      motivo: p.motivo,
      justificativa: p.justificativa,
      operador: extra.operador,
      autorizado_por: extra.autorizadoPor,
      chamado: extra.chamado,
      pagamento_diferenca: extra.diferencaPix > 0.009 ? [{ tipo: "pix", valor: extra.diferencaPix }] : [],
    },
  });
}

export function trazerVendaProtheus(companyId: number, cpf: string, chave: string): Promise<{ ok: boolean; pedido_id: number; pedido: string; ja_existia?: boolean }> {
  return ponteSac(`/vendas-cliente/protheus/trazer`, { metodo: "POST", corpo: { company_id: companyId, cpf, chave } });
}

export const totalNovos = (novos: ItemNovo[]) => Math.round(novos.reduce((s, n) => s + n.qtd * n.preco, 0) * 100) / 100;
