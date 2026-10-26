import { describe, it, expect, vi } from "vitest";

const linhas = [{ product_code: "L003206", description: "GUARDA ROUPA LUGANO", manufacturer: "MADEMARCS" }];
const consulta = { ilike: () => consulta, order: () => consulta, limit: async () => ({ data: linhas }), eq: () => consulta, select: () => consulta };
vi.mock("./supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ limit: async () => ({ data: [] }) }),
        ilike: () => consulta,
      }),
    }),
  }),
}));
vi.mock("./odoo/logistica", () => ({
  listarEmpresas: vi.fn(async () => [
    { id: 13, name: "213 CD" },
    { id: 21, name: "207 Mangabeira 3" },
    { id: 22, name: "208 GL" },
    { id: 23, name: "209 Pluma" },
  ]),
  inventarioSaldo: vi.fn(async (id: number) => {
    if (id === 23) throw new Error("Odoo não respondeu em 20 s");
    const sistema = id === 13 ? 44 : id === 21 ? 2 : 0;
    return { empresa: String(id), deposito: "x", itens: [{ codigo: "L003206", existe: true, nome: "GUARDA ROUPA", sistema, reservado: id === 21 ? 1 : 0 }] };
  }),
  mensagemDeErro: (e: unknown) => (e as Error).message,
}));

const { consultarEstoque, saldoNoCd } = await import("./estoqueLojas");

describe("consultarEstoque", () => {
  it("soma por loja, tira loja zerada e lista quem não respondeu (nunca como zero)", async () => {
    const r = await consultarEstoque("guarda roupa lugano");
    expect(r.produtos).toHaveLength(1);
    const p = r.produtos[0];
    expect(p.saldos.map((s) => [s.empresa, s.disponivel])).toEqual([
      ["213 CD", 44],
      ["207 Mangabeira 3", 1],
    ]);
    expect(p.total).toBe(46);
    expect(p.totalDisponivel).toBe(45);
    expect(r.falhas).toEqual([{ empresa: "209 Pluma", erro: "Odoo não respondeu em 20 s" }]);
  });
  it("busca curta não consulta nada", async () => {
    expect((await consultarEstoque("gu")).produtos).toEqual([]);
  });
});

describe("saldoNoCd", () => {
  it("lê só o CD e devolve o disponível", async () => {
    expect(await saldoNoCd("L003206")).toEqual({ empresa: "213 CD", disponivel: 44, nome: "GUARDA ROUPA" });
  });
  it("produto que o Odoo não conhece vale zero", async () => {
    expect((await saldoNoCd("X999999"))?.disponivel).toBe(0);
  });
});
