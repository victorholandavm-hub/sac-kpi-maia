import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ddmmyyyyToIso, isoDate, totvsHeaders, detectDeliveryRiskTrigger, nextOrdersCursor } from "./totvsSync";

describe("ddmmyyyyToIso", () => {
  it("converte DD/MM/YYYY pra YYYY-MM-DD", () => {
    expect(ddmmyyyyToIso("18/01/2025")).toBe("2025-01-18");
  });

  it("retorna null pra undefined", () => {
    expect(ddmmyyyyToIso(undefined)).toBeNull();
  });

  it("retorna null pra string vazia", () => {
    expect(ddmmyyyyToIso("")).toBeNull();
  });

  it("retorna null pra formato inesperado", () => {
    expect(ddmmyyyyToIso("2025-01-18")).toBeNull();
  });
});

describe("isoDate", () => {
  it("formata uma data como YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-07-29T15:30:00Z"))).toBe("2026-07-29");
  });
});

describe("nextOrdersCursor", () => {
  const TODAY = "2026-09-07";

  it("página incompleta -- avança só a página, mesmo dia", () => {
    expect(nextOrdersCursor("2026-09-05", 1, 100, 3, TODAY)).toEqual({ day: "2026-09-05", page: 2, stop: false });
  });

  it("dia PASSADO esgotado (0 pedidos) -- avança pro dia seguinte", () => {
    expect(nextOrdersCursor("2026-09-05", 1, 0, undefined, TODAY)).toEqual({ day: "2026-09-06", page: 1, stop: false });
  });

  it("dia PASSADO esgotado (última página) -- avança pro dia seguinte", () => {
    expect(nextOrdersCursor("2026-09-05", 3, 40, 3, TODAY)).toEqual({ day: "2026-09-06", page: 1, stop: false });
  });

  // Regressão do bug real de 07/09/2026: HOJE com 0 pedidos (checado de
  // manhã cedo, antes de qualquer venda) NÃO pode avançar o cursor pra
  // amanhã -- isso prendia o sync de pedidos pro resto do dia inteiro,
  // perdendo toda venda que entrasse depois (ver comentário em
  // nextOrdersCursor, totvsSync.ts). Cursor tem que continuar em HOJE,
  // só a página reseta e `stop: true` sinaliza pra sair do laço desta
  // execução.
  it("HOJE esgotado (0 pedidos) -- NÃO avança o cursor, só sinaliza parar", () => {
    expect(nextOrdersCursor(TODAY, 1, 0, undefined, TODAY)).toEqual({ day: TODAY, page: 1, stop: true });
  });

  it("HOJE esgotado (última página, com pedidos) -- NÃO avança o cursor, só sinaliza parar", () => {
    expect(nextOrdersCursor(TODAY, 2, 30, 2, TODAY)).toEqual({ day: TODAY, page: 1, stop: true });
  });

  it("HOJE com mais páginas -- avança só a página, sem parar", () => {
    expect(nextOrdersCursor(TODAY, 1, 100, 3, TODAY)).toEqual({ day: TODAY, page: 2, stop: false });
  });
});

describe("totvsHeaders", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.TOTVS_API_KEY = "test-api-key";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("sempre inclui a ApiKey", () => {
    expect(totvsHeaders().ApiKey).toBe("test-api-key");
  });

  it("não inclui Authorization sem usuário/senha do Basic Auth", () => {
    delete process.env.TOTVS_BASIC_AUTH_USER;
    delete process.env.TOTVS_BASIC_AUTH_PASSWORD;
    expect(totvsHeaders().Authorization).toBeUndefined();
  });

  it("codifica usuário/senha em Basic Auth quando presentes", () => {
    process.env.TOTVS_BASIC_AUTH_USER = "maia-api";
    process.env.TOTVS_BASIC_AUTH_PASSWORD = "!ok$$L8GR";
    const expected = `Basic ${Buffer.from("maia-api:!ok$$L8GR").toString("base64")}`;
    expect(totvsHeaders().Authorization).toBe(expected);
  });
});

