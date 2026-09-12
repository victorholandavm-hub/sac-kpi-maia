import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";
import { listClientesPorNivel, diasEntre, type ClienteNivel } from "./clientes";
import { DELIVERY_REQUEST_TYPES, CAUSA_RAIZ_ERRO_INTERNO } from "./assistenciaLabels";
import { RESOLVIDO_LABELS } from "./entregasRisco";

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

type CategoriaSinal = { categoria: CategoriaCiclo; dataCompra: string; diasDesde: number; ratio: number; dataReal: boolean };

const ITEM_PAGE_SIZE = 1000;
const CARGA_PAGE_SIZE = 1000;

type OrderItemRow = {
  description: string | null;
  total: number | null;
  totvs_orders: { client_id: string | null; issue_date: string; invoice: string | null; serie: string | null } | null;
};

// Data que o produto de fato chegou na casa do cliente, não a data do
// pedido/nota fiscal -- pedido do Victor 07/09/2026: "implemente" depois
// de achar que totvs_delivery_cargas.nota_fiscal/serie casa com
// totvs_orders.invoice/serie (a chave que motor-de-recompra.html tinha
// marcado como "não achei" -- FILIAL não bate entre as duas tabelas
// (faturamento x venda, achado 07/09/2026), mas invoice+serie sozinho já
// cobre 57% das entregas). Onde não tem entrega confirmada (a maioria,
// ainda), cai pra issue_date do pedido -- ver dataReal em CategoriaSinal,
// que marca qual dos dois foi usado.
//
// Várias tentativas de carga podem existir pro mesmo documento (ver
// `tentativa` em totvs_delivery_cargas) -- só as com status_entrega
// resolvido (RESOLVIDO_LABELS, entregasRisco.ts) contam, e entre elas a
// de dt_retorno mais recente (a tentativa que realmente deu certo).
type CargaRow = { nota_fiscal: string | null; serie: string | null; status_entrega: string | null; dt_retorno: string | null };

// Cache -- pedido do Victor 07/09/2026: reduzir tráfego de egress do
// Supabase (tinha estourado a cota antes, virou custo mensal do plano Pro)
// sem migrar banco nenhum. Essas duas funções varrem totvs_order_items
// (~54 mil linhas) e totvs_delivery_cargas (~36 mil) inteiros -- as mais
// pesadas do Motor de Recompra, e reexecutadas do zero TODA VEZ que
// alguém abre a aba "Propensão a recompra", sem cache nenhum até agora.
// O dado de origem (sync do TOTVS) só muda a cada ~30min de qualquer
// jeito -- 15min de cache não perde nada de fresco na prática e corta
// bastante egress repetido. unstable_cache só aceita retorno
// serializável (JSON) -- por isso as funções cacheadas devolvem objeto
// simples (Record), não Map, com um wrapper fino por fora convertendo
// de volta pra Map (formato que o resto do arquivo já espera, sem
// precisar mudar mais nada).
const DELIVERY_DATE_TAG = "recompra-delivery-date";

async function fetchDeliveryDatePorInvoiceSerie(): Promise<Record<string, string>> {
  const admin = getSupabaseAdmin();
  const rows = await fetchAllPagesParallel<CargaRow>(
    (from, to) =>
      admin
        .from("totvs_delivery_cargas")
        .select("nota_fiscal, serie, status_entrega, dt_retorno", { count: "exact" })
        .not("nota_fiscal", "is", null)
        .not("dt_retorno", "is", null)
        .in("status_entrega", RESOLVIDO_LABELS)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<CargaRow>>,
    { pageSize: CARGA_PAGE_SIZE }
  );

  const resultado: Record<string, string> = {};
  for (const r of rows) {
    if (!r.nota_fiscal || !r.serie || !r.dt_retorno) continue;
    const key = `${r.nota_fiscal}|${r.serie}`;
    const atual = resultado[key];
    if (!atual || r.dt_retorno > atual) resultado[key] = r.dt_retorno;
  }
  return resultado;
}

