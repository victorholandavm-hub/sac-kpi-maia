import { fetchGhlMessages, type GhlMessage } from "./ghlClient";
import { CATEGORY_LABELS, STORE_LABELS } from "./labels";

// Sem chamada de IA -- classificação por palavras-chave, roda 100% local e
// sem custo de API. A ideia original usava a Claude API pra ler a conversa
// e classificar, mas a conta não tinha orçamento pra API paga; isso aqui é
// o substituto sem custo (bem mais burro -- não entende contexto, só casa
// padrão de texto -- mas já tira uma fração real dos chamados de "Dúvida"
// genérica sem gastar nada). Nome das colunas no banco (ai_category etc.)
// e da rota (/api/sync-ai-classify) ficaram como estavam pra não pedir mais
// uma migration -- "ai" aqui hoje só significa "preenchido automaticamente".
export const CLASSIFICATION_METHOD = "heuristic-keywords-v1";

export type TicketClassification = {
  category: string | null;
  product: string | null;
  storeTag: string | null;
  confidence: "alta" | "media" | "baixa";
};

// Menção ao entregador/motorista/transportadora, reaproveitada pelos 4
// sub-motivos abaixo (cada um exige ESSA menção E uma das palavras-chave
// específicas dele, via lookahead -- as duas podem estar em qualquer ordem/
// mensagem da conversa, não precisam estar juntas na mesma frase). Uma
// regex POR palavra-chave (não uma só combinada) -- de propósito, pra
// "hits" (pickCategory conta quantos padrões da regra batem) ficar do
// mesmo tamanho da regra genérica equivalente (ex.: cat-atraso tem 4
// padrões abaixo; cat-entregador-atraso precisa ter os mesmos 4, senão
// perde a categoria genérica em contagem quando 2+ frases da MESMA regra
// batem no mesmo texto).
const ENTREGADOR_MENTION = "(?:entregador|motorista|transportadora)";
function entregadorSubRules(keywordPatterns: string[]): RegExp[] {
  return keywordPatterns.map((kw) => new RegExp(`(?=[\\s\\S]*${ENTREGADOR_MENTION})(?=[\\s\\S]*(?:${kw}))`, "i"));
}

// Ordem importa: em caso de empate na contagem de acertos, a primeira da
// lista vence -- categorias mais específicas ficam antes das mais genéricas/
// ambíguas. Os 4 sub-motivos de "problema com entregador" (pedido do Victor
// 19/09/2026: "esse problema com entregador fica muito amplo") ficam antes
// do catch-all "cat-entregador" -- ele passa a pegar só o que sobra (menção
// ao entregador sem nenhuma das 4 palavras-chave mais específicas batendo).
// Mesmas palavras-chave já usadas em cat-atraso/cat-avaria/cat-entregaerrada
// mais abaixo (que continuam existindo, pra reclamações que NÃO mencionam
// entregador) -- "cat-entregador-educacao" é a única categoria nova de
// verdade (mau atendimento/grosseria não tinha cobertura nenhuma antes).
const CATEGORY_RULES: { tag: string; patterns: RegExp[] }[] = [
  {
    tag: "cat-entregador-atraso",
    patterns: entregadorSubRules(["atras", "n[aã]o chegou", "ainda n[aã]o (recebi|chegou)", "prazo (vencid|estourad)"]),
  },
  {
    tag: "cat-entregador-avaria",
    patterns: entregadorSubRules(["avari", "quebrad", "quebrou", "riscad", "manchad", "defeito", "danificad"]),
  },
  {
    tag: "cat-entregador-enderecoerrado",
    patterns: entregadorSubRules(["endere[cç]o errado", "entregou no (lugar|endere[cç]o) errado", "entrega errada"]),
  },
  {
    tag: "cat-entregador-educacao",
    patterns: entregadorSubRules([
      "mal[ -]educad",
      "deseducad",
      "grosseir",
      "falta de respeito",
      "desrespeit",
      "p[ée]ssimo atendimento",
      "atendimento (ruim|p[ée]ssimo)",
      "agressiv",
    ]),
  },
  { tag: "cat-entregador", patterns: [/entregador/i, /motorista/i, /transportadora/i] },
  { tag: "cat-erroloja", patterns: [/erro da loja/i, /a loja errou/i, /funcionári[ao] da loja/i] },
  { tag: "cat-errocd", patterns: [/centro de distribui[cç][aã]o/i, /saiu errado do cd\b/i, /\bcd\b errou/i] },
  { tag: "cat-erroconferencia", patterns: [/confer[eê]ncia/i, /n[aã]o conferiram/i, /erro de confer[eê]ncia/i] },
  { tag: "cat-errovendedor", patterns: [/vendedor/i, /vendedora/i, /combinad[oa] com o vendedor/i] },
  { tag: "cat-entregaerrada", patterns: [/endere[cç]o errado/i, /entregou no (lugar|endere[cç]o) errado/i, /entrega errada/i] },
  { tag: "cat-pecafaltante", patterns: [/pe[cç]a falt/i, /faltou (uma )?pe[cç]a/i, /sem (o )?parafuso/i, /veio sem (a |o )?/i] },
  { tag: "cat-trocamedida", patterns: [/medida errada/i, /tamanho errado/i, /n[aã]o coube/i] },
  { tag: "cat-produtoerrado", patterns: [/produto errado/i, /veio errado/i, /cor errada/i, /modelo errado/i, /n[aã]o [ée] o que (comprei|pedi)/i] },
  { tag: "cat-avaria", patterns: [/avari/i, /quebrad/i, /quebrou/i, /riscad/i, /manchad/i, /defeito/i, /danificad/i] },
  { tag: "cat-atraso", patterns: [/atras/i, /n[aã]o chegou/i, /ainda n[aã]o (recebi|chegou)/i, /prazo (vencid|estourad)/i] },
  { tag: "cat-trocaproduto", patterns: [/quero trocar/i, /troca (do|de) produto/i, /n[aã]o gostei/i] },
  { tag: "cat-montagem", patterns: [/montagem/i, /montador/i, /n[aã]o montou/i, /montaram errado/i] },
  { tag: "cat-conserto", patterns: [/conserto/i, /reparo/i, /resolver o defeito/i] },
  { tag: "cat-assistencia", patterns: [/assist[eê]ncia t[ée]cnica/i, /t[ée]cnico/i] },
  { tag: "cat-garantia", patterns: [/garantia/i] },
  { tag: "cat-vendasemestoque", patterns: [/sem estoque/i, /n[aã]o tem em estoque/i, /vendeu sem ter/i] },
  { tag: "cat-cobranca", patterns: [/cobran[cç]a/i, /parcela/i, /boleto/i, /nota fiscal/i, /cart[aã]o (foi )?cobrado/i, /pagamento/i] },
  { tag: "cat-demora", patterns: [/demorou pra responder/i, /demora no atendimento/i, /sem retorno/i, /n[aã]o retornaram/i] },
  { tag: "cat-informacaoincorreta", patterns: [/informa[cç][aã]o errada/i, /me informaram errado/i, /fui informad[oa] errado/i] },
];

