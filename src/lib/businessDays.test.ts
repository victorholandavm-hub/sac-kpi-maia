import { describe, it, expect } from "vitest";
import { isBusinessDay, addBusinessDays } from "./businessDays";

describe("isBusinessDay", () => {
  it("considera segunda a sexta como dia útil", () => {
    expect(isBusinessDay(new Date("2026-08-03T00:00:00Z"))).toBe(true); // segunda
    expect(isBusinessDay(new Date("2026-08-07T00:00:00Z"))).toBe(true); // sexta
  });

  it("não considera sábado/domingo dia útil", () => {
    expect(isBusinessDay(new Date("2026-08-01T00:00:00Z"))).toBe(false); // sábado
    expect(isBusinessDay(new Date("2026-08-02T00:00:00Z"))).toBe(false); // domingo
  });
});

describe("addBusinessDays", () => {
  it("soma dias úteis pulando o fim de semana", () => {
    // sexta 2026-07-31 + 1 dia útil = segunda 2026-08-03
    expect(addBusinessDays("2026-07-31", 1)).toBe("2026-08-03");
  });

  it("soma vários dias úteis cruzando um fim de semana no meio", () => {
    // quarta 2026-07-29 + 5 dias úteis (qui,sex,seg,ter,qua) = quarta 2026-08-05
    expect(addBusinessDays("2026-07-29", 5)).toBe("2026-08-05");
  });

  it("count=0 retorna a mesma data", () => {
    expect(addBusinessDays("2026-07-29", 0)).toBe("2026-07-29");
  });
});