const cachedDeliveryDatePorInvoiceSerie = unstable_cache(fetchDeliveryDatePorInvoiceSerie, ["recompra-delivery-date"], {
  revalidate: 900,
  tags: [DELIVERY_DATE_TAG],
});

// Varre totvs_order_items inteiro (join com totvs_orders pra pegar
// client_id/issue_date/invoice/serie, mesmo padrão já usado em
// vendasProduto.ts) -- pra cada cliente, guarda a compra MAIS RECENTE de
// cada categoria, usando a data de entrega real quando existe
// (fetchDeliveryDatePorInvoiceSerie, já cacheada, ver acima) ou a data do
// pedido como aproximação. ~54 mil dos ~81 mil itens batem nalguma
// categoria cíclica (conferido 07/09/2026) -- não filtra por
// palavra-chave na query (a lista de keywords muda fácil demais pra
// depender de um OR gigante no banco), filtra em memória depois de
// trazer tudo, igual listClientesPorNivel já faz com o pedido inteiro.
//
// Extraída como função própria (07/09/2026, Fase 3 -- afinidade de
// produto) porque tanto buildJanelaPorCliente quanto
// buildAfinidadeGlobal precisam do MESMO conjunto de categorias por
// cliente -- separar evita escanear totvs_order_items (a parte cara,
// ~54 mil linhas) duas vezes.
const CATEGORIAS_POR_CLIENTE_TAG = "recompra-categorias-por-cliente";

// `valorTotal`/`qtdCompras` entraram 12/09/2026 pro CLV preditivo (Fase 4,
// ver buildClvProjetadoPorCliente abaixo) -- acumulam TODA compra que bate
// na categoria (não só a mais recente); `data`/`dataReal` continuam
// rastreando só a última, como já era antes (janela de recompra não muda).
type CategoriaAcumulada = { data: string; dataReal: boolean; valorTotal: number; qtdCompras: number };

async function fetchCategoriasPorCliente(): Promise<Record<string, Record<string, CategoriaAcumulada>>> {
  const deliveryDatePorInvoiceSerie = await cachedDeliveryDatePorInvoiceSerie();
  const admin = getSupabaseAdmin();
  const rows = await fetchAllPagesParallel<OrderItemRow>(
    (from, to) =>
      admin
        .from("totvs_order_items")
        .select("description, total, totvs_orders!inner(client_id, issue_date, type, invoice, serie)", { count: "exact" })
        .eq("totvs_orders.type", "Venda")
        .not("totvs_orders.client_id", "is", null)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<OrderItemRow>>,
    { pageSize: ITEM_PAGE_SIZE }
  );

  // client_id -> categoria key -> acumulado (data mais recente + valor/qtd
  // total dessa categoria pra esse cliente).
  const acumuladoPorCategoria: Record<string, Record<string, CategoriaAcumulada>> = {};
  for (const r of rows) {
    const order = r.totvs_orders;
    if (!order?.client_id) continue;
    const categoria = inferCategoriaCiclo(r.description);
    if (!categoria) continue;
    const dataEntrega = order.invoice && order.serie ? deliveryDatePorInvoiceSerie[`${order.invoice}|${order.serie}`] : undefined;
    const data = dataEntrega ?? order.issue_date;
    const dataReal = dataEntrega !== undefined;
    const porCategoria = acumuladoPorCategoria[order.client_id] ?? {};
    const atual = porCategoria[categoria.key] ?? { data, dataReal, valorTotal: 0, qtdCompras: 0 };
    const usaComoUltima = data > atual.data;
    porCategoria[categoria.key] = {
      data: usaComoUltima ? data : atual.data,
      dataReal: usaComoUltima ? dataReal : atual.dataReal,
      valorTotal: atual.valorTotal + (r.total ?? 0),
      qtdCompras: atual.qtdCompras + 1,
    };
    acumuladoPorCategoria[order.client_id] = porCategoria;
  }
  return acumuladoPorCategoria;
}