// Sanity check em dev -- toda tag usada acima precisa existir na taxonomia
// de labels.ts, senão vira uma categoria sem tradução legível na tela.
if (process.env.NODE_ENV !== "production") {
  for (const rule of CATEGORY_RULES) {
    if (!(rule.tag in CATEGORY_LABELS)) {
      throw new Error(`CATEGORY_RULES referencia tag "${rule.tag}" que não existe em CATEGORY_LABELS`);
    }
  }
}

// Tipos de produto genéricos do catálogo (móveis/colchões) -- não é uma
// extração de SKU, é só "do que o cliente tá falando" em linguagem natural.
const PRODUCT_KEYWORDS = [
  "colchão",
  "sofá-cama",
  "sofá",
  "cama box",
  "guarda-roupa",
  "roupeiro",
  "escrivaninha",
  "criado-mudo",
  "beliche",
  "poltrona",
  "cadeira",
  "cômoda",
  "estante",
  "travesseiro",
  "armário",
  "painel",
  "rack",
  "mesa",
];

// Termo real usado no dia a dia por quem atende, pras filiais cuja última
// palavra do rótulo não serve de discriminador sozinha -- achado 17/09/2026
// (Victor: "por que só 6% tem a loja? Maia shopping é loja 212, Maia CD é
// 213"). "212": "Maia Shopping M" tem "M" como última palavra -- curto
// demais, batia em quase qualquer texto (bug já pego pelos testes antes,
// ver comentário abaixo); "213": "Maia CD" tem "CD" com só 2 letras, também
// barrado pelo tamanho mínimo. Nenhum dos dois sufixos crus dá pra usar,
// mas "Shopping"/"CD" são exatamente como cliente/atendente se referem a
// essas lojas na prática.
const STORE_KEYWORD_OVERRIDES: Record<string, string> = {
  "212": "shopping",
  "213": "cd",
};

