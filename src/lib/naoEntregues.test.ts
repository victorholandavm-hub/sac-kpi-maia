import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("./consultaOdooPonte", () => ({}));
const { corrigirSituacao, filtrarSemReentrega } = await import("./naoEntregues");

const falha = (pedido: string, carga: string, dia: string, cliente = "CLIENTE") => ({ pedido, cliente, carga, dia, motivo: "Recusa Total do Cliente", motorista: "DANIEL" });

describe("não entregues", () => {
  it("a busca deixa de chamar de Entregue a parada que voltou", () => {
    const itens = [
      { pedido: "S01825", situacao: "Entregue · carga ROM/2026/00091 (finalizada) em 2026-10-28", cor: "ok" },
      { pedido: "S02032", situacao: "Entregue · carga ROM/2026/00091 (finalizada) em 2026-10-28", cor: "ok" },
    ] as never[];
    const r = corrigirSituacao(itens, [falha("S01825", "ROM/2026/00091", "2026-10-29")]);
    expect(r.map((i: { situacao: string }) => i.situacao)).toEqual([
      "Não entregue · voltou da carga ROM/2026/00091 em 29/10/2026 (Recusa Total do Cliente)",
      "Entregue · carga ROM/2026/00091 (finalizada) em 2026-10-28",
    ]);
  });
  it("sem reentrega: nem saída aberta nem carga depois; teste fica de fora", () => {
    const r = filtrarSemReentrega(
      [falha("S1", "ROM/1", "2026-10-28"), falha("S2", "ROM/1", "2026-10-28"), falha("S3", "ROM/1", "2026-10-28"), falha("S4", "ROM/2", "2026-10-29", "TESTE LOGISTICA")],
      [{ pedido: "S2", carga: "ROM/9", dia: "2026-10-30" }],
      new Set(["S3"]),
    );
    expect(r.map((f) => f.pedido)).toEqual(["S1"]);
  });
});