const cachedCategoriasPorCliente = unstable_cache(fetchCategoriasPorCliente, ["recompra-categorias-por-cliente"], {
  revalidate: 900,
  tags: [CATEGORIAS_POR_CLIENTE_TAG],
});

async function buildCategoriasPorCliente(): Promise<Map<string, Map<string, CategoriaAcumulada>>> {
  const obj = await cachedCategoriasPorCliente();
  const resultado = new Map<string, Map<string, CategoriaAcumulada>>();
  for (const [clientId, porCategoria] of Object.entries(obj)) {
    resultado.set(clientId, new Map(Object.entries(porCategoria)));
  }
  return resultado;
}

// Reduz o mapa de categorias por cliente (acima) pra um sinal só por
// cliente -- a categoria com MAIOR ratio (a mais "vencida") é o sinal de
// janela daquele cliente.
function buildJanelaPorCliente(categoriasPorCliente: Map<string, Map<string, CategoriaAcumulada>>): Map<string, CategoriaSinal> {
  const hoje = new Date();
  const resultado = new Map<string, CategoriaSinal>();
  for (const [clientId, porCategoria] of categoriasPorCliente) {
    let melhor: CategoriaSinal | null = null;
    for (const [key, { data: dataCompra, dataReal }] of porCategoria) {
      const categoria = CATEGORIAS_CICLO.find((c) => c.key === key);
      if (!categoria) continue;
      const diasDesde = diasEntre(dataCompra, hoje);
      const ratio = diasDesde / (categoria.cicloMeses * 30);
      if (!melhor || ratio > melhor.ratio) melhor = { categoria, dataCompra, diasDesde, ratio, dataReal };
    }
    if (melhor) resultado.set(clientId, melhor);
  }
  return resultado;
}

// -----------------------------------------------------------------------
// Afinidade de produto (cross-sell) -- Fase 3 do desenho original, pedido
// do Victor 07/09/2026: "só a afinidade de produto... não depende do
// backfill terminar nem do tempo passar". Associação simples entre
// categorias (não precisa de Apriori/biblioteca de verdade -- só 7
// categorias cadastradas, ver CATEGORIAS_CICLO, então o par completo é
// só 21 combinações, trivial de calcular na mão): pra cada categoria A,
// entre quem já comprou A, qual OUTRA categoria B esse mesmo grupo mais
// comprou também (P(B|A) = clientes com A e B ÷ clientes com A).
// -----------------------------------------------------------------------

type AfinidadeCategoria = { categoria: CategoriaCiclo; score: number };

function buildAfinidadeGlobal(categoriasPorCliente: Map<string, Map<string, CategoriaAcumulada>>): Map<string, AfinidadeCategoria[]> {
  const countCategoria = new Map<string, number>();
  const countPar = new Map<string, number>();

  for (const categorias of categoriasPorCliente.values()) {
    const keys = [...categorias.keys()];
    for (const k of keys) countCategoria.set(k, (countCategoria.get(k) ?? 0) + 1);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const [a, b] = [keys[i], keys[j]].sort();
        const pairKey = `${a}|${b}`;
        countPar.set(pairKey, (countPar.get(pairKey) ?? 0) + 1);
      }
    }
  }

  const resultado = new Map<string, AfinidadeCategoria[]>();
  for (const catA of CATEGORIAS_CICLO) {
    const totalA = countCategoria.get(catA.key) ?? 0;
    if (totalA === 0) continue;
    const associadas: AfinidadeCategoria[] = [];
    for (const catB of CATEGORIAS_CICLO) {
      if (catB.key === catA.key) continue;
      const [a, b] = [catA.key, catB.key].sort();
      const countBoth = countPar.get(`${a}|${b}`) ?? 0;
      if (countBoth === 0) continue;
      associadas.push({ categoria: catB, score: countBoth / totalA });
    }
    associadas.sort((x, y) => y.score - x.score);
    resultado.set(catA.key, associadas);
  }
  return resultado;
}