describe("detectDeliveryRiskTrigger", () => {
  it("nada mudou -> sem gatilho", () => {
    const existing = [{ carga: "C1", tentativa: 1, status_entrega: "Programada" }];
    const incoming = [{ carga: "C1", tentativa: 1, statusEntrega: "Programada" }];
    expect(detectDeliveryRiskTrigger(existing, incoming)).toBeNull();
  });

  it("carga vira Cancelada -> gatilho", () => {
    const existing = [{ carga: "C1", tentativa: 1, status_entrega: "Programada" }];
    const incoming = [{ carga: "C1", tentativa: 1, statusEntrega: "Cancelada" }];
    expect(detectDeliveryRiskTrigger(existing, incoming)?.reason).toMatch(/cancelada/i);
  });

  it("já cancelada antes e continua cancelada -> sem gatilho novo", () => {
    const existing = [{ carga: "C1", tentativa: 1, status_entrega: "Cancelada" }];
    const incoming = [{ carga: "C1", tentativa: 1, statusEntrega: "Cancelada" }];
    expect(detectDeliveryRiskTrigger(existing, incoming)).toBeNull();
  });

  it("nova tentativa após tentativa anterior cancelada -> gatilho", () => {
    const existing = [{ carga: "C1", tentativa: 1, status_entrega: "Cancelada" }];
    const incoming = [
      { carga: "C1", tentativa: 1, statusEntrega: "Cancelada" },
      { carga: "C2", tentativa: 2, statusEntrega: "Programada" },
    ];
    expect(detectDeliveryRiskTrigger(existing, incoming)?.reason).toMatch(/nova tentativa/i);
  });

  it("nova tentativa após tentativa anterior bem-sucedida -> sem gatilho", () => {
    const existing = [{ carga: "C1", tentativa: 1, status_entrega: "Entregue" }];
    const incoming = [
      { carga: "C1", tentativa: 1, statusEntrega: "Entregue" },
      { carga: "C2", tentativa: 2, statusEntrega: "Programada" },
    ];
    expect(detectDeliveryRiskTrigger(existing, incoming)).toBeNull();
  });

  it("carga some do payload -> gatilho (pedido retirado da carga)", () => {
    const existing = [{ carga: "C1", tentativa: 1, status_entrega: "Programada" }];
    const incoming: { carga: string; tentativa?: number; statusEntrega?: string }[] = [];
    expect(detectDeliveryRiskTrigger(existing, incoming)?.reason).toMatch(/não aparece mais/i);
  });

  // Bug real em produção, achado 14/08/2026: pedido com uma carga já
  // entregue e OUTRA carga cancelada/retirada depois (duplicada/
  // administrativa) ficava preso em "alerta" pra sempre em
  // listEntregasEmRisco, porque o gatilho não considerava que o pedido já
  // tinha sido resolvido por outra carga.
  it("carga cancelada, mas outra carga do pedido já foi entregue -> sem gatilho", () => {
    const existing = [
      { carga: "C1", tentativa: 1, status_entrega: "Entregue" },
      { carga: "C2", tentativa: 2, status_entrega: "Programada" },
    ];
    const incoming = [
      { carga: "C1", tentativa: 1, statusEntrega: "Entregue" },
      { carga: "C2", tentativa: 2, statusEntrega: "Cancelada" },
    ];
    expect(detectDeliveryRiskTrigger(existing, incoming)).toBeNull();
  });

  it("carga some do payload, mas outra carga do pedido já foi entregue -> sem gatilho", () => {
    const existing = [
      { carga: "C1", tentativa: 1, status_entrega: "Entregue" },
      { carga: "C2", tentativa: 2, status_entrega: "Programada" },
    ];
    const incoming = [{ carga: "C1", tentativa: 1, statusEntrega: "Entregue" }];
    expect(detectDeliveryRiskTrigger(existing, incoming)).toBeNull();
  });
});
