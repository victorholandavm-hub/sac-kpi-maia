import Anthropic from "@anthropic-ai/sdk";
import { fetchGhlMessages, type GhlMessage } from "./ghlClient";
import { CATEGORY_LABELS, STORE_LABELS } from "./labels";

// claude-opus-5 por padrão (modelo mais capaz -- convenção do time). Pra um
// job de classificação rodando em lote sobre milhares de chamados, custo
// pode importar mais que capacidade máxima -- dá pra trocar sem mexer em
// código setando AI_CLASSIFICATION_MODEL=claude-haiku-4-5 no .env.local.
const MODEL = process.env.AI_CLASSIFICATION_MODEL || "claude-opus-5";

// Cliente instanciado sob demanda (não no import) -- em build/lint essa rota
// nem sempre tem ANTHROPIC_API_KEY no ambiente, e o SDK só reclama disso na
// primeira chamada de verdade.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export type AiClassification = {
  category: string;
  product: string | null;
  storeTag: string | null;
  confidence: "alta" | "media" | "baixa";
};

const CATEGORY_TAGS = Object.keys(CATEGORY_LABELS);
const VALID_STORE_TAGS = new Set(Object.keys(STORE_LABELS).map((n) => `loja-${n}`));

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: CATEGORY_TAGS,
      description: "Tag da categoria que melhor descreve o problema real do cliente.",
    },
    product: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Nome/descrição do produto mencionado pelo cliente (ex.: 'colchão casal', 'sofá retrátil'), ou null se não der pra identificar.",
    },
    storeTag: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: 'Tag da loja no formato "loja-<numero>" se ficar claro qual filial está envolvida, ou null.',
    },
    confidence: {
      type: "string",
      enum: ["alta", "media", "baixa"],
      description: "Confiança na classificação acima.",
    },
  },
  required: ["category", "product", "storeTag", "confidence"],
  additionalProperties: false,
} as const;

// Limite de caracteres no transcript -- conversa gigante (cliente enviando
// várias fotos/áudios com legendas longas) não precisa inteira pra
// classificar; corta e segue com o que tem.
const MAX_TRANSCRIPT_CHARS = 6000;

function buildTranscript(messages: GhlMessage[]): string {
  return messages
    .filter((m) => (m.body ?? "").trim().length > 0)
    .slice(0, 60)
    .map((m) => `${m.direction === "inbound" ? "Cliente" : "Atendimento"}: ${(m.body ?? "").trim()}`)
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
}

const CATEGORY_LIST_TEXT = Object.entries(CATEGORY_LABELS)
  .map(([tag, label]) => `- ${tag}: ${label}`)
  .join("\n");

const SYSTEM_PROMPT = `Você classifica chamados de SAC de uma rede de lojas de móveis e colchões (Lojas Maia).
Leia a conversa entre cliente e atendimento e responda com a categoria mais específica que existir na lista abaixo -- "cat-duvida" é o último recurso, só use quando a conversa for genuinamente uma dúvida sem um problema concreto por trás.

Categorias disponíveis:
${CATEGORY_LIST_TEXT}

Também extraia, se estiverem claros no texto:
- o produto envolvido (nome/descrição em linguagem natural, não precisa ser SKU)
- a loja envolvida, no formato "loja-<numero>" -- só se o número ou nome da filial aparecer claramente

Se a conversa não tiver informação suficiente pra alguma coisa, retorne null pra ela em vez de chutar.`;

// Classificação por conversa, não por chamado -- o mesmo `ghl_conversation_id`
// cobre categoria/produto/loja de uma vez, então uma chamada de IA resolve
// os três campos. Retorna null quando não dá pra classificar (sem
// mensagens, recusa do modelo, resposta fora do formato) -- quem chama trata
// isso como "não mexe no que já tinha".
export async function classifyConversation(ghlConversationId: string): Promise<AiClassification | null> {
  const messages = await fetchGhlMessages(ghlConversationId);
  if (!messages || messages.length === 0) return null;

  const transcript = buildTranscript(messages);
  if (!transcript) return null;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    // Tarefa de classificação curta e determinística -- sem raciocínio
    // estendido (thinking ligado por padrão no Opus 5 dividiria o
    // max_tokens entre pensar e responder, arriscando truncar o JSON) e
    // effort baixo (mais rápido/barato, o suficiente pra esse tipo de
    // tarefa; thinking desabilitado só é aceito em effort "high" ou menor).
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: transcript }],
  });

  if (response.stop_reason === "refusal") return null;

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) return null;

  try {
    const parsed = JSON.parse(textBlock.text) as AiClassification;
    if (!CATEGORY_TAGS.includes(parsed.category)) return null;
    if (parsed.storeTag && !VALID_STORE_TAGS.has(parsed.storeTag)) {
      parsed.storeTag = null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const AI_CLASSIFICATION_MODEL = MODEL;