// Pra um cliente, olha as categorias que ele JÁ TEM e, pra cada uma,
// pega a mais associada (buildAfinidadeGlobal, já ordenada por score)
// que ele AINDA NÃO tem -- entre todas essas candidatas, devolve a de
// maior score. null quando o cliente não tem nenhuma categoria cíclica
// reconhecida ainda, ou quando já comprou de tudo que existe associação.
export function sugerirCrossSell(categoriasCliente: Set<string>, afinidadeGlobal: Map<string, AfinidadeCategoria[]>): CategoriaCiclo | null {
  let melhor: AfinidadeCategoria | null = null;
  for (const catKey of categoriasCliente) {
    const associadas = afinidadeGlobal.get(catKey) ?? [];
    const candidata = associadas.find((a) => !categoriasCliente.has(a.categoria.key));
    if (candidata && (!melhor || candidata.score > melhor.score)) melhor = candidata;
  }
  return melhor?.categoria ?? null;
}

// -----------------------------------------------------------------------
// CLV preditivo -- Fase 4 do desenho original, pedido do Victor
// 07/09/2026 ("desenho completo... quero implementar tudo que as grandes
// redes fazem"), deliberadamente adiada na hora ("melhor esperar o
// backfill avançar bastante antes de tentar" -- só 7 meses de histórico
// dava um ritmo de gasto instável). Retomada 12/09/2026, backfill 100%
// completo (2021-04 até hoje).
//
// NÃO é "gasto acumulado ÷ anos de relacionamento × horizonte" (o jeito
// ingênuo de CLV) -- isso reintroduz o mesmo erro de RFM genérico que
// esse motor inteiro existe pra evitar (ver "Ciclo de reposição, não
// recência genérica" no topo do arquivo). Um cliente que gastou R$15.000
// numa casa inteira há 3 anos e nada mais não vai gastar R$5.000/ano pra
// sempre -- ele volta quando CADA categoria específica vencer o próprio
// ciclo. Por isso o CLV aqui reaproveita o mesmo modelo de categoriasPorCliente
// já usado pela janela de recompra e pela afinidade de produto acima:
// pra cada categoria que o cliente já comprou, projeta quantos ciclos de
// reposição CABEM no horizonte (ex.: travesseiro, ciclo de 18 meses, cabe
// 60/18=3,3 vezes em 5 anos) × o valor médio que ELE MESMO já gastou
// nessa categoria -- e soma entre todas as categorias que ele tem.
//
// Cliente com só 1 compra numa categoria ainda gera uma projeção válida
// (não precisa de repetição pra ser defensável, ao contrário do jeito
// ingênuo) -- não está extrapolando frequência de uma amostra pequena,
// está aplicando o ciclo de mercado já usado no resto do sistema.
// -----------------------------------------------------------------------

// Horizonte de projeção -- "chutada" de mercado, mesmo espírito de
// cicloMeses em CATEGORIAS_CICLO: isolada aqui de propósito, fácil de
// recalibrar se a experiência real da loja pedir outro número.
export const CLV_HORIZONTE_ANOS = 5;
const CLV_HORIZONTE_MESES = CLV_HORIZONTE_ANOS * 12;

function buildClvProjetadoPorCliente(categoriasPorCliente: Map<string, Map<string, CategoriaAcumulada>>): Map<string, number> {
  const resultado = new Map<string, number>();
  for (const [clientId, porCategoria] of categoriasPorCliente) {
    let total = 0;
    for (const [key, { valorTotal, qtdCompras }] of porCategoria) {
      const categoria = CATEGORIAS_CICLO.find((c) => c.key === key);
      if (!categoria || qtdCompras === 0) continue;
      const valorMedio = valorTotal / qtdCompras;
      const ciclosEsperados = CLV_HORIZONTE_MESES / categoria.cicloMeses;
      total += valorMedio * ciclosEsperados;
    }
    if (total > 0) resultado.set(clientId, total);
  }
  return resultado;
}

