import { describe, it, expect } from "vitest";
import { calcularNivel } from "./clientes";

describe("calcularNivel", () => {
  it("sem compra nenhuma -> sem_compra", () => {
    expect(calcularNivel(0, 0, null)).toBe("sem_compra");
  });

  it("1ª compra, menos de 6 meses -> bronze", () => {
    expect(calcularNivel(1, 800, 2)).toBe("bronze");
  });

  it("2+ compras -> prata", () => {
    expect(calcularNivel(2, 800, 1)).toBe("prata");
  });

  it("6-12 meses de relacionamento, mesmo com 1 compra só -> prata", () => {
    expect(calcularNivel(1, 800, 8)).toBe("prata");
  });

  it("gasto acumulado entre 1.500 e 5.000 -> prata", () => {
    expect(calcularNivel(1, 2000, 1)).toBe("prata");
  });

  it("3+ compras -> ouro", () => {
    expect(calcularNivel(3, 800, 1)).toBe("ouro");
  });

  it("12-24 meses com recompra confirmada (2+ compras) -> ouro", () => {
    expect(calcularNivel(2, 800, 18)).toBe("ouro");
  });

  it("12-24 meses mas SEM recompra (só 1 compra) -> não é ouro por esse critério (cai pra prata pelo tempo)", () => {
    // 12-24 meses de relacionamento também bate no critério de Prata
    // ("6-12 meses" não bate, mas o critério de Ouro exige recompra) --
    // sem recompra, fica em Prata só pelo tempo não servir de Ouro; aqui
    // o gasto/compras também não empurram pra Prata, então cai em bronze.
    expect(calcularNivel(1, 800, 18)).toBe("bronze");
  });

  it("gasto acumulado entre 5.000 e 10.000 -> ouro", () => {
    expect(calcularNivel(1, 7000, 1)).toBe("ouro");
  });

  it("gasto acumulado acima de 10.000 -> diamante", () => {
    expect(calcularNivel(1, 15000, 1)).toBe("diamante");
  });

  it("24+ meses com 2+ recompras (3+ compras) -> diamante", () => {
    expect(calcularNivel(3, 800, 30)).toBe("diamante");
  });

  it("24+ meses mas só 1 recompra (2 compras) -> não é diamante por esse critério, mas bate ouro (12-24... não, é 24+, então cai por 3+ compras não bate, mas o critério de ouro de tempo é só até 24) -- cai em prata pelas 2 compras", () => {
    expect(calcularNivel(2, 800, 30)).toBe("prata");
  });
});
