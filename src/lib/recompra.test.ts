import { describe, it, expect } from "vitest";
import { inferCategoriaCiclo, calcularSegmento } from "./recompra";

describe("inferCategoriaCiclo", () => {
  it("reconhece colchão", () => {
    expect(inferCategoriaCiclo("COLCHAO ORQUIDEA D20 LISO 12CMX1,88MX88CM")?.key).toBe("colchao");
  });

  it("protetor de colchão vira categoria própria, não colchão -- keyword mais específica vence", () => {
    expect(inferCategoriaCiclo("PROTETOR DE COLCHAO POLIESTER BEDS 140X190X40CM")?.key).toBe("protetor");
  });

  it("reconhece box", () => {
    expect(inferCategoriaCiclo("BOX 138X188X30 OXFORD PRETO")?.key).toBe("colchao");
  });

  it("reconhece roupeiro/multi-uso", () => {
    expect(inferCategoriaCiclo("MULTI-USO VALDEMOVEIS NATAL S/ CHAVE - CIN")?.key).toBe("roupeiro");
  });

  it("reconhece travesseiro", () => {
    expect(inferCategoriaCiclo("TRAV ORTOBOM AMORE 50X70")?.key).toBe("travesseiro");
  });

  it("descrição sem categoria cíclica reconhecida retorna null", () => {
    expect(inferCategoriaCiclo("FRETE")).toBeNull();
  });

  it("descrição nula retorna null", () => {
    expect(inferCategoriaCiclo(null)).toBeNull();
  });
});

describe("calcularSegmento", () => {
  it("na janela + atrito baixo -> contato direto", () => {
    expect(calcularSegmento(true, false)).toBe("contato_direto");
  });

  it("na janela + atrito alto -> reparar antes", () => {
    expect(calcularSegmento(true, true)).toBe("reparar_antes");
  });

  it("fora da janela + atrito baixo -> nutrir", () => {
    expect(calcularSegmento(false, false)).toBe("nutrir");
  });

  it("fora da janela + atrito alto -> não é lead", () => {
    expect(calcularSegmento(false, true)).toBe("nao_e_lead");
  });
});
