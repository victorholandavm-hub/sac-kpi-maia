import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("./consultaCarga", () => ({}));
const { ehOutraPessoa, quemFaturou } = await import("./notasDeOutros");

describe("quem faturou", () => {
  it("Adonis e John (Jhon) ficam de fora; o resto aparece", () => {
    expect(ehOutraPessoa("CD Jhon")).toBe(false);
    expect(ehOutraPessoa("Equipe Adonis Silva")).toBe(false);
    expect(ehOutraPessoa("CD John")).toBe(false);
    expect(ehOutraPessoa("CD Carlos Gabriel")).toBe(true);
    expect(ehOutraPessoa("SAC Ingrid")).toBe(true);
    expect(ehOutraPessoa("Motorista Douglas")).toBe(true);
    expect(quemFaturou("CD Rafael")).toBe("Rafael");
  });
});
