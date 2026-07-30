import { describe, it, expect } from "vitest";
import { dedupeByCpfCnpj, buildPurchaseStats, buildMonthlyPattern, computeSegments, clientFrequencyPerYear } from "./customerProfile";

describe("dedupeByCpfCnpj", () => {
  it("mantém só a linha de updated_at mais recente por cpf_cnpj", () => {
    const rows = [
      { cpf_cnpj: "111", updated_at: "2026-01-01T00:00:00Z", name: "antiga" },
      { cpf_cnpj: "111", updated_at: "2026-06-01T00:00:00Z", name: "recente" },
      { cpf_cnpj: "222", updated_at: "2026-03-01T00:00:00Z", name: "outro" },
    ];
    const result = dedupeByCpfCnpj(rows);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.cpf_cnpj === "111")?.name).toBe("recente");
  });
});

describe("buildPurchaseStats", () => {
  it("conta só vendas, devolução não infla total de compras", () => {
    const orders = [
      { invoice: "1", issue_date: "2026-01-10", invoice_total: 500, type: "Venda" as const, payment_method: null, seller_name: null },
      { invoice: "2", issue_date: "2026-02-10", invoice_total: 300, type: "Venda" as const, payment_method: null, seller_name: null },
      { invoice: "3", issue_date: "2026-02-15", invoice_total: -100, type: "Devolucao" as const, payment_method: null, seller_name: null },
    ];
    const stats = buildPurchaseStats(orders);
    expect(stats.totalCompras).toBe(2);
    expect(stats.valorBruto).toBe(800);
    expect(stats.valorLiquido).toBe(700); // devolução já entra negativa
    expect(stats.ticketMedio).toBe(400);
    expect(stats.primeiraCompra).toBe("2026-01-10");
    expect(stats.ultimaCompra).toBe("2026-02-10");
  });

  it("sem vendas retorna ticket médio null", () => {
    const stats = buildPurchaseStats([]);
    expect(stats.totalCompras).toBe(0);
    expect(stats.ticketMedio).toBeNull();
  });
});

describe("buildMonthlyPattern", () => {
  it("sempre retorna os 12 meses, mesmo sem dado", () => {
    const pattern = buildMonthlyPattern([]);
    expect(pattern).toHaveLength(12);
    expect(pattern[0].label).toBe("Jan");
  });

  it("ignora devolução na contagem por mês", () => {
    const orders = [
      { invoice: "1", issue_date: "2026-03-05", invoice_total: 100, type: "Venda" as const, payment_method: null, seller_name: null },
      { invoice: "2", issue_date: "2026-03-06", invoice_total: -50, type: "Devolucao" as const, payment_method: null, seller_name: null },
    ];
    const pattern = buildMonthlyPattern(orders);
    expect(pattern[2].count).toBe(1); // março = índice 2
    expect(pattern[2].total).toBe(100);
  });
});

describe("clientFrequencyPerYear", () => {
  it("calcula compras por ano com mínimo de 1 ano", () => {
    const summary = { cpf_cnpj: "1", client_name: null, total_compras: 6, valor_bruto: 0, ticket_medio: null, primeira_compra: "2026-01-01", ultima_compra: "2026-06-01" };
    expect(clientFrequencyPerYear(summary)).toBe(6); // menos de 1 ano -> divide por 1
  });

  it("cliente sem compras retorna 0", () => {
    const summary = { cpf_cnpj: "1", client_name: null, total_compras: 0, valor_bruto: 0, ticket_medio: null, primeira_compra: null, ultima_compra: null };
    expect(clientFrequencyPerYear(summary)).toBe(0);
  });
});

describe("computeSegments", () => {
  it("ticket médio do grupo é ponderado, não média simples dos tickets individuais", () => {
    const clients = [
      { cpf_cnpj: "a", protheus_code: "1", name: "A", status: "ativo", address_neighborhood: "Centro", address_city: "X", phone1: null, last_purchase_date: null, days_without_buying: null, updated_at: "2026-01-01" },
      { cpf_cnpj: "b", protheus_code: "2", name: "B", status: "ativo", address_neighborhood: "Centro", address_city: "X", phone1: null, last_purchase_date: null, days_without_buying: null, updated_at: "2026-01-01" },
    ];
    // cliente A: 1 compra de 5000 (ticket 5000); cliente B: 50 compras de 200 (ticket 200)
    const summaries = [
      { cpf_cnpj: "a", client_name: null, total_compras: 1, valor_bruto: 5000, ticket_medio: 5000, primeira_compra: "2026-01-01", ultima_compra: "2026-01-01" },
      { cpf_cnpj: "b", client_name: null, total_compras: 50, valor_bruto: 10000, ticket_medio: 200, primeira_compra: "2026-01-01", ultima_compra: "2026-01-01" },
    ];
    const segments = computeSegments(clients, summaries, "neighborhood");
    expect(segments).toHaveLength(1);
    // ponderado: (5000+10000) / (1+50) = 294.11..., NÃO a média simples (5000+200)/2 = 2600
    expect(segments[0].avgTicket).toBeCloseTo(15000 / 51, 2);
  });

  it("exclui clientes sem nenhuma compra", () => {
    const clients = [
      { cpf_cnpj: "a", protheus_code: "1", name: "A", status: "nunca comprou", address_neighborhood: "Centro", address_city: "X", phone1: null, last_purchase_date: null, days_without_buying: null, updated_at: "2026-01-01" },
    ];
    const segments = computeSegments(clients, [], "neighborhood");
    expect(segments).toHaveLength(0);
  });

  it("bairro vazio vira 'Não informado' em vez de descartar", () => {
    const clients = [
      { cpf_cnpj: "a", protheus_code: "1", name: "A", status: "ativo", address_neighborhood: null, address_city: "X", phone1: null, last_purchase_date: null, days_without_buying: null, updated_at: "2026-01-01" },
    ];
    const summaries = [{ cpf_cnpj: "a", client_name: null, total_compras: 1, valor_bruto: 100, ticket_medio: 100, primeira_compra: "2026-01-01", ultima_compra: "2026-01-01" }];
    const segments = computeSegments(clients, summaries, "neighborhood");
    expect(segments[0].key).toBe("Não informado");
  });

  it("comprador sem cadastro em totvs_clientes ainda aparece no segmento (achado rodando contra dado real)", () => {
    // totvs_clientes vazio -- simula os ~772 de 782 compradores reais sem cadastro correspondente
    const summaries = [{ cpf_cnpj: "sem-cadastro", client_name: "Fulano", total_compras: 2, valor_bruto: 300, ticket_medio: 150, primeira_compra: "2026-01-01", ultima_compra: "2026-02-01" }];
    const segments = computeSegments([], summaries, "neighborhood");
    expect(segments).toHaveLength(1);
    expect(segments[0].key).toBe("Não informado");
    expect(segments[0].clientCount).toBe(1);
    expect(segments[0].totalCompras).toBe(2);
  });
});