// Exportada pra aba "Nível de relacionamento" (page.tsx), que hoje não
// depende de mais nada deste arquivo -- reaproveita a mesma
// categoriasPorCliente já cacheada (cachedCategoriasPorCliente, 15min),
// sem I/O novo. listRecompraCandidatos abaixo (aba "Propensão a
// recompra") já tem categoriasPorCliente em mãos e chama o reducer puro
// direto, sem passar por essa função.
export async function listClvProjetadoPorCliente(): Promise<Map<string, number>> {
  const categoriasPorCliente = await buildCategoriasPorCliente();
  return buildClvProjetadoPorCliente(categoriasPorCliente);
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

// Desconto do CLV projetado (ver CLV preditivo acima) quando o cliente tem
// atrito alto -- cliente insatisfeito tende a não voltar, então o ritmo
// histórico sozinho superestima o valor futuro real. Desconto fixo, sem
// curva de retenção nem fluxo de caixa descontado -- over-engineering pra
// um time sem analista de dados dedicado; mesmo espírito de regra fixa e
// ajustável do resto do motor (ATRITO_ALTO_LIMIAR, RATIO_NA_JANELA).
const CLV_FATOR_RETENCAO_ATRITO_ALTO = 0.5;

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
  // true = diasDesdeCategoria conta a partir da entrega de verdade
  // (totvs_delivery_cargas), não do pedido -- ver buildDeliveryDatePorInvoiceSerie.
  // Hoje só ~57% dos pedidos casam com uma entrega confirmada; o resto
  // continua caindo pra data do pedido (dataReal false), aproximação de
  // sempre.
  categoriaJanelaDataReal: boolean;
  atritoScore: number;
  atritoAlto: boolean;
  segmento: RecompraSegmento;
  // Fase 2 -- ver RecompraContato abaixo. null = nunca foi contatado (ou o
  // último contato já teve resultado registrado e um novo ciclo ainda não
  // começou).
  ultimoContato: RecompraContato | null;
  // Fase 3 -- ver buildAfinidadeGlobal/sugerirCrossSell acima. Categoria
  // (rótulo) mais associada ao que esse cliente já comprou, entre o que
  // ele ainda não tem -- null quando ele não tem categoria cíclica
  // reconhecida nenhuma, ou já comprou todas as associadas.
  sugestaoCrossSell: string | null;
  // Fase 4 -- ver buildClvProjetadoPorCliente acima. null = nenhuma compra
  // numa categoria cíclica reconhecida (sem base pra projetar).
  clvProjetado: number | null;
  // clvProjetado com desconto de CLV_FATOR_RETENCAO_ATRITO_ALTO quando
  // atritoAlto -- o número que de fato importa pra priorizar contato
  // nesta aba (valor esperado, não só o "se tudo continuar igual").
  clvAjustado: number | null;
};

