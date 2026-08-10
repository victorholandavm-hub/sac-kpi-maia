import { describe, it, expect } from "vitest";
import { computeRiscoAutomatico, baselineFor, type EntregaRiscoCarga } from "./entregasRisco";

const BASELINE = "2026-07-29"; // quarta -- deadline (5 dias úteis) = 2026-08-05

function carga(overrides: Partial<EntregaRiscoCarga> = {}): EntregaRiscoCarga {
  return {
    carga: "C1",
    dtPrevisao: null,
    tentativa: 1,
    tipoEntrega: "Entrega",
    statusCarga: null,
    statusEntrega: null,
    motoristaNome: null,
    transportadora: null,
    notaFiscal: null,
    serie: null,
    ...overrides,
  };
}

describe("computeRiscoAutomatico", () => {
  it("sem carga aberta e ainda dentro do prazo -> não aparece (null)", () => {
    expect(computeRiscoAutomatico([], BASELINE, "2026-08-04")).toBeNull();
  });

  it("sem carga aberta e além do prazo -> alerta", () => {
    const risco = computeRiscoAutomatico([], BASELINE, "2026-08-06");
    expect(risco?.nivel).toBe("alerta");
  });

  it("carga aberta com previsão dentro do prazo -> acompanhamento", () => {
    const risco = computeRiscoAutomatico(
      [carga({ statusCarga: "Programada", dtPrevisao: "2026-08-04" })],
      BASELINE,
      "2026-07-30"
    );
    expect(risco?.nivel).toBe("acompanhamento");
  });

  it("carga aberta com previsão além do prazo -> alerta", () => {
    const risco = computeRiscoAutomatico(
      [carga({ statusCarga: "Em Rota", dtPrevisao: "2026-08-10" })],
      BASELINE,
      "2026-07-30"
    );
    expect(risco?.nivel).toBe("alerta");
  });

  it("carga já encerrada (não conta como 'aberta') e sem carga aberta além do prazo -> alerta", () => {
    const risco = computeRiscoAutomatico(
      [carga({ statusCarga: "Encerrada", dtPrevisao: "2026-08-01" })],
      BASELINE,
      "2026-08-06"
    );
    expect(risco?.nivel).toBe("alerta");
  });

  it("carga encerrada com entrega confirmada (statusEntrega Entregue), mesmo além do prazo -> não aparece (null)", () => {
    const risco = computeRiscoAutomatico(
      [carga({ statusCarga: "Encerrada", statusEntrega: "Entregue", dtPrevisao: "2026-08-01" })],
      BASELINE,
      "2026-08-06"
    );
    expect(risco).toBeNull();
  });

  it("entrega parcial confirmada numa carga também não é risco, mesmo com outra carga ainda pendente", () => {
    const risco = computeRiscoAutomatico(
      [
        carga({ carga: "C1", statusCarga: "Encerrada", statusEntrega: "Entregue Parcial", dtPrevisao: "2026-08-01" }),
        carga({ carga: "C2", statusCarga: "Encerrada", dtPrevisao: "2026-08-02" }),
      ],
      BASELINE,
      "2026-08-06"
    );
    expect(risco).toBeNull();
  });
});

describe("baselineFor", () => {
  it("usa a data de emissão da NF quando alguma carga já tem nota fiscal cruzável", () => {
    const ordersByInvoiceSerie = new Map([["000456|001", "2026-07-20"]]);
    const result = baselineFor([{ notaFiscal: "000456", serie: "001" }], ordersByInvoiceSerie, "2026-07-29T10:00:00Z");
    expect(result).toEqual({ data: "2026-07-20", origem: "nota_fiscal" });
  });

  it("cai pro first_seen_at quando nenhuma carga tem nota fiscal cruzável", () => {
    const result = baselineFor([{ notaFiscal: null, serie: null }], new Map(), "2026-07-29T10:00:00Z");
    expect(result).toEqual({ data: "2026-07-29", origem: "primeiro_sync" });
  });
});
