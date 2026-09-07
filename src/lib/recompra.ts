import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";
import { listClientesPorNivel, diasEntre, type ClienteNivel } from "./clientes";
import { DELIVERY_REQUEST_TYPES, CAUSA_RAIZ_ERRO_INTERNO } from "./assistenciaLabels";

// Motor de Recompra, Fase 1 -- pedido do Victor 07/09/2026 ("desenho
// completo" + "siga para a fase 1"): régua determinística (sem modelo
// estatístico), só com o que já está sincronizado hoje. Dois eixos:
//
// 1. Ciclo de reposição por categoria -- não é "dias desde a última
//    compra" genérico (isso é RFM de varejo rápido, não serve pra móvel/
//    colchão). É "dias desde a compra da categoria ÷ vida útil típica
//    daquela categoria" -- ver CATEGORIAS_CICLO abaixo.
// 2. Índice de atrito pós-venda -- nº e gravidade de chamados de
//    troca/envio/recolhimento (DELIVERY_REQUEST_TYPES, assistenciaLabels.ts)
//    ligados a esse cliente, pesados por causa_raiz.
//
// Os dois juntos decidem o segmento de ação (ver RecompraSegmento). Nada
// disso fica salvo em tabela -- computado on-demand, igual a
// listClientesPorNivel (clientes.ts), que é justamente a base de RFM/nível
// reaproveitada aqui.

// -----------------------------------------------------------------------
// Ciclo de reposição por categoria
// -----------------------------------------------------------------------

type CategoriaCiclo = {
  key: string;
  label: string;
  // Vida útil típica em meses -- estimativa de mercado pra móvel/colchão,
  // não veio de nenhuma fonte interna (não existe essa data no Protheus).
  // Ajustável aqui conforme a experiência real da loja for mostrando outro
  // padrão -- é a peça mais "chutada" desse modelo inteiro, de propósito
  // isolada num lugar só pra ser fácil de calibrar depois.
  cicloMeses: number;
  keywords: string[];
};

// Ordem importa: percorrida de cima pra baixo, primeira que bater vence.
// "PROTETOR DE COLCHAO" contém "COLCHAO" -- precisa checar a keyword mais
// específica (protetor, ciclo bem mais curto) antes da genérica (colchão
// em si), senão todo protetor vira sinal de troca de colchão.
export const CATEGORIAS_CICLO: CategoriaCiclo[] = [
  { key: "protetor", label: "Protetor de colchão", cicloMeses: 24, keywords: ["PROTETOR"] },
  { key: "travesseiro", label: "Travesseiro", cicloMeses: 18, keywords: ["TRAVESSEIRO", "TRAV "] },
  { key: "colchao", label: "Colchão/Box", cicloMeses: 96, keywords: ["COLCHAO", "BOX "] },
  { key: "estofado", label: "Sofá/Estofado", cicloMeses: 84, keywords: ["SOFA", "ESTOFAD", "POLTRONA"] },
  { key: "cama", label: "Cama/Berço/Beliche", cicloMeses: 108, keywords: ["BERCO", "BELICHE", "CAMA "] },
  { key: "roupeiro", label: "Roupeiro/Armário", cicloMeses: 132, keywords: ["ROUPEIRO", "GUARDA-ROUPA", "GUARDA ROUPA", "ARMARIO", "MULTI-USO"] },
  { key: "mesa", label: "Mesa/Rack/Estante", cicloMeses: 96, keywords: ["MESA", "RACK", "ESTANTE", "COMODA"] },
];

export function inferCategoriaCiclo(description: string | null): CategoriaCiclo | null {
  if (!description) return null;
  const desc = description.toUpperCase();
  for (const categoria of CATEGORIAS_CICLO) {
    if (categoria.keywords.some((kw) => desc.includes(kw))) return categoria;
  }
  return null;
}

// Índice >= 0,7 = "entrando na janela" -- pedido do Victor no desenho
// original (motor-de-recompra.html): não precisa esperar o ciclo terminar
// 100% pra virar candidato, 70% da vida útil já é sinal de que vale
// contatar antes do concorrente.
const RATIO_NA_JANELA = 0.7;

type CategoriaSinal = { categoria: CategoriaCiclo; dataCompra: string; diasDesde: number; ratio: number };

const ITEM_PAGE_SIZE = 1000;

type OrderItemRow = { description: string | null; totvs_orders: { client_id: string | null; issue_date: string } | null };

