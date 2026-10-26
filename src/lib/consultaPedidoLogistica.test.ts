import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
const { modoDoProtheus, logisticaDoOdoo, agruparPedidosOdoo } = await import("./consultaPedido");

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

describe("agruparPedidosOdoo", () => {
  const l = (o: Record<string, unknown>) => ({ pedido: "S01720", cliente: null, telefone: null, empresa: null, nf5922: null, nf5117: null, legado: false, modo: null, expresso: null, filial_entrega: null, retira_em: null, ...o });
  it("junta expedição e carga do mesmo pedido e pula o que já aparece pelo sync", () => {
    const r = agruparPedidosOdoo(
      [
        l({ cliente: "ANA", empresa: "213 CD" }),
        l({ cliente: "ANA", telefone: "83 9999", nf5922: "23787", modo: "retira_depois", retira_em: "205 Mangabeira 1", empresa: "205 Mangabeira 1" }),
        l({ pedido: "S01589", cliente: "JOSE" }),
      ],
      new Set(["S01589"])
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ pedido: "S01720", cliente: "ANA", telefone: "83 9999", nf5922: "23787", logistica: { modo: "retira", retiraEm: "205 Mangabeira 1" } });
  });
});