// Junta RFM/nível (listClientesPorNivel, já existente) + os sinais novos
// (janela por categoria, atrito, afinidade de produto) num candidato só
// por cliente. Fica de fora quem nunca comprou (nivel "sem_compra") --
// não tem o que recomprar. Ordenado por prioridade de segmento e, dentro
// dele, por quem está mais "vencido" (ratio maior primeiro).
export async function listRecompraCandidatos(): Promise<RecompraCandidato[]> {
  const [niveis, categoriasPorCliente, atritoPorCliente, contatoPorCliente, naoContatar] = await Promise.all([
    listClientesPorNivel(),
    buildCategoriasPorCliente(),
    buildAtritoPorCliente(),
    listUltimoContatoPorCliente(),
    listClientesNaoContatar(),
  ]);
  // As três próximas são reduções puras em cima de categoriasPorCliente
  // (já em memória) -- não precisam de I/O, não entram no Promise.all.
  const janelaPorCliente = buildJanelaPorCliente(categoriasPorCliente);
  const afinidadeGlobal = buildAfinidadeGlobal(categoriasPorCliente);
  const clvPorCliente = buildClvProjetadoPorCliente(categoriasPorCliente);

  const resultado: RecompraCandidato[] = [];
  for (const c of niveis) {
    if (c.nivel === "sem_compra") continue;
    // Salvaguarda de LGPD (ver migration 0109) -- quem pediu pra não ser
    // mais contatado nunca aparece aqui, ponto final.
    if (naoContatar.has(c.clientId)) continue;
    const janela = janelaPorCliente.get(c.clientId) ?? null;
    const atritoScore = atritoPorCliente.get(c.clientId) ?? 0;
    const atritoAlto = atritoScore >= ATRITO_ALTO_LIMIAR;
    const naJanela = (janela?.ratio ?? 0) >= RATIO_NA_JANELA;
    const categoriasCliente = new Set(categoriasPorCliente.get(c.clientId)?.keys() ?? []);
    const sugestao = sugerirCrossSell(categoriasCliente, afinidadeGlobal);
    const clvProjetado = clvPorCliente.get(c.clientId) ?? null;
    const clvAjustado = clvProjetado !== null ? clvProjetado * (atritoAlto ? CLV_FATOR_RETENCAO_ATRITO_ALTO : 1) : null;

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
      categoriaJanelaDataReal: janela?.dataReal ?? false,
      atritoScore,
      atritoAlto,
      segmento: calcularSegmento(naJanela, atritoAlto),
      ultimoContato: contatoPorCliente.get(c.clientId) ?? null,
      sugestaoCrossSell: sugestao?.label ?? null,
      clvProjetado,
      clvAjustado,
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

// -----------------------------------------------------------------------
// Salvaguarda de LGPD -- ver migration 0109_recompra_nao_contatar.sql e
// comentário em listRecompraCandidatos acima. Base legal escolhida
// (legítimo interesse, cliente que já comprou) exige um jeito de
// opt-out -- essa é a peça que implementa isso: uma vez marcado, o
// cliente nunca mais aparece como candidato a recompra, até ser
// desmarcado de novo.
// -----------------------------------------------------------------------

export type RecompraNaoContatar = {
  clientId: string;
  motivo: string | null;
  criadoPor: string | null;
  criadoEm: string;
};

// Exportada (09/09/2026) pro NPS de 2 meses pós-recebimento (nps2Meses.ts)
// reaproveitar -- mesma lista de opt-out ("legítimo interesse" pede opção
// de não ser mais contatado, ver migration do Motor de Recompra), não faz
// sentido duplicar por fonte de contato proativo diferente.
export async function listClientesNaoContatar(): Promise<Set<string>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("recompra_nao_contatar").select("client_id");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.client_id as string));
}

// Lista completa (com motivo/data) pra tela de gerenciamento -- diferente
// de listClientesNaoContatar acima (só os ids, usado no filtro principal,
// que roda a cada carregamento da aba e não precisa do resto do dado).
export async function listRecompraNaoContatarCompleto(): Promise<RecompraNaoContatar[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("recompra_nao_contatar")
    .select("client_id, motivo, criado_por, criado_em")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    clientId: r.client_id as string,
    motivo: r.motivo as string | null,
    criadoPor: r.criado_por as string | null,
    criadoEm: r.criado_em as string,
  }));
}

export async function marcarNaoContatar(clientId: string, motivo: string, criadoPor: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("recompra_nao_contatar").upsert(
    {
      client_id: clientId,
      motivo: motivo.trim() || null,
      criado_por: criadoPor.trim() || null,
    },
    { onConflict: "client_id" }
  );
  if (error) throw new Error(error.message);
}

export async function desmarcarNaoContatar(clientId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("recompra_nao_contatar").delete().eq("client_id", clientId);
  if (error) throw new Error(error.message);
}