// Varre totvs_order_items inteiro (join com totvs_orders pra pegar
// client_id/issue_date, mesmo padrão já usado em vendasProduto.ts) -- pra
// cada cliente, guarda a compra MAIS RECENTE de cada categoria, depois
// escolhe a categoria com MAIOR ratio (a mais "vencida") como sinal de
// janela daquele cliente. ~54 mil dos ~81 mil itens batem nalguma
// categoria cíclica (conferido 07/09/2026) -- não filtra por palavra-chave
// na query (a lista de keywords muda too fácil pra depender de um OR gigante
// no banco), filtra em memória depois de trazer tudo, igual
// listClientesPorNivel já faz com o pedido inteiro.
async function buildJanelaPorCliente(): Promise<Map<string, CategoriaSinal>> {
  const admin = getSupabaseAdmin();
  const rows = await fetchAllPagesParallel<OrderItemRow>(
    (from, to) =>
      admin
        .from("totvs_order_items")
        .select("description, totvs_orders!inner(client_id, issue_date, type)", { count: "exact" })
        .eq("totvs_orders.type", "Venda")
        .not("totvs_orders.client_id", "is", null)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<OrderItemRow>>,
    { pageSize: ITEM_PAGE_SIZE }
  );

  // client_id -> categoria key -> data (YYYY-MM-DD) da compra mais recente
  // dessa categoria pra esse cliente.
  const ultimaPorCategoria = new Map<string, Map<string, string>>();
  for (const r of rows) {
    const order = r.totvs_orders;
    if (!order?.client_id) continue;
    const categoria = inferCategoriaCiclo(r.description);
    if (!categoria) continue;
    const porCategoria = ultimaPorCategoria.get(order.client_id) ?? new Map<string, string>();
    const atual = porCategoria.get(categoria.key);
    if (!atual || order.issue_date > atual) porCategoria.set(categoria.key, order.issue_date);
    ultimaPorCategoria.set(order.client_id, porCategoria);
  }

  const hoje = new Date();
  const resultado = new Map<string, CategoriaSinal>();
  for (const [clientId, porCategoria] of ultimaPorCategoria) {
    let melhor: CategoriaSinal | null = null;
    for (const [key, dataCompra] of porCategoria) {
      const categoria = CATEGORIAS_CICLO.find((c) => c.key === key);
      if (!categoria) continue;
      const diasDesde = diasEntre(dataCompra, hoje);
      const ratio = diasDesde / (categoria.cicloMeses * 30);
      if (!melhor || ratio > melhor.ratio) melhor = { categoria, dataCompra, diasDesde, ratio };
    }
    if (melhor) resultado.set(clientId, melhor);
  }
  return resultado;
}

// -----------------------------------------------------------------------
// Índice de atrito pós-venda
// -----------------------------------------------------------------------

// Peso por causa_raiz -- erro interno (time errou) pesa mais que avaria de
// transporte/defeito de fábrica (externo, mas ainda ruim pra experiência
// do cliente), que pesa mais que decisão do próprio cliente
// (solicitacao_cliente) ou motivo não classificado (outro). resolution_
// rating/delivery_rating (service_requests) existem no schema mas só 45
// dos 575 chamados têm preenchido e delivery_rating não varia (sempre 10)
// -- denso demais pra usar como sinal ainda, ver motor-de-recompra.html
// (índice de atrito marcado "parcial"). Fase 2 candidata a mudar isso.
const ATRITO_PESO_ERRO_INTERNO = 3;
const ATRITO_PESO_EXTERNO = 2;
const ATRITO_PESO_LEVE = 1;

const ATRITO_WEIGHTS: Record<string, number> = {
  ...Object.fromEntries(CAUSA_RAIZ_ERRO_INTERNO.map((c) => [c, ATRITO_PESO_ERRO_INTERNO])),
  avaria_transporte: ATRITO_PESO_EXTERNO,
  defeito_fabricacao: ATRITO_PESO_EXTERNO,
  solicitacao_cliente: ATRITO_PESO_LEVE,
  outro: ATRITO_PESO_LEVE,
};

// >= 3 = 1 erro interno sozinho já basta, ou 2+ eventos externos, ou 3+
// leves -- limiar simples e ajustável (mesmo espírito do RATIO_NA_JANELA
// acima).
const ATRITO_ALTO_LIMIAR = 3;

