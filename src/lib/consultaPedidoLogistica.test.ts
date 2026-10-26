import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
const { modoDoProtheus, logisticaDoOdoo } = await import("./consultaPedido");

const linha = (o: Partial<Parameters<typeof logisticaDoOdoo>[1][number]>) => ({ pedido: "S01589", modo: null, expresso: null, filial_entrega: null, retira_em: null, empresa: null, ...o });

describe("modoDoProtheus", () => {
  it("lê o tipo da saída do Protheus", () => {
    expect(modoDoProtheus("Entrega")).toBe("entrega");
    expect(modoDoProtheus("Express")).toBe("express");
    expect(modoDoProtheus("Retirada")).toBe("retira");
    expect(modoDoProtheus(null)).toBeNull();
  });
});

describe("logisticaDoOdoo", () => {
  it("retira na loja, com a loja de retirada", () => {
    expect(logisticaDoOdoo("216", [linha({ modo: "retira_depois", retira_em: "205 Mangabeira 1", empresa: "205 Mangabeira 1" })])).toEqual({
      filialVenda: "216",
      filialEntrega: "205",
      modo: "retira",
      retiraEm: "205 Mangabeira 1",
    });
  });
  it("prefere a linha da expedição à da carga e usa a filial de entrega dela", () => {
    const r = logisticaDoOdoo("212", [linha({ empresa: "213 CD" }), linha({ modo: "entrega", expresso: true, filial_entrega: "212", empresa: "212 Shopping" })]);
    expect(r).toMatchObject({ filialEntrega: "212", modo: "express" });
  });
  it("só a carga: filial de entrega pela empresa da carga, modo desconhecido", () => {
    expect(logisticaDoOdoo("205", [linha({ empresa: "213 CD" })])).toMatchObject({ filialEntrega: "213", modo: null });
  });
  it("sem nada na expedição", () => {
    expect(logisticaDoOdoo("205", [])).toEqual({ filialVenda: "205", filialEntrega: null, modo: null, retiraEm: null });
  });
});
