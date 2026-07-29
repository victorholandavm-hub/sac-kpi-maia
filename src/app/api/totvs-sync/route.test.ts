import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ddmmyyyyToIso, isoDate, totvsHeaders } from "./route";

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
