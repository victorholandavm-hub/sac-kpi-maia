// GET /consulta/pedidos da ponte do Pedro (MURAL 26/10): pedidos do Odoo por
// CPF/CNPJ, nome, pedido (S01676) ou nº de nota (inclusive as do Protheus
// importadas), com itens, notas (com chave), vendedor, entregas e a venda do
// Protheus de origem (legado). Até 50 pedidos, ~1,5-2 s. Perfil logistica.

const TIMEOUT_MS = 20_000;

export type ItemPedidoOdoo = { codigo: string; nome: string; qtd: number; entregue: number; pendente: number; preco: number; subtotal: number };
export type NotaPedidoOdoo = { tipo: string; numero: string; serie: string; chave: string; estado: string; data: string };
export type EntregaPedidoOdoo = {
  picking: string;
  estado: string;
  carga: string;
  carga_estado: string;
  motorista: string;
  data_programada: string;
  entregue_em: string;
  sai_de: string;
  pendencia: boolean;
  pendencia_motivo: string;
};
export type PedidoOdooPonte = {
  pedido: string;
  pedido_id: number;
  data: string;
  loja: string;
  retira_em: string;
  cliente: { id: number; nome: string; cpf: string; telefone: string; email: string; endereco: string };
  vendedor: string;
  operador_caixa: string;
  total: number;
  modo: string;
  estado: string;
  data_entrega: string;
  itens: ItemPedidoOdoo[];
  notas: NotaPedidoOdoo[];
  entregas: EntregaPedidoOdoo[];
  legado: { nf_5922?: string; chave_5922?: string; nf_5117?: string; chave_5117?: string } | null;
};

export async function consultarPedidosOdoo(q: string): Promise<PedidoOdooPonte[]> {
  const base = (process.env.ODOO_BRIDGE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.ODOO_KEY_LOGISTICA;
  if (!base || !chave) throw new Error("Ponte do Odoo não configurada.");
  const r = await fetch(`${base}/consulta/pedidos?q=${encodeURIComponent(q)}`, {
    headers: { "X-Maia-Perfil": "logistica", "X-Maia-Key": chave, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`ponte respondeu ${r.status}`);
  const j = (await r.json()) as { pedidos?: PedidoOdooPonte[] };
  return j.pedidos ?? [];
}