// Discriminador único por loja -- só a parte do nome que não se repete em
// outra filial. Tenta a ÚLTIMA palavra primeiro (ex.: "Bayeux"); quando ela
// se repete em mais de uma filial (ex.: "Mangabeira" em 3 lojas diferentes),
// tenta as 2 últimas palavras -- "1 Mangabeira"/"2 Mangabeira"/
// "3 Mangabeira" já são únicas cada uma, mesmo a palavra final sozinha não
// sendo (achado 17/09/2026, mesmo motivo do override acima: essas 3 lojas
// nunca apareciam em "Chamados por loja"). "Mangabeira" pura (sem número)
// continua ambígua de propósito -- ver teste "não identifica loja com nome
// ambíguo". Com fronteira de palavra (\b) e tamanho mínimo -- sem isso,
// "212": "Maia Shopping M" viraria discriminador "M" sozinho, que bate em
// quase qualquer texto (bug pego pelos testes: toda mensagem virava
// "loja-212") -- por isso "M"/"CD" crus ficam de fora e usam o override
// acima em vez do sufixo automático.
const STORE_DISCRIMINATORS: { discriminator: RegExp; number: string }[] = (() => {
  function suffix(label: string, wordCount: number): string {
    return label.trim().split(/\s+/).slice(-wordCount).join(" ");
  }
  const allLabels = Object.values(STORE_LABELS);
  const entries = Object.entries(STORE_LABELS).map(([number, label]) => {
    const override = STORE_KEYWORD_OVERRIDES[number];
    if (override) return { number, keyword: override };
    for (const wordCount of [1, 2]) {
      const candidate = suffix(label, wordCount);
      const collisions = allLabels.filter((l) => suffix(l, wordCount) === candidate).length;
      if (collisions === 1 && candidate.length >= 3) return { number, keyword: candidate };
    }
    return { number, keyword: null };
  });
  return entries
    .filter((e): e is { number: string; keyword: string } => e.keyword !== null)
    .map((e) => ({
      discriminator: new RegExp(`\\b${e.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      number: e.number,
    }));
})();

// Limite de caracteres no transcript -- conversa gigante não precisa inteira
// pra casar palavra-chave; corta e segue com o que tem.
const MAX_TRANSCRIPT_CHARS = 6000;

function buildTranscript(messages: GhlMessage[]): string {
  return messages
    .filter((m) => (m.body ?? "").trim().length > 0)
    .slice(0, 60)
    .map((m) => (m.body ?? "").trim())
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
}

export function pickCategory(transcript: string): { category: string; confidence: "alta" | "media" } | null {
  let best: { tag: string; hits: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    const hits = rule.patterns.filter((p) => p.test(transcript)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { tag: rule.tag, hits };
    }
  }
  if (!best) return null;
  return { category: best.tag, confidence: best.hits >= 2 ? "alta" : "media" };
}

export function pickProduct(transcript: string): string | null {
  const lower = transcript.toLowerCase();
  let best: { keyword: string; count: number } | null = null;
  for (const keyword of PRODUCT_KEYWORDS) {
    const count = lower.split(keyword).length - 1;
    if (count > 0 && (!best || count > best.count)) {
      best = { keyword, count };
    }
  }
  if (!best) return null;
  return best.keyword.charAt(0).toUpperCase() + best.keyword.slice(1);
}

export function pickStore(transcript: string): string | null {
  const matches = STORE_DISCRIMINATORS.filter((d) => d.discriminator.test(transcript));
  // Mais de uma filial diferente mencionada = ambíguo (cliente pode ter
  // citado outra loja de passagem), melhor não arriscar.
  const distinctNumbers = new Set(matches.map((m) => m.number));
  if (distinctNumbers.size !== 1) return null;
  return `loja-${matches[0].number}`;
}

// Categoria, produto e loja são independentes entre si -- a conversa pode
// não bater em nenhuma palavra-chave de categoria e ainda assim mencionar
// um produto claramente (ex.: "só queria saber se a cadeira tem garantia").
// Antes, um `pickCategory` sem match descartava a classificação inteira e
// derrubava junto o produto/loja que tinham sido encontrados -- por isso
// "Chamados por produto" ficava praticamente zerado (pedido do Victor
// 16/08/2026). Só retorna null quando NENHUM dos três achou nada.
export function classifyTranscript(transcript: string): TicketClassification | null {
  const categoryResult = pickCategory(transcript);
  const product = pickProduct(transcript);
  const storeTag = pickStore(transcript);
  if (!categoryResult && !product && !storeTag) return null;

  return {
    category: categoryResult?.category ?? null,
    product,
    storeTag,
    // Sem categoria batida, "media" é a mesma confiança de 1 keyword só
    // batendo em pickCategory -- não é uma alta confiança inventada.
    confidence: categoryResult?.confidence ?? "media",
  };
}

// Classificação por conversa -- o mesmo `ghl_conversation_id` cobre
// categoria/produto/loja de uma vez. Retorna null quando não há mensagens
// com texto suficiente pra tentar (quem chama trata como "não mexe no que
// já tinha").
export async function classifyConversation(ghlConversationId: string): Promise<TicketClassification | null> {
  const messages = await fetchGhlMessages(ghlConversationId);
  if (!messages || messages.length === 0) return null;

  const transcript = buildTranscript(messages);
  if (!transcript) return null;

  return classifyTranscript(transcript);
}
