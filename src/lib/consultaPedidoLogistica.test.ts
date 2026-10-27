import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
const { modoDoProtheus, logisticaDoOdoo, agruparPedidosOdoo, situacaoDoOdoo, cartaoDaBusca, ligarVendasMigradas, cartaoDaConsulta, situacaoDaConsulta } = await import("./consultaPedido");

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
    expect(logisticaDoOdoo("216", [linha({ modo: "retira_depois", retira_em: "205 Mangabeira 1", empresa: "205 Mangabeira 1" })])).toMatchObject({
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

describe("situacaoDoOdoo", () => {
  const base = { pedido: "S01", modo: "entrega", expresso: false, filial_entrega: null, retira_em: null, empresa: "213 CD" };
  it("na fila: aguardando carga com a data programada; pendência tem prioridade", () => {
    expect(situacaoDoOdoo([{ ...base, data_programada: "2026-10-28" }], "entrega")).toMatchObject({ texto: "Aguardando carga", tom: "neutro", carga: null, detalhes: ["programado 28/10/2026"] });
    expect(situacaoDoOdoo([{ ...base, pendencia_motivo: "falta produto" }], "entrega")?.texto).toBe("Pendência: falta produto");
  });
  it("em separação e em rota mostram a carga e a previsão", () => {
    const r = situacaoDoOdoo([{ ...base, carga_id: 77, carga_romaneio: "ROM/2026/00063", carga_estado: "separacao", carga_prevista: "2026-10-27" }], "entrega");
    expect(r).toMatchObject({ texto: "Em separação", tom: "neutro", carga: "ROM/2026/00063", cargaId: 77, detalhes: ["carga prevista 27/10/2026"] });
    expect(situacaoDoOdoo([{ ...base, carga_id: 77, carga_romaneio: "ROM/2026/00063", carga_estado: "em_rota" }], "entrega")?.texto).toBe("Saiu para entrega");
  });
  it("resultado da parada: entregue; e o pedido que voltou pra fila", () => {
    expect(situacaoDoOdoo([{ ...base, carga_id: 73, carga_romaneio: "ROM/2026/00059", carga_estado: "finalizada", resultado: "entregue" }], "entrega")?.texto).toBe("Entregue");
    expect(situacaoDoOdoo([{ ...base, resultado: "insucesso" }], "entrega")).toMatchObject({ texto: "Voltou da entrega, aguardando nova carga", tom: "critico" });
  });
  it("vale a carga mais recente e retirada aguarda o cliente", () => {
    const r = situacaoDoOdoo(
      [
        { ...base, modo: null, carga_id: 50, carga_romaneio: "ROM/2026/00040", carga_estado: "finalizada", resultado: "insucesso" },
        { ...base, modo: null, carga_id: 70, carga_romaneio: "ROM/2026/00056", carga_estado: "em_rota" },
      ],
      "entrega"
    );
    expect(r).toMatchObject({ texto: "Saiu para entrega", carga: "ROM/2026/00056" });
    expect(situacaoDoOdoo([{ ...base, modo: "retira_depois" }], "retira")?.texto).toBe("Aguardando o cliente retirar");
  });
});

describe("situacaoDoOdoo: motorista e fotos", () => {
  const base = { pedido: "S01", modo: "entrega", expresso: false, filial_entrega: null, retira_em: null, empresa: "213 CD" };
  it("motorista da carga atual e fotos da parada", () => {
    const r = situacaoDoOdoo(
      [{ ...base, carga_id: 80, carga_romaneio: "ROM/2026/00066", carga_estado: "em_rota", carga_motorista: "Douglas", carga_veiculo: "HTT0D75", parada_id: 501, ultima_carga_id: 80 }],
      "entrega"
    );
    expect(r).toMatchObject({ texto: "Saiu para entrega", motorista: "Douglas", veiculo: "HTT0D75", fotoRef: { cargaId: 80, paradaId: 501 } });
  });
  it("voltou pra fila: sem motorista atual, mas as fotos da tentativa ficam", () => {
    const r = situacaoDoOdoo([{ ...base, resultado: "insucesso", carga_motorista: "Isaac", parada_id: 77, ultima_carga_id: 65 }], "entrega");
    expect(r).toMatchObject({ texto: "Voltou da entrega, aguardando nova carga", motorista: null, fotoRef: { cargaId: 65, paradaId: 77 } });
  });
});

describe("cartaoDaBusca", () => {
  it("monta o cartão do pedido achado direto no Odoo (CPF de cliente novo)", () => {
    const c = cartaoDaBusca({
      pedido: "S00408", pedido_id: 407, picking: "x", picking_id: 1, cliente: "JANICLEIDE", loja: "207", modo: "retira_depois",
      nf5922: "23797/1", nf5117: "", nota: "", situacao: "Na loja 207: peça reservada lá", cor: "info", carga_id: false, na_fila: true,
    });
    expect(c).toMatchObject({ pedido: "S00408", cliente: "JANICLEIDE", empresa: "207", nf5922: "23797/1", nf5117: null, situacaoOdoo: "Na loja 207: peça reservada lá", logistica: { filialVenda: "207", modo: "retira" } });
  });
});

describe("ligarVendasMigradas", () => {
  const venda = (nf: string, filial: string) => ({
    venda: { id: nf + filial, notaFiscal: nf.padStart(9, "0"), serie: "1", filial, data: "2026-10-24", vendedor: null, formaPagamento: null, valor: 1, itens: [], chave: null },
    entrega: null,
    criterio: null,
    data: "2026-10-24",
  });
  const odoo = (pedido: string, nf5922: string | null) => ({ pedido, cliente: "JONAS", telefone: null, empresa: "213 CD", nf5922, nf5117: null, legado: true, logistica: { filialVenda: null, filialEntrega: "213", modo: null, retiraEm: null } });
  it("põe o pedido do Odoo dentro da venda do Protheus de mesma nota e tira da lista solta", () => {
    const r = { busca: "x", tipo: "nome" as const, limitado: false, clientes: [{ codigo: "129163", nome: "JONAS", documento: null, pedidos: [venda("31039", "213")] }], odoo: [odoo("S00672", "31039/1"), odoo("S00700", null)] };
    ligarVendasMigradas(r);
    expect(r.clientes[0].pedidos[0]).toMatchObject({ odooLigado: { pedido: "S00672", vendaProtheus: "NF 31039" } });
    expect(r.odoo.map((o) => o.pedido)).toEqual(["S00700"]);
  });
  it("mesma nota em duas filiais: não liga (ambíguo)", () => {
    const r = { busca: "x", tipo: "nome" as const, limitado: false, clientes: [{ codigo: "1", nome: "A", documento: null, pedidos: [venda("100", "205"), venda("100", "212")] }], odoo: [odoo("S1", "100/1")] };
    ligarVendasMigradas(r);
    expect(r.odoo).toHaveLength(1);
  });
});

describe("cartaoDaConsulta (/consulta/pedidos)", () => {
  const base = {
    pedido: "S00408", pedido_id: 407, data: "2026-10-01 01:56:00", loja: "207", retira_em: "212",
    cliente: { id: 1, nome: "JANICLEIDE", cpf: "04682762460", telefone: "83 98845", email: "", endereco: "" },
    vendedor: "L67 · Fernanda Fernandes", operador_caixa: "", total: 537.8, modo: "retira_depois", estado: "sale", data_entrega: "",
    itens: [{ codigo: "071280", nome: "MULTI-USO NEW ATACAMA", qtd: 1, entregue: 0, pendente: 1, preco: 238.8, subtotal: 238.8 }],
    notas: [],
    entregas: [{ picking: "207 M/OUT/00051", estado: "assigned", carga: "", carga_estado: "", motorista: "", data_programada: "2026-10-25 01:08:20", entregue_em: "", sai_de: "212", pendencia: false, pendencia_motivo: "" }],
    legado: { nf_5922: "23797/1", chave_5922: "25260939537682000373550010000237971194893562" },
  };
  it("itens com código, nota de venda do Protheus pela chave e a nota pra ligar com a venda", () => {
    const c = cartaoDaConsulta(base);
    expect(c).toMatchObject({ pedido: "S00408", telefone: "83 98845", nf5922: "23797/1", legado: true, vendedor: "L67 · Fernanda Fernandes", total: 537.8 });
    expect(c.itens).toEqual([{ codigo: "071280", descricao: "MULTI-USO NEW ATACAMA", quantidade: 1 }]);
    expect(c.notas).toEqual([{ tipo: "5922 (Protheus)", numero: "23797/1", chave: "25260939537682000373550010000237971194893562" }]);
    expect(c.situacaoOdoo).toBe("Aguardando o cliente retirar na loja 212");
  });
  it("situação: balcão, entregue, pendência, carga", () => {
    expect(situacaoDaConsulta({ ...base, modo: "na_hora" })).toBe("Venda levada na hora (balcão)");
    expect(situacaoDaConsulta({ ...base, entregas: [{ ...base.entregas[0], entregue_em: "2026-10-26 18:00:00" }] })).toBe("Entregue em 26/10/2026");
    expect(situacaoDaConsulta({ ...base, entregas: [{ ...base.entregas[0], pendencia: true, pendencia_motivo: "falta peça" }] })).toBe("Pendência: falta peça");
    expect(situacaoDaConsulta({ ...base, modo: "entrega", entregas: [{ ...base.entregas[0], carga: "ROM/2026/00066", carga_estado: "em_rota" }] })).toBe("Na carga ROM/2026/00066 (em rota)");
  });
});
