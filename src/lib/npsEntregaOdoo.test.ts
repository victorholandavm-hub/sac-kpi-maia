import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("./ghlClient", () => ({}));
vi.mock("./ghlSubcontas", () => ({ SUBCONTAS: { lojas_maia: { tokenEnv: "X", locationId: "L" } } }));
vi.mock("./npsEncaminhar", () => ({ encaminharPelaNota: vi.fn(), clientePeloTelefone: () => null, ehPedidoDeTroca: (o: string | null | undefined) => (o ?? "").toLowerCase().includes("troca") }));
vi.mock("./npsDetratores", () => ({ NPS_GHL_TAG: { entrega: "e", compra: "c" }, NPS_1_5_PATTERN: /^([1-5])$/ }));
vi.mock("./googleReviewRequest", () => ({ maybeRequestGoogleReview: vi.fn() }));
const { candidatosEntregues } = await import("./npsEntregaOdoo");

const l = (o: Record<string, unknown>) => ({ pedido: "S00664", cliente: "GENILSON", telefone: "83 98888-1111", empresa: "213 CD", carga_fim_em: "2026-10-26T20:00:00Z", carga_saiu_em: "2026-10-26T11:00:00Z", ...o });

describe("candidatosEntregues", () => {
  it("dia da entrega = fim da rota em Recife, dentro da janela", () => {
    const r = candidatosEntregues([l({}), l({ pedido: "S00671", carga_fim_em: "2026-10-27T02:00:00Z" })], "2026-10-25", "2026-10-26");
    expect(r.map((c) => [c.pedido, c.entregueEm, c.loja])).toEqual([
      ["S00671", "2026-10-26", "213"],
      ["S00664", "2026-10-26", "213"],
    ]);
  });
  it("sem fim de rota usa a saída; fora da janela, sem telefone e teste ficam de fora", () => {
    const r = candidatosEntregues(
      [
        l({ pedido: "S1", carga_fim_em: null }),
        l({ pedido: "S2", carga_fim_em: "2026-10-20T15:00:00Z" }),
        l({ pedido: "S3", telefone: null }),
        l({ pedido: "S4", cliente: "TESTE LOGISTICA 6" }),
      ],
      "2026-10-25",
      "2026-10-26"
    );
    expect(r.map((c) => c.pedido)).toEqual(["S1"]);
  });
});

describe("faturado pelo SAC ou pela assistência", () => {
  it("não entra nas pesquisas de entrega e compra", async () => {
    const { faturouPeloSacOuAssistencia, pedidosFaturadosPeloSac } = await import("./npsEntregaOdoo");
    expect(faturouPeloSacOuAssistencia("SAC Ingrid")).toBe(true);
    expect(faturouPeloSacOuAssistencia("Equipe Iasmyn")).toBe(true);
    expect(faturouPeloSacOuAssistencia("CD Jhon")).toBe(false);
    expect(faturouPeloSacOuAssistencia("Motorista Douglas")).toBe(false);
    const base = { cliente: null, telefone: null, empresa: null, carga_fim_em: null, carga_saiu_em: null };
    const linhas = [
      { ...base, pedido: "S1", carga_id: 10 },
      { ...base, pedido: "S2", ultima_carga_id: 11 },
      { ...base, pedido: "S3", carga_id: 12 },
    ];
    expect([...pedidosFaturadosPeloSac(linhas, new Set([10, 11]))].sort()).toEqual(["S1", "S2"]);
  });
});
