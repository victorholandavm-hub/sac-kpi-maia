import { describe, it, expect } from "vitest";
import { pickCategory, pickProduct, pickStore } from "./ticketClassification";

describe("pickCategory", () => {
  it("identifica atraso na entrega", () => {
    expect(pickCategory("Meu colchão está atrasado, o prazo já venceu e não chegou nada")?.category).toBe("cat-atraso");
  });

  it("identifica produto avariado", () => {
    expect(pickCategory("O sofá chegou todo riscado e com um defeito na costura")?.category).toBe("cat-avaria");
  });

  it("identifica problema com o entregador antes de atraso quando os dois aparecem", () => {
    const result = pickCategory("O entregador foi grosseiro e chegou atrasado também");
    expect(result?.category).toBe("cat-entregador");
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

  it("retorna null quando nenhuma loja é mencionada", () => {
    expect(pickStore("Preciso de ajuda com meu pedido")).toBeNull();
  });
});
