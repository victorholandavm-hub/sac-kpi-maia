// Popula o conteúdo inicial do "Arsenal do SAC" (base de conhecimento) --
// rodar manualmente uma vez, e de novo sempre que o Victor mandar uma versão
// atualizada do documento Word (Arsenal_SAC_Garantias_CDC_Fabricantes.docx).
// Migrations não carregam dado de negócio/conteúdo, só schema -- ver
// 0046_arsenal_sac.sql.
//
// Uso: node --env-file=.env.local scripts/seed-arsenal.ts
// (usa NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SECRET_KEY, já presentes em
// .env.local -- diferente do totvs-sync.ts, não tem segredo com "$" no
// meio, então não precisa de um .env à parte.)
//
// Idempotente: upsert por slug (categoria+título normalizados, ver
// buildArsenalSlug). Rodar de novo com o array atualizado sobrescreve
// título/corpo/keywords das entradas já existentes e cria só as novas --
// não duplica.
//
// `active` é DELIBERADAMENTE omitido do payload de upsert: se incluíssemos
// `active: true` aqui, reimportar o documento reativaria sem querer uma
// entrada que o Victor tinha desativado manualmente pela UI. Sem o campo no
// payload, o Postgres só usa o default (true) na inserção de linha nova e
// não toca no valor de active em linhas já existentes.

import { getSupabaseAdmin } from "../src/lib/supabaseAdmin.ts";
import { buildArsenalSlug, type ArsenalCategory } from "../src/lib/arsenalSac.ts";

type SeedEntry = {
  category: ArsenalCategory;
  title: string;
  body: string;
  keywords?: string;
};

