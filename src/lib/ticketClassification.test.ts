import { describe, it, expect } from "vitest";
import { pickCategory, pickProduct, pickStore, classifyTranscript } from "./ticketClassification";

describe("pickCategory", () => {
  it("identifica atraso na entrega", () => {
    expect(pickCategory("Meu colchão está atrasado, o prazo já venceu e não chegou nada")?.category).toBe("cat-atraso");
  });

  it("identifica produto avariado", () => {
    expect(pickCategory("O sofá chegou todo riscado e com um defeito na costura")?.category).toBe("cat-avaria");
  });

  // Achado 19/09/2026 (Victor: "esse problema com entregador fica muito
  // amplo") -- entregador + palavra-chave específica vira sub-motivo, não
  // mais o catch-all genérico "cat-entregador".
  it("identifica atraso do entregador (sub-motivo específico, não o catch-all genérico)", () => {
    const result = pickCategory("O entregador chegou atrasado, o prazo já tinha vencido");
    expect(result?.category).toBe("cat-entregador-atraso");
  });

  it("identifica avaria causada pelo entregador", () => {
    expect(pickCategory("O motorista derrubou a caixa e o produto chegou quebrado")?.category).toBe("cat-entregador-avaria");
  });

  it("identifica endereço errado do entregador", () => {
    expect(pickCategory("O entregador entregou no endereço errado")?.category).toBe("cat-entregador-enderecoerrado");
  });

  it("identifica mau atendimento do entregador", () => {
    expect(pickCategory("O entregador foi muito mal educado com a cliente")?.category).toBe("cat-entregador-educacao");
  });

  it("cai no catch-all genérico quando menciona entregador sem motivo específico", () => {
    expect(pickCategory("Reclamação sobre o entregador, cliente não quis detalhar")?.category).toBe("cat-entregador");
  });

  it("identifica montagem", () => {
    expect(pickCategory("O montador não veio montar o guarda-roupa ainda")?.category).toBe("cat-montagem");
  });

  it("retorna confiança alta com 2+ padrões batendo", () => {
    expect(pickCategory("Produto avariado, chegou quebrado e riscado")?.confidence).toBe("alta");
  });

  it("retorna confiança média com 1 padrão só", () => {
    expect(pickCategory("Só uma dúvida sobre o produto, ele tem garantia?")?.confidence).toBe("media");
  });

  it("retorna null quando não bate nenhuma palavra-chave", () => {
    expect(pickCategory("Bom dia, tudo bem? Queria só confirmar uma coisa")).toBeNull();
  });
});

describe("pickProduct", () => {
  it("identifica o produto mencionado", () => {
    expect(pickProduct("Comprei um colchão casal e ele veio manchado")).toBe("Colchão");
  });

  it("prioriza o produto mais mencionado", () => {
    expect(pickProduct("O sofá tá com defeito, o sofá não devia estar assim, o sofá veio errado")).toBe("Sofá");
  });

  it("retorna null quando nenhum produto conhecido aparece", () => {
    expect(pickProduct("Preciso falar sobre a entrega de amanhã")).toBeNull();
  });
});

describe("pickStore", () => {
  it("identifica loja com nome único na rede", () => {
    expect(pickStore("Comprei na loja de Cabedelo semana passada")).toBe("loja-210");
  });

  it("não identifica loja com nome ambíguo entre filiais (Mangabeira)", () => {
    expect(pickStore("Fui na loja de Mangabeira")).toBeNull();
  });

  it("identifica a filial certa de Mangabeira quando o número aparece junto", () => {
    expect(pickStore("Comprei na Maia 2 Mangabeira semana passada")).toBe("loja-206");
    expect(pickStore("Fui na Maia 3 Mangabeira")).toBe("loja-207");
    expect(pickStore("Atendimento na Líder 1 Mangabeira")).toBe("loja-205");
  });

  it("identifica Maia Shopping (212) e Maia CD (213) pelo termo usado no dia a dia", () => {
    expect(pickStore("Comprei no Shopping semana passada")).toBe("loja-212");
    expect(pickStore("A peça ficou parada no CD")).toBe("loja-213");
  });

  it("retorna null quando nenhuma loja é mencionada", () => {
    expect(pickStore("Preciso de ajuda com meu pedido")).toBeNull();
  });
});

describe("classifyTranscript", () => {
  it("acha produto mesmo sem nenhuma categoria bater", () => {
    const result = classifyTranscript("Estou pensando em comprar uma cadeira de escritório, qual o preço?");
    expect(result?.category).toBeNull();
    expect(result?.product).toBe("Cadeira");
    expect(result?.confidence).toBe("media");
  });

  it("acha categoria e produto juntos quando os dois batem", () => {
    const result = classifyTranscript("O sofá chegou todo riscado e com um defeito na costura");
    expect(result?.category).toBe("cat-avaria");
    expect(result?.product).toBe("Sofá");
  });

  it("retorna null quando categoria, produto e loja não batem nada", () => {
    expect(classifyTranscript("Bom dia, tudo bem?")).toBeNull();
  });
});