async function buildAtritoPorCliente(): Promise<Map<string, number>> {
  const admin = getSupabaseAdmin();
  // 575 chamados no total hoje (07/09/2026) -- cabe numa página só, sem
  // precisar de fetchAllPagesParallel. Se a base crescer muito além de
  // 1000, isso precisa da mesma paginação usada acima.
  const { data, error } = await admin
    .from("service_requests")
    .select("client_protheus_code, causa_raiz")
    .not("client_protheus_code", "is", null)
    .in("type", DELIVERY_REQUEST_TYPES as unknown as string[]);
  if (error) throw new Error(error.message);

  const score = new Map<string, number>();
  for (const r of (data ?? []) as { client_protheus_code: string; causa_raiz: string | null }[]) {
    if (!r.causa_raiz) continue;
    const peso = ATRITO_WEIGHTS[r.causa_raiz] ?? ATRITO_PESO_LEVE;
    score.set(r.client_protheus_code, (score.get(r.client_protheus_code) ?? 0) + peso);
  }
  return score;
}

// -----------------------------------------------------------------------
// Segmentação de ação -- ver matriz em motor-de-recompra.html
// -----------------------------------------------------------------------

export const RECOMPRA_SEGMENTOS = ["contato_direto", "reparar_antes", "nutrir", "nao_e_lead"] as const;
export type RecompraSegmento = (typeof RECOMPRA_SEGMENTOS)[number];

export function isRecompraSegmento(value: string | undefined | null): value is RecompraSegmento {
  return !!value && (RECOMPRA_SEGMENTOS as readonly string[]).includes(value);
}

export const RECOMPRA_SEGMENTO_LABELS: Record<RecompraSegmento, string> = {
  contato_direto: "Contato comercial direto",
  reparar_antes: "Reparar antes de vender",
  nutrir: "Nutrir / cross-sell leve",
  nao_e_lead: "Não é lead agora",
};

export const RECOMPRA_SEGMENTO_DESCRICOES: Record<RecompraSegmento, string> = {
  contato_direto: "Na janela de recompra e sem atrito recente -- maior prioridade da lista.",
  reparar_antes: "Na janela de recompra, mas com atrito recente alto -- resolver o pendente antes de oferecer.",
  nutrir: "Ainda fora da janela do produto grande -- oferta de complementares mantém o relacionamento quente.",
  nao_e_lead: "Fora da janela e com atrito em aberto -- não é prioridade comercial agora.",
};

export const RECOMPRA_SEGMENTO_COLORS: Record<RecompraSegmento, string> = {
  contato_direto: "var(--status-good)",
  reparar_antes: "var(--status-warning)",
  nutrir: "var(--series-5)",
  nao_e_lead: "var(--text-muted)",
};

export function calcularSegmento(naJanela: boolean, atritoAlto: boolean): RecompraSegmento {
  if (naJanela && !atritoAlto) return "contato_direto";
  if (naJanela && atritoAlto) return "reparar_antes";
  if (!naJanela && !atritoAlto) return "nutrir";
  return "nao_e_lead";
}

// -----------------------------------------------------------------------
// Candidato final
// -----------------------------------------------------------------------

export type RecompraCandidato = {
  clientId: string;
  nome: string | null;
  cpfCnpj: string | null;
  nivel: ClienteNivel;
  compras: number;
  gastoAcumulado: number;
  ultimaCompra: string | null;
  diasSemComprar: number | null;
  categoriaJanela: string | null;
  diasDesdeCategoria: number | null;
  ratioJanela: number | null;
  atritoScore: number;
  atritoAlto: boolean;
  segmento: RecompraSegmento;
  // Fase 2 -- ver RecompraContato abaixo. null = nunca foi contatado (ou o
  // último contato já teve resultado registrado e um novo ciclo ainda não
  // começou).
  ultimoContato: RecompraContato | null;
};