const ENTRIES: SeedEntry[] = [
  // ---- Contatos internos: quem acionar por assunto -----------------------
  {
    category: "contatos_internos",
    title: "Rotas de entrega e cargas",
    body: "Acionar: Jhon — (83) 8114-1551.",
    keywords: "rota, carga, entrega, jhon, logistica",
  },
  {
    category: "contatos_internos",
    title: "Estoque e produtos",
    body: "Acionar: Flávio / Eduardo — (83) 9655-0689 / (83) 8641-6057.",
    keywords: "estoque, produto, disponibilidade, flavio, eduardo",
  },
  {
    category: "contatos_internos",
    title: "Carregamentos, frota e caminhões",
    body: "Acionar: Seu Edson — (83) 9395-4456.",
    keywords: "carregamento, frota, caminhao, motorista, edson",
  },
  {
    category: "contatos_internos",
    title: "Montagem e assistência técnica",
    body: "Acionar: Seu Antônio / Equipe de assistência — (83) 8780-8928 / (83) 9367-3787.",
    keywords: "montagem, assistencia tecnica, montador, antonio, peca",
  },
  {
    category: "contatos_internos",
    title: "Prazos e encomendas de produtos",
    body: "Acionar: Rafael — (83) 9673-1321.",
    keywords: "prazo, encomenda, previsao de entrega, rafael",
  },
  {
    category: "contatos_internos",
    title: "Fábrica própria — Conceito Estofados (quem acionar)",
    body: "Acionar: João Maia — (83) 9896-0039. Produção interna de sofás/estofados.",
    keywords: "conceito estofados, sofa, joao maia, fabrica propria",
  },
  {
    category: "contatos_internos",
    title: "Fábrica própria — Beds/Aiam Colchões (quem acionar)",
    body: "Acionar: Diba — (83) 8709-9651. Produção interna de colchões.",
    keywords: "beds, aiam, colchao, diba, fabrica propria",
  },
  {
    category: "contatos_internos",
    title: "Fábrica própria — Beds/Aiam Estofados (quem acionar)",
    body: "Contato interno: a preencher. Produção interna de estofados (linha Beds/Aiam).",
    keywords: "beds, aiam, estofado, fabrica propria, a preencher",
  },
  {
    category: "contatos_internos",
    title: "Escalação de casos graves (PROCON, Reclame Aqui, Serasa, risco jurídico)",
    body:
      "Acionar: Victor — contato a preencher. Usar sempre que o cliente ameaçar ou já tiver aberto reclamação em " +
      "PROCON/Reclame Aqui, mencionar Serasa/negativação, ou o caso tiver risco jurídico claro.",
    keywords: "procon, reclame aqui, serasa, negativacao, risco juridico, escalar, vitor, escalação",
  },

  // ---- Contatos internos: gerentes de loja por filial ---------------------
  {
    category: "contatos_internos",
    title: "Gerente Oscar — lojas Bayeux, Santo Elias, Tambaú, Manaíra, Cabedelo, Barão do Triunfo",
    body:
      "Gerente: Oscar — (83) 99671-5223.\n" +
      "Lojas: Maia Bayeux (201) · Líder Santo Elias (203) · Líder Tambaú (204) · Líder Manaíra (215) · " +
      "Maia Cabedelo (210) · Maia Barão do Triunfo (211).",
    keywords: "gerente, oscar, bayeux, santo elias, tambau, manaira, cabedelo, barao do triunfo, filial 201, filial 203, filial 204, filial 215, filial 210, filial 211",
  },
  {
    category: "contatos_internos",
    title: "Gerente Laryssa — lojas Mangabeira, GL, Pluma",
    body:
      "Gerente: Laryssa — (83) 99614-5653.\n" +
      "Lojas: Líder Mangabeira (205) · Maia 2 Mangabeira (206) · Maia 3 Mangabeira (207) · GL (208) · Pluma (209).",
    keywords: "gerente, laryssa, mangabeira, gl, pluma, filial 205, filial 206, filial 207, filial 208, filial 209",
  },
  {
    category: "contatos_internos",
    title: "Gerentes Isabelle e Emerson — Maia Shopping",
    body: "Gerentes: Isabelle e Emerson — (83) 99830-6864 / (83) 99115-7422.\nLoja: Maia Shopping (212).",
    keywords: "gerente, isabelle, emerson, maia shopping, filial 212",
  },
  {
    category: "contatos_internos",
    title: "Gerente Bruna — Maia Mamanguape",
    body: "Gerente: Bruna — (83) 99171-5723.\nLoja: Maia Mamanguape (214).",
    keywords: "gerente, bruna, mamanguape, filial 214",
  },
  {
    category: "contatos_internos",
    title: "Gerente Rafaela — Maia Santa Rita",
    body: "Gerente: Rafaela — (83) 98169-2429.\nLoja: Maia Santa Rita (202).",
    keywords: "gerente, rafaela, santa rita, filial 202",
  },
  {
    category: "contatos_internos",
    title: "Gerente Fabiano — Maia Campina Grande",
    body: "Gerente: Fabiano — (83) 98702-1747.\nLoja: Maia Campina Grande (216).",
    keywords: "gerente, fabiano, campina grande, filial 216",
  },

  // ---- Fornecedores e fabricantes: fábrica própria ------------------------
  {
    category: "fornecedores",
    title: "Conceito Estofados (fábrica própria — sofás)",
    body:
      "Produção interna de sofás/estofados. Contato: João Maia — (83) 9896-0039.\n" +
      "Ocorrências comuns em devolução: barulho na madeira do assento, encaixe macho/fêmea, retrátil travando. " +
      "Ver também categoria Garantias, seção Sofás.",
    keywords: "conceito estofados, sofa, fabrica propria, joao maia, retratil, barulho, encaixe",
  },
  {
    category: "fornecedores",
    title: "Beds/Aiam Colchões (fábrica própria)",
    body: "Produção interna de colchões. Contato: Diba — (83) 8709-9651.",
    keywords: "beds, aiam, colchao, fabrica propria, diba",
  },
  {
    category: "fornecedores",
    title: "Beds/Aiam Estofados (fábrica própria)",
    body: "Produção interna de estofados (linha Beds/Aiam). Contato interno: a preencher.",
    keywords: "beds, aiam, estofado, fabrica propria, a preencher",
  },

  // ---- Fornecedores e fabricantes: externos atuais -------------------------
  {
    category: "fornecedores",
    title: "Probel (colchões)",
    body:
      "Fornecedor externo atual — colchões.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público (backup, confirmar antes de divulgar): Tel (67) 3565-8049 · e-mail " +
      "assistenciatecnica@probelmercosul.com.br · probel.com.br",
    keywords: "probel, colchao, fornecedor externo, sac publico",
  },
  {
    category: "fornecedores",
    title: "Nesher (móveis/cozinhas)",
    body:
      "Fornecedor externo atual — móveis/cozinhas.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público (backup): Tel/WhatsApp (27) 3047-0040 · moveisnesher.com.br/contato · atendimento seg-sex " +
      "07h-11h e 12h-16h30.",
    keywords: "nesher, movel, cozinha, fornecedor externo, sac publico",
  },
  {
    category: "fornecedores",
    title: "Kappesberg (móveis)",
    body:
      "Fornecedor externo atual — móveis.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público (backup): Tel (51) 3635-8800 · e-mail sac@kappesberg.com.br · kappesberg.com.br",
    keywords: "kappesberg, movel, fornecedor externo, sac publico",
  },
  {
    category: "fornecedores",
    title: "Tuboarte (móveis — Jaguaribe/CE)",
    body:
      "Fornecedor externo atual — móveis. Fábrica em Jaguaribe-CE.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público (backup): página de representantes por estado em tuboarte.com.br/Representantes — pedir o " +
      "contato do representante Nordeste.",
    keywords: "tuboarte, movel, jaguaribe, ceara, fornecedor externo, representante",
  },
  {
    category: "fornecedores",
    title: "Tekshine",
    body:
      "Fornecedor externo atual.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público: não localizado com confiança — recomenda-se usar apenas o contato interno.",
    keywords: "tekshine, fornecedor externo",
  },
  {
    category: "fornecedores",
    title: "Valdemóveis",
    body:
      "Fornecedor externo atual.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público: não localizado com confiança — recomenda-se usar apenas o contato interno.",
    keywords: "valdemoveis, fornecedor externo, mesa de jantar",
  },

  // ---- Fornecedores e fabricantes: citados em devoluções históricas -------
  {
    category: "fornecedores",
    title: "Ortobom (colchões)",
    body:
      "Fabricante citado em devoluções históricas de colchões — pode já não ser fornecedor ativo, mas ainda tem " +
      "produtos em garantia no mercado.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público (backup): tel regional, varia por estado · e-mail sacrj@ortobom.com.br · colchoesortobom.com.br\n" +
      "Garantia (tecido / espuma / molejo): a confirmar / a confirmar / a confirmar.",
    keywords: "ortobom, colchao, garantia, fabricante",
  },
  {
    category: "fornecedores",
    title: "Anjos / D'Angelis (colchões)",
    body:
      "Fabricante citado em devoluções históricas de colchões.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público (backup): Tel (45) 3286-1177 · e-mail colchoes@anjos.ind.br · anjos.ind.br\n" +
      "Garantia (tecido / espuma / molejo): a confirmar / a confirmar / a confirmar.",
    keywords: "anjos, dangelis, colchao, garantia, fabricante",
  },
  {
    category: "fornecedores",
    title: "Maia (marca de colchão)",
    body:
      "Fabricante citado em devoluções históricas de colchões (marca \"Maia\", não confundir com a rede de lojas).\n" +
      "Contato interno: a preencher.\n" +
      "SAC público: não localizado com confiança — recomenda-se usar apenas o contato interno.\n" +
      "Garantia (tecido / espuma / molejo): 3 meses / 1 ano / 1 ano.",
    keywords: "maia colchao, marca maia, garantia, fabricante",
  },
  {
    category: "fornecedores",
    title: "Topázio (colchões)",
    body:
      "Fabricante citado em devoluções históricas de colchões.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público: existe mais de uma empresa \"Topázio Colchões\" no mercado (BA e outra ligada ao grupo Gazin) " +
      "— confirmar qual é a fornecedora antes de divulgar um telefone.\n" +
      "Garantia (tecido / espuma / molejo): 3 meses / 1 ano / 1 ano.",
    keywords: "topazio, colchao, garantia, fabricante, gazin",
  },
  {
    category: "fornecedores",
    title: "Softflex (colchões)",
    body:
      "Fabricante citado em devoluções históricas de colchões.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público: não localizado com confiança — recomenda-se usar apenas o contato interno.\n" +
      "Garantia (tecido / espuma / molejo): 3 meses / 1 ano / 1 ano.",
    keywords: "softflex, colchao, garantia, fabricante",
  },
  {
    category: "fornecedores",
    title: "Plumatex — linha Supreme White (colchões)",
    body:
      "Fabricante citado em devoluções históricas de colchões.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público (backup): Tel GO (62) 4014-1616 / BA (71) 2108-6300 / PB (83) 2108-9300 · e-mail " +
      "sac@plumatex.com.br · plumatex.com.br\n" +
      "Garantia (tecido / espuma / molejo): 3 meses (legal) / 12 meses / 12 meses.",
    keywords: "plumatex, supreme white, colchao, garantia, fabricante",
  },
  {
    category: "fornecedores",
    title: "Bertolini (móveis de madeira e vidro)",
    body:
      "Fabricante citado em devoluções históricas de móveis.\n" +
      "Contato interno: a preencher.\n" +
      "SAC público: não localizado com confiança — recomenda-se usar apenas o contato interno.\n" +
      "Garantia: 1 ano.",
    keywords: "bertolini, movel, madeira, vidro, garantia, fabricante",
  },

  // ---- Processos de atendimento --------------------------------------------
  {
    category: "processos",
    title: "Princípios de atendimento (regras de ouro)",
    body:
      "O cliente nunca fica sem resposta. A última fala é sempre nossa.\n" +
      "Estar perto do horário de saída não é motivo para deixar o problema sem solução — o cliente precisa sair " +
      "da conversa com pelo menos uma resposta conclusiva sobre a demanda dele.\n" +
      "Encaminhou uma demanda para outro setor? Acompanhe até se certificar de que o cliente foi atendido " +
      "devidamente e que não cabe mais nenhuma ação da sua parte.\n" +
      "Não existe \"cliente meu\" ou \"cliente seu\" — todos os clientes são nossos. Um caso encaminhado continua " +
      "sendo responsabilidade de todos até ser resolvido.",
    keywords: "regras de ouro, principio, postura, atendimento, resposta, acompanhar",
  },
  {
    category: "processos",
    title: "Fluxo: produto chegou com peças avariadas na casa do cliente",
    body:
      "1º passo: acionar a equipe de assistência para avaliar o caso.\n" +
      "Se o problema for só de peça(s): a demanda segue para a assistência técnica (reposição de peça).\n" +
      "Se o problema for do produto completo: o SAC faz a notificação de troca e encaminha para a troca do produto.",
    keywords: "peca avariada, avaria, produto danificado, assistencia tecnica, reposicao, troca",
  },
  {
    category: "processos",
    title: "Fluxo: troca de produto por pedido do cliente (não por defeito)",
    body:
      "Analisar o caso primeiro — não é uma troca automática por vício de fabricação, é um pedido do cliente " +
      "(não gostou, mudou de ideia, comprou errado etc.).\n" +
      "Na maioria dos casos, encaminhar para a loja fazer o pós-venda — é a loja quem trata negociação de troca " +
      "por pedido do cliente.",
    keywords: "troca por pedido do cliente, nao gostou, mudou de ideia, pos-venda, loja",
  },
  {
    category: "processos",
    title: "Fluxo: estorno",
    body: "Estorno é sempre tratado apenas com a loja — nunca diretamente pelo SAC ou pela assistência técnica.",
    keywords: "estorno, reembolso, devolucao de valor, cancelamento",
  },

  // ---- Prazos de garantia (genéricos por tipo de produto) ------------------
  {
    category: "garantias",
    title: "Garantia de colchões por componente (visão geral)",
    body:
      "Tecido — prazo padrão 90 dias (3 meses): cobre furos, rasgos, tramas soltas de origem, descolamento do " +
      "pillow top.\n" +
      "Espuma — prazo padrão 1 ano: cobre deformação permanente (cedeu, geralmente acima de 3 cm), esfarelamento, " +
      "perda rápida de resiliência.\n" +
      "Molas / Molejo — prazo padrão 1 a 5 anos (varia por fabricante): cobre molas quebradas/tortas, defeito na " +
      "estrutura do molejo.\n" +
      "Prazo específico por fabricante: ver a entrada de cada fabricante na categoria Fornecedores e fabricantes.",
    keywords: "garantia colchao, tecido, espuma, molejo, mola, prazo, deformacao, esfarelamento",
  },
  {
    category: "garantias",
    title: "Garantia de móveis de madeira e vidro",
    body:
      "Produtos de madeira: 90 dias para notificar avarias ou vícios de fabricação.\n" +
      "Produtos com vidro: sem garantia contra avaria — o dano tem que ser notificado no ato do recebimento pelo " +
      "cliente (recusa/ressalva na entrega).\n" +
      "Bertolini: garantia de 1 ano (ver entrada específica em Fornecedores e fabricantes).",
    keywords: "garantia movel, madeira, vidro, avaria, recebimento, ressalva, bertolini",
  },
  {
    category: "garantias",
    title: "Garantia de sofás",
    body:
      "A planilha de devoluções de sofás registra ocorrências da marca Conceito (barulho na madeira do assento, " +
      "encaixe macho/fêmea, retrátil travando) — hoje tratada como fábrica própria (Conceito Estofados, contato " +
      "João Maia). Recomenda-se formalizar prazos de garantia por componente de sofá (estrutura de madeira, " +
      "espuma do assento, mecanismo retrátil) do mesmo jeito que foi feito para colchão.",
    keywords: "garantia sofa, conceito, retratil, estrutura, madeira, assento",
  },

  // ---- Código de Defesa do Consumidor (CDC) --------------------------------
  {
    category: "cdc",
    title: "Art. 18 CDC — vício do produto",
    body:
      "Quando o produto apresenta defeito de fabricação (colchão cedendo, mola quebrada, espuma esfarelando etc.), " +
      "o fornecedor tem até 30 dias corridos para sanar o vício (conserto/troca).\n" +
      "Se não for resolvido em 30 dias, o cliente pode escolher, sem precisar justificar: (i) substituição do " +
      "produto por outro da mesma espécie e em perfeitas condições; (ii) devolução do valor pago, atualizado; ou " +
      "(iii) abatimento proporcional do preço.\n" +
      "Loja e fabricante respondem solidariamente — o cliente pode cobrar tanto da loja quanto do fabricante, e a " +
      "loja não pode simplesmente encaminhar o cliente para o fabricante e se eximir da responsabilidade.\n" +
      "Esse prazo de 30 dias pode ser reduzido para no mínimo 7 dias ou ampliado até 180 dias apenas por acordo " +
      "expresso entre as partes — na prática, para produtos essenciais (ex.: cama/colchão único do cliente), o " +
      "CDC permite pular direto para troca/reembolso sem esperar os 30 dias.",
    keywords: "vicio do produto, defeito de fabricacao, art 18, 30 dias, substituicao, abatimento, solidario",
  },
  {
    category: "cdc",
    title: "Art. 26 CDC — prazo para reclamar (vício aparente x oculto)",
    body:
      "Bens duráveis (móveis, colchões, sofás): o cliente tem 90 dias para reclamar de um vício aparente, " +
      "contados da entrega/recebimento.\n" +
      "Vício oculto (que só aparece depois de um tempo de uso, como uma mola que cede meses depois): o prazo de " +
      "90 dias só começa a contar a partir do momento em que o defeito ficar evidente — não da data da compra.\n" +
      "A jurisprudência do STJ reconhece que, mesmo depois de encerrada a garantia contratual do fabricante, um " +
      "defeito que aparece muito antes da vida útil esperada do produto pode ainda ser tratado como vício oculto " +
      "de fabricação.",
    keywords: "art 26, prazo para reclamar, vicio aparente, vicio oculto, 90 dias, stj",
  },
  {
    category: "cdc",
    title: "Art. 35 CDC — descumprimento da oferta / prazo de entrega",
    body:
      "Se o prazo prometido (entrega, encomenda) não é cumprido, o cliente pode escolher: exigir o cumprimento " +
      "forçado, aceitar um produto equivalente, ou cancelar com devolução do valor.\n" +
      "Vale também para entrega parcial: a parte não entregue no prazo segue a mesma lógica do Art. 35 — não " +
      "trate a entrega parcial como se fosse o combinado.\n" +
      "Avisar o cliente antes do prazo estourar não elimina o direito do Art. 35, mas evita que o caso vire " +
      "reclamação/escalada.",
    keywords: "art 35, atraso na entrega, prazo descumprido, entrega parcial, oferta",
  },
  {
    category: "cdc",
    title: "Art. 49 CDC — direito de arrependimento em compra à distância",
    body:
      "Compra feita fora do estabelecimento comercial (WhatsApp, telefone, internet): o cliente tem 7 dias " +
      "corridos, a partir do recebimento, para desistir sem precisar justificar.\n" +
      "Esse direito NÃO se aplica a compras feitas presencialmente na loja física — nesse caso, cancelamento " +
      "depende da política da loja.\n" +
      "Quem executa o cancelamento/estorno, nos dois casos, é sempre a loja — o SAC aciona o gerente, não " +
      "executa diretamente.",
    keywords: "art 49, arrependimento, compra a distancia, whatsapp, 7 dias, cancelamento",
  },
  {
    category: "cdc",
    title: "CDC — como aplicar no atendimento (passo a passo)",
    body:
      "1º passo: confirmar prazo de garantia do componente (tecido/espuma/molejo — ver categoria Garantias) e se " +
      "o defeito é coberto.\n" +
      "2º passo: abrir o chamado de assistência técnica junto ao fabricante (produto de terceiro) ou à fábrica " +
      "própria — prazo de até 30 dias para solução.\n" +
      "3º passo: se ultrapassar 30 dias sem solução, oferecer proativamente ao cliente as 3 alternativas do " +
      "Art. 18 (troca, devolução do valor ou abatimento), sem exigir justificativa dele.\n" +
      "Vício oculto: mesmo fora do prazo de garantia comercial, avaliar se o defeito é incompatível com a vida " +
      "útil esperada do produto antes de negar o atendimento — nesses casos, o CDC ainda pode amparar o cliente.\n" +
      "Lembrete: estorno é sempre com a loja, independentemente da alternativa escolhida pelo cliente.",
    keywords: "como aplicar cdc, passo a passo, checklist atendimento, vicio oculto",
  },
];

async function main() {
  const supabase = getSupabaseAdmin();
  const rows = ENTRIES.map((e) => ({
    category: e.category,
    slug: buildArsenalSlug(e.category, e.title),
    title: e.title,
    body: e.body,
    keywords: e.keywords ?? null,
  }));

  const { error, count } = await supabase.from("arsenal_sac_entries").upsert(rows, { onConflict: "slug", count: "exact" });

  if (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }
  console.log(`OK -- ${count ?? rows.length} entrada(s) upsertada(s) de ${ENTRIES.length} no array.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
