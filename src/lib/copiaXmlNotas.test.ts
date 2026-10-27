import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("./notaEntregaProtheus", () => ({ pastaNotas: () => "/s/notas-protheus" }));
const { chavesQueFaltam } = await import("./copiaXmlNotas");

const C1 = "25260839537682000888550010000123821488884606";
const C2 = "25260939537682000373550010000237971194893562";

describe("chavesQueFaltam", () => {
  it("só chave válida, que ainda não foi baixada, sem repetir", () => {
    const r = chavesQueFaltam(
      [
        { invoice: "000012382", branch: "209", nfe_key: C1 },
        { invoice: "000023797", branch: "207", nfe_key: C2 },
        { invoice: "000023797", branch: "207", nfe_key: C2 },
        { invoice: "1", branch: "201", nfe_key: "123" },
      ],
      new Set([C1])
    );
    expect(r.map((v) => v.invoice)).toEqual(["000023797"]);
  });
});