// Junta RFM/nível (listClientesPorNivel, já existente) + os dois sinais
// novos (janela por categoria, atrito) num candidato só por cliente. Fica
// de fora quem nunca comprou (nivel "sem_compra") -- não tem o que
// recomprar. Ordenado por prioridade de segmento e, dentro dele, por quem
// está mais "vencido" (ratio maior primeiro).
export async function listRecompraCandidatos(): Promise<RecompraCandidato[]> {
  const [niveis, janelaPorCliente, atritoPorCliente, contatoPorCliente] = await Promise.all([
    listClientesPorNivel(),
    buildJanelaPorCliente(),
    buildAtritoPorCliente(),
    listUltimoContatoPorCliente(),
  ]);

  const resultado: RecompraCandidato[] = [];
  for (const c of niveis) {
    if (c.nivel === "sem_compra") continue;
    const janela = janelaPorCliente.get(c.clientId) ?? null;
    const atritoScore = atritoPorCliente.get(c.clientId) ?? 0;
    const atritoAlto = atritoScore >= ATRITO_ALTO_LIMIAR;
    const naJanela = (janela?.ratio ?? 0) >= RATIO_NA_JANELA;

    resultado.push({
      clientId: c.clientId,
      nome: c.nome,
      cpfCnpj: c.cpfCnpj,
      nivel: c.nivel,
      compras: c.compras,
      gastoAcumulado: c.gastoAcumulado,
      ultimaCompra: c.ultimaCompra,
      diasSemComprar: c.diasSemComprar,
      categoriaJanela: janela?.categoria.label ?? null,
      diasDesdeCategoria: janela?.diasDesde ?? null,
      ratioJanela: janela?.ratio ?? null,
      atritoScore,
      atritoAlto,
      segmento: calcularSegmento(naJanela, atritoAlto),
      ultimoContato: contatoPorCliente.get(c.clientId) ?? null,
    });
  }

  const ordemSegmento: Record<RecompraSegmento, number> = { contato_direto: 0, reparar_antes: 1, nutrir: 2, nao_e_lead: 3 };
  resultado.sort((a, b) => {
    if (ordemSegmento[a.segmento] !== ordemSegmento[b.segmento]) return ordemSegmento[a.segmento] - ordemSegmento[b.segmento];
    return (b.ratioJanela ?? 0) - (a.ratioJanela ?? 0);
  });
  return resultado;
}

// -----------------------------------------------------------------------
// Fase 2 -- registro de contato/resultado (fecha o elo de feedback que o
// desenho original apontou como a peça que falta, ver motor-de-recompra.
// html: "hoje esse elo não existe -- sem ele, o modelo nunca aprende
// sozinho se uma abordagem funcionou"). Ver migration 0108_recompra_
// contatos.sql. "Quem contatou" é texto livre -- o login do painel de
// KPIs é senha única compartilhada do time (dashboardSession.ts), sem
// usuário individual, não tem como capturar isso sozinho.
// -----------------------------------------------------------------------

export const RECOMPRA_RESULTADOS = ["vendeu", "nao_vendeu"] as const;
export type RecompraResultado = (typeof RECOMPRA_RESULTADOS)[number];

export const RECOMPRA_RESULTADO_LABELS: Record<RecompraResultado, string> = {
  vendeu: "Virou venda",
  nao_vendeu: "Não virou",
};

export type RecompraContato = {
  id: string;
  clientId: string;
  segmento: string;
  contatadoPor: string | null;
  contatadoEm: string;
  resultado: RecompraResultado | null;
  resultadoEm: string | null;
  nota: string | null;
};

type RecompraContatoRow = {
  id: string;
  client_id: string;
  segmento: string;
  contatado_por: string | null;
  contatado_em: string;
  resultado: string | null;
  resultado_em: string | null;
  nota: string | null;
};

function rowToContato(r: RecompraContatoRow): RecompraContato {
  return {
    id: r.id,
    clientId: r.client_id,
    segmento: r.segmento,
    contatadoPor: r.contatado_por,
    contatadoEm: r.contatado_em,
    resultado: r.resultado === "vendeu" || r.resultado === "nao_vendeu" ? r.resultado : null,
    resultadoEm: r.resultado_em,
    nota: r.nota,
  };
}

// Último contato de cada cliente (o mais recente por contatado_em) --
// clientes com vários ciclos de contato ao longo do tempo só mostram o
// mais novo na lista principal (ver ClienteHistoricoRow-like uso na
// tela, que já resolve "ver mais" clicando no nome pro histórico de
// compra -- contato segue o mesmo espírito, sem precisar de tela própria
// pra isso agora).
async function listUltimoContatoPorCliente(): Promise<Map<string, RecompraContato>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("recompra_contatos")
    .select("id, client_id, segmento, contatado_por, contatado_em, resultado, resultado_em, nota")
    .order("contatado_em", { ascending: false });
  if (error) throw new Error(error.message);

  const porCliente = new Map<string, RecompraContato>();
  for (const r of (data ?? []) as RecompraContatoRow[]) {
    // Já ordenado por contatado_em desc -- a primeira linha vista por
    // client_id já é a mais recente, ignora as seguintes.
    if (porCliente.has(r.client_id)) continue;
    porCliente.set(r.client_id, rowToContato(r));
  }
  return porCliente;
}

export async function registrarContato(clientId: string, segmento: string, contatadoPor: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("recompra_contatos").insert({
    client_id: clientId,
    segmento,
    contatado_por: contatadoPor.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function registrarResultadoContato(contatoId: string, resultado: RecompraResultado): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("recompra_contatos")
    .update({ resultado, resultado_em: new Date().toISOString() })
    .eq("id", contatoId);
  if (error) throw new Error(error.message);
}
