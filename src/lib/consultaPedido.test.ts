import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: vi.fn() }));

const { tipoDaBusca } = await import("./consultaPedido");

describe("tipoDaBusca", () => {
  it("reconhece CPF/CNPJ com ou sem pontuação", () => {
    expect(tipoDaBusca("065.715.034-76")).toBe("documento");
    expect(tipoDaBusca("06571503476")).toBe("documento");
    expect(tipoDaBusca("29.112.864/0001-87")).toBe("documento");
  });
  it("até 6 dígitos é pedido (ou nota), 7 a 9 é nota da venda", () => {
    expect(tipoDaBusca("15603")).toBe("numero");
    expect(tipoDaBusca("000005341")).toBe("nota");
  });
  it("texto é nome; menos de 3 letras não busca", () => {
    expect(tipoDaBusca("Marilene")).toBe("nome");
    expect(tipoDaBusca("ma")).toBe("curta");
  });
});
