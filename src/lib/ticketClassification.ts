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
  category: string;
  product: string | null;
  storeTag: string | null;
  confidence: "alta" | "media" | "baixa";
};

// Ordem importa: em caso de empate na contagem de acertos, a primeira da
// lista vence -- categorias mais específicas ficam antes das mais genéricas/
// ambíguas (ex.: "cat-entregador" antes de "cat-atraso", já que uma
// reclamação de entregador quase sempre também menciona atraso).
const CATEGORY_RULES: { tag: string; patterns: RegExp[] }[] = [
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

// Discriminador único por loja -- só a parte do nome que não se repete em
// outra filial (ex.: "Mangabeira" aparece em 3 lojas diferentes, então não
// entra aqui; "Bayeux" só existe numa). Evita loja errada por match ambíguo.
// Com fronteira de palavra (\b) e tamanho mínimo -- sem isso, "212": "Maia
// Shopping M" vira discriminador "M" sozinho, que bate em quase qualquer
// texto (bug pego pelos testes: toda mensagem virava "loja-212").
const STORE_DISCRIMINATORS: { discriminator: RegExp; number: string }[] = (() => {
  const lastWordCount = new Map<string, number>();
  const entries = Object.entries(STORE_LABELS).map(([number, label]) => {
    const lastWord = label.trim().split(/\s+/).pop()!;
    lastWordCount.set(lastWord, (lastWordCount.get(lastWord) ?? 0) + 1);
    return { number, lastWord };
  });
  return entries
    .filter((e) => (lastWordCount.get(e.lastWord) ?? 0) === 1 && e.lastWord.length >= 3)
    .map((e) => ({
      discriminator: new RegExp(`\\b${e.lastWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
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

// Classificação por conversa -- o mesmo `ghl_conversation_id` cobre
// categoria/produto/loja de uma vez. Retorna null quando não há mensagens
// com texto suficiente pra tentar (quem chama trata como "não mexe no que
// já tinha").
export async function classifyConversation(ghlConversationId: string): Promise<TicketClassification | null> {
  const messages = await fetchGhlMessages(ghlConversationId);
  if (!messages || messages.length === 0) return null;

  const transcript = buildTranscript(messages);
  if (!transcript) return null;

  const categoryResult = pickCategory(transcript);
  if (!categoryResult) return null;

  return {
    category: categoryResult.category,
    product: pickProduct(transcript),
    storeTag: pickStore(transcript),
    confidence: categoryResult.confidence,
  };
}
