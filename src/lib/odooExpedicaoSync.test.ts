import { describe, it, expect, vi } from "vitest";

const upserts: { picking_id: number; pedido: string; pedido_id: number | null }[][] = [];
vi.mock("./supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      upsert: async (linhas: (typeof upserts)[number]) => {
        upserts.push(linhas);
        return { error: null };
      },
    }),
  }),
}));
vi.mock("./travaSync", () => ({ comTrava: (_a: unknown, _j: string, _o: string, _t: number, fn: () => Promise<unknown>) => fn() }));
const saida = (picking_id: number, pedido: string, pedido_id: number | false) => ({ picking_id, pedido, pedido_id, origem: pedido, cliente: "MARIA", cliente_id: 7, telefone: "", nf5922: "", nf5117: "", legado: false });
vi.mock("./odoo/logistica", () => ({
  listarEmpresas: vi.fn(async () => [
    { id: 13, name: "213 CD" },
    { id: 21, name: "207 Mangabeira" },
    { id: 22, name: "208 GL" },
  ]),
  lerExpedicao: vi.fn(async (id: number) => {
    if (id === 22) throw new Error("Odoo não respondeu em 60 s");
    return id === 13
      ? { entregas: [saida(1, "S00366", 365), saida(2, "S00383", 382)], pendencias: [saida(2, "S00383", 382)] }
      : { entregas: [saida(3, "S01589", false)], pendencias: [] };
  }),
  listarCargas: vi.fn(async (id: number) => (id === 13 ? [{ carga_id: 77, romaneio: "ROM/2026/00063", estado: "finalizada", cancelada: false }] : [])),
  lerCarga: vi.fn(async () => ({
    carga_id: 77,
    company_id: 13,
    paradas: [{ cliente: "JOSE", cliente_id: 8, telefone: "", pickings: [{ picking_id: 9, nome: "CD/OUT/9", pedido: "S01589", pedido_id: 1599, estado: "done" }] }],
  })),
  mensagemDeErro: (e: unknown) => (e as Error).message,
}));

const { sincronizarExpedicaoOdoo } = await import("./odooExpedicaoSync");
const { nomePedidoOdoo } = await import("./pedidoOdoo");

describe("sincronizarExpedicaoOdoo", () => {
  it("grava saídas da expedição e das paradas das cargas, sem repetir, e segue quando uma loja falha", async () => {
    const r = await sincronizarExpedicaoOdoo();
    expect(r).toEqual({ empresas: 3, saidas: 4, cargas: 1, falhas: [{ empresa: "208 GL", erro: "Odoo não respondeu em 60 s" }] });
    const todas = upserts.flat();
    expect(todas.map((l) => [l.picking_id, l.pedido, l.pedido_id])).toEqual([
      [1, "S00366", 365],
      [2, "S00383", 382],
      [3, "S01589", null],
      [9, "S01589", 1599],
    ]);
  });
  it("carga finalizada não é lida de novo na rodada seguinte", async () => {
    upserts.length = 0;
    const r = await sincronizarExpedicaoOdoo();
    expect(r).toMatchObject({ cargas: 0 });
  });
});

describe("nomePedidoOdoo", () => {
  it("aceita S01589 e ODOO-S01589, recusa pedido do Protheus", () => {
    expect(nomePedidoOdoo("ODOO-S01589")).toBe("S01589");
    expect(nomePedidoOdoo(" s01589 ")).toBe("S01589");
    expect(nomePedidoOdoo("062427")).toBeNull();
    expect(nomePedidoOdoo("maria s01589")).toBeNull();
  });
});
