import { describe, it, expect } from "vitest";
import { grupoProduto } from "./grupoProduto";

describe("grupoProduto", () => {
  it.each([
    "COLCHAO CAMOMILE 36CMX1,98MX1,58M FLOWERS - 925",
    "[12345] Colchão Orquídea D20",
    "BOX 138X188X30 VOGA PRETO",
    "BASE BOX CASAL",
    "BAÚ CASAL SUEDE",
    "SOFÁ 3 LUGARES RETRATIL",
    "POLTRONA DECORATIVA",
    "CABECEIRA ESTOFADA QUEEN",
    "PUFF REDONDO",
  ])("%s é estofado", (nome) => expect(grupoProduto(nome)).toBe("estofados"));

  it.each(["GUARDA ROUPA 6 PORTAS", "RACK PARA TV 1,80", "BASE PARA TV", "CAMA CASAL MDF", "COZINHA COMPACTA", "BAUZINHO"])(
    "%s é madeira",
    (nome) => expect(grupoProduto(nome)).toBe("madeiras"),
  );
});
