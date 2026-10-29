import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("./ghlClient", () => ({}));
vi.mock("./consultaOdooPonte", () => ({}));
const { vendaComoProtheus } = await import("./odooVendas");
const { candidatosDoBalcao } = await import("./vendaNpsOdoo");

const venda = (o: Record<string, unknown> = {}) =>
  ({
    pedido: "S02400",
    pedido_id: 2400,
    data: "2026-10-29 01:30:00",
    loja: "214",
    retira_em: "",
    cliente: { id: 262746, nome: "CLIENTE EXEMPLO B", cpf: "111.222.333-44", telefone: "", telefone2: "83 98888-7777", email: "", endereco: "" },
    vendedor: "L52 · Maria Souza",
    operador_caixa: "",
    total: 499.9,
    modo: "na_hora",
    estado: "sale",
    data_entrega: "",
    itens: [{ codigo: "071280", nome: "MULTI-USO", qtd: 1, entregue: 1, pendente: 0, preco: 499.9, subtotal: 499.9 }],
    notas: [{ tipo: "NFC-e", numero: "123", serie: "1", chave: "2526...", estado: "autorizada", data: "" }],
    entregas: [],
    legado: null,
    ...o,
  }) as never;

describe("vendas do Odoo em totvs_orders", () => {
  it("uma linha por venda, dia de Recife, vendedor separado, NFC-e como chave", () => {
    const { venda: v, itens } = vendaComoProtheus(venda(), "2026-10-28");
    expect(v).toMatchObject({ invoice: "S02400", serie: "ODOO", branch: "214", issue_date: "2026-10-28", invoice_total: 499.9, type: "Venda", nfe_key: "2526...", seller_id: "L52", seller_name: "Maria Souza", client_id: "ODOO262746", client_cpf_cnpj: "11122233344", payment_method: "Balcão" });
    expect(itens).toEqual([expect.objectContaining({ item_number: "01", product: "071280", quantity: 1, total: 499.9 })]);
  });
});

describe("NPS de atendimento do balcão", () => {
  it("só venda levada na hora, com telefone, fora as que a expedição já tem", () => {
    const c = candidatosDoBalcao([venda(), venda({ pedido: "S02401", modo: "entrega" }), venda({ pedido: "S02402" })], new Set(["S02402"]));
    expect(c).toEqual([{ pedido: "S02400", cliente: "CLIENTE EXEMPLO B", telefone: expect.any(String), loja: "214", vendedor: "L52 · Maria Souza", dataVenda: "2026-10-28" }]);
  });
});
