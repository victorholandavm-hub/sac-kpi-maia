import { describe, expect, it } from "vitest";
import { apiKeyValida, parsePeriodoKpis } from "./logisticaApi";

describe("apiKeyValida", () => {
  it("aceita qualquer uma das chaves configuradas", () => {
    expect(apiKeyValida("chave-b", "chave-a, chave-b")).toBe(true);
  });

  it("recusa chave errada, ausente ou sem configuração (falha fechada)", () => {
    expect(apiKeyValida("outra", "chave-a")).toBe(false);
    expect(apiKeyValida(null, "chave-a")).toBe(false);
    expect(apiKeyValida("chave-a", undefined)).toBe(false);
    expect(apiKeyValida("", ",")).toBe(false);
  });
});

describe("parsePeriodoKpis", () => {
  const parse = (q: string) => parsePeriodoKpis(new URLSearchParams(q));

  it("aceita período válido, com e sem tipo", () => {
    expect(parse("de=2026-09-07&ate=2026-10-06")).toEqual({
      ok: true,
      periodo: { de: "2026-09-07", ate: "2026-10-06", tipo: null },
    });
    expect(parse("de=2026-10-01&ate=2026-10-01&tipo=Express")).toMatchObject({
      ok: true,
      periodo: { tipo: "Express" },
    });
  });

  it("recusa datas ausentes, mal formatadas ou inexistentes", () => {
    expect(parse("de=2026-09-07")).toMatchObject({ ok: false, erro: { erro: "periodo_invalido" } });
    expect(parse("de=07/09/2026&ate=2026-10-06")).toMatchObject({ ok: false });
    expect(parse("de=2026-02-30&ate=2026-03-01")).toMatchObject({ ok: false });
  });

  it("recusa ate antes de de e janela acima de 92 dias", () => {
    expect(parse("de=2026-10-06&ate=2026-10-05")).toMatchObject({ ok: false });
    expect(parse("de=2026-07-01&ate=2026-09-30")).toMatchObject({ ok: true });
    expect(parse("de=2026-07-01&ate=2026-10-01")).toMatchObject({ ok: false });
  });

  it("recusa tipo fora do contrato", () => {
    expect(parse("de=2026-10-01&ate=2026-10-02&tipo=entrega")).toMatchObject({
      ok: false,
      erro: { erro: "tipo_invalido" },
    });
  });
});
