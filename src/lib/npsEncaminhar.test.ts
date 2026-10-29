import { describe, it, expect } from "vitest";
import { ATENDENTES_NOTA_BAIXA, atendenteDoSac, clientePeloTelefone, NOTA_MAXIMA_SAC } from "./npsEncaminhar";

describe("encaminhar pela nota", () => {
  it("de 3 pra baixo vai pro SAC, sempre a mesma atendente pro mesmo contato", () => {
    expect(NOTA_MAXIMA_SAC).toBe(3);
    const a = atendenteDoSac("abc123");
    expect(ATENDENTES_NOTA_BAIXA.map((x) => x.nome).sort()).toEqual(["Flávio", "Ingrid", "Jaluska"]);
    expect(ATENDENTES_NOTA_BAIXA).toContain(a);
    expect(atendenteDoSac("abc123")).toBe(a);
  });
  it("telefone vira o código do cliente no intervalo do pedido de avaliação", () => {
    expect(clientePeloTelefone("(83) 98640-0954")).toBe("tel:83986400954");
    expect(clientePeloTelefone(null)).toBeNull();
  });
});
