import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("./ghlClient", () => ({}));
vi.mock("./ghlSubcontas", () => ({ SUBCONTAS: { lojas_maia: { tokenEnv: "X", locationId: "L" } } }));
vi.mock("./npsEncaminhar", () => ({ encaminharPelaNota: vi.fn(), clientePeloTelefone: () => null, ehPedidoDeTroca: (o: string | null | undefined) => (o ?? "").toLowerCase().includes("troca") }));
vi.mock("./npsDetratores", () => ({ NPS_GHL_TAG: { venda: "t" }, NPS_1_5_PATTERN: /^([1-5])$/ }));
const { candidatosDasLinhas, separarVendedorOdoo } = await import("./vendaNpsOdoo");
const { linhasOdooComoProtheus } = await import("./npsVendedores");

const l = (o: Record<string, unknown>) => ({ pedido: "S01741", cliente: "ADEMACIR", telefone: "83 98888-7777", empresa: "205 Mangabeira 1", vendedor: "JOSÉ", primeiro_visto: "2026-10-27T14:00:00Z", ...o });

describe("candidatosDasLinhas", () => {
  it("um por pedido, com telefone, loja e vendedor; data da venda em Recife", () => {
    const r = candidatosDasLinhas([l({}), l({ telefone: null, primeiro_visto: "2026-10-27T02:00:00Z" })]);
    expect(r).toEqual([{ pedido: "S01741", cliente: "ADEMACIR", telefone: "83 98888-7777", loja: "205", vendedor: "JOSÉ", dataVenda: "2026-10-26" }]);
  });
  it("pula teste, sem telefone e telefone falso; mais nova primeiro", () => {
    const r = candidatosDasLinhas([
      l({ pedido: "S01584", cliente: "TESTE LOGISTICA 2" }),
      l({ pedido: "S01750", telefone: null }),
      l({ pedido: "S01751", telefone: "00000000000" }),
      l({ pedido: "S01700", primeiro_visto: "2026-10-25T15:00:00Z" }),
      l({ pedido: "S01760" }),
    ]);
    expect(r.map((c) => c.pedido)).toEqual(["S01760", "S01700"]);
  });
});

describe("linhasOdooComoProtheus", () => {
  it("vendedor do Odoo entra no código do Protheus quando o nome bate (sem acento/caixa)", () => {
    const protheus = [{ score: 5, totvs_orders: { seller_id: "000123", seller_name: "José da Silva", branch: "205", issue_date: "2026-10-20" } }];
    const r = linhasOdooComoProtheus(
      [
        { score: 4, vendedor: "JOSE DA  SILVA", loja: "205", data_venda: "2026-10-26" },
        { score: 2, vendedor: "Maria Nova", loja: "212", data_venda: "2026-10-26" },
      ],
      protheus
    );
    expect(r.map((x) => x.totvs_orders.seller_id)).toEqual(["000123", null]);
    expect(r[1].totvs_orders).toMatchObject({ seller_name: "Maria Nova", branch: "212", issue_date: "2026-10-26" });
  });
});

describe("separarVendedorOdoo", () => {
  it("código do Odoo e nome", () => {
    expect(separarVendedorOdoo("L17 · Joao Paulo")).toEqual({ codigo: "L17", nome: "Joao Paulo" });
    expect(separarVendedorOdoo("Rayanne Kelly")).toEqual({ codigo: null, nome: "Rayanne Kelly" });
    expect(separarVendedorOdoo(null)).toEqual({ codigo: null, nome: null });
  });
  it("no NPS por vendedor: nome que bate vai pro código do Protheus; senão, código do Odoo", () => {
    const protheus = [{ score: 5, totvs_orders: { seller_id: "000123", seller_name: "Joao Paulo", branch: "205", issue_date: "2026-10-20" } }];
    const r = linhasOdooComoProtheus(
      [
        { score: 4, vendedor: "L17 · Joao Paulo", loja: "205", data_venda: "2026-10-26" },
        { score: 3, vendedor: "L80 · Isaias", loja: "212", data_venda: "2026-10-26" },
      ],
      protheus
    );
    expect(r.map((x) => [x.totvs_orders.seller_id, x.totvs_orders.seller_name])).toEqual([
      ["000123", "Joao Paulo"],
      ["L80", "Isaias"],
    ]);
  });
});
