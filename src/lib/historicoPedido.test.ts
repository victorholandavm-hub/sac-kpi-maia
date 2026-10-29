import { describe, it, expect } from "vitest";
import { historicoOdoo, historicoProtheus, quandoLocal, quandoUtc } from "./historicoPedido";

describe("quando", () => {
  it("UTC do Odoo vira horário de Recife; data+hora do Protheus fica como está", () => {
    expect(quandoUtc("2026-10-26 15:36:38")).toBe("2026-10-26 12:36");
    expect(quandoLocal("2026-10-24", "10:47:00")).toBe("2026-10-24 10:47");
    expect(quandoLocal("2026-10-24", null)).toBe("2026-10-24");
    expect(quandoLocal("", "10:00")).toBeNull();
  });
});

describe("historicoProtheus", () => {
  it("venda, passos da carga com quem fez e a baixa, em ordem", () => {
    const h = historicoProtheus(
      { data: "2026-10-19", notaFiscal: "000024355", vendedor: "EMERSON" },
      [{ carga: "005575", tentativa: 1, motorista: "BRUNO THZ", comResultado: true, resultadoCodigo: "1", baixaDia: "2026-10-24", baixaHora: "10:43", ocorrencia: null }],
      new Map([
        [
          "005575",
          {
            carga: "005575", incluida_em: "2026-10-23", incluida_por: "johnnathas", separacao_em: "2026-10-23", separacao_hora: "16:02", separacao_por: "Johnnathas",
            faturada_em: "2026-10-23", faturada_hora: "17:30", faturada_por: "Adonis", liberada_em: "2026-10-24", liberada_hora: "07:50", em_rota_em: "2026-10-24", em_rota_hora: "08:10", conferente_nome: "DIEGO",
          },
        ],
      ])
    );
    expect(h.map((e) => `${e.quando} | ${e.texto} | ${e.quem ?? ""}`)).toEqual([
      "2026-10-19 | Venda — NF 24355 | EMERSON",
      "2026-10-23 | Incluído na carga 005575 (1ª tentativa) | johnnathas",
      "2026-10-23 16:02 | Separação da carga 005575 | Johnnathas",
      "2026-10-23 17:30 | Nota de entrega faturada (carga 005575) | Adonis",
      "2026-10-24 07:50 | Carga 005575 liberada — conferida por DIEGO | ",
      "2026-10-24 08:10 | Saiu em rota (carga 005575) | BRUNO THZ",
      "2026-10-24 10:43 | Entregue | BRUNO THZ",
    ]);
  });
  it("tentativa que voltou traz o motivo", () => {
    const h = historicoProtheus(null, [{ carga: "005518", tentativa: 1, motorista: "RONALDO", comResultado: true, resultadoCodigo: "3", baixaDia: "2026-10-21", baixaHora: "09:04", ocorrencia: "Cliente Ausente" }], new Map());
    expect(h).toEqual([{ quando: "2026-10-21 09:04", texto: "Não entregue (voltou) — Cliente Ausente", quem: "RONALDO", tom: "critico" }]);
  });
});

describe("historicoOdoo", () => {
  it("eventos da carga com quem fez; os da parada só deste pedido; passo antes da venda fora", () => {
    const h = historicoOdoo(
      { data: "2026-10-25 13:00:00", vendedor: "L17 · Joao Paulo", loja: "205" },
      [{ tipo: "5117", numero: "24538", data: "2026-10-26 18:00:00" }],
      [
        {
          romaneio: "ROM/2026/00066",
          motorista: "Douglas",
          acoes: [{ acao: "conferir", operador: "CD Eduardo", em: "2026-10-26T17:00:00Z" }],
          eventos: [
            { tipo: "conferida", em: "2026-10-26 17:00:00", picking: "" },
            { tipo: "separacao_iniciada", em: "2026-10-25 09:00:00", picking: "" },
            { tipo: "entregue", em: "2026-10-27 13:00:00", picking: "CD/OUT/1" },
            { tipo: "entregue", em: "2026-10-27 14:00:00", picking: "CD/OUT/9" },
            { tipo: "insucesso", em: "2026-10-27 12:00:00", picking: "", parada_id: 7 },
            { tipo: "insucesso", em: "2026-10-27 12:30:00", picking: "", parada_id: 8 },
          ],
        },
      ],
      { pickings: new Set(["CD/OUT/1"]), paradas: new Set([7]) }
    );
    expect(h.map((e) => `${e.quando} | ${e.texto} | ${e.quem ?? ""}`)).toEqual([
      "2026-10-25 10:00 | Venda — loja 205 | L17 · Joao Paulo",
      "2026-10-26 14:00 | Carga conferida — carga ROM/2026/00066 | Eduardo",
      "2026-10-26 15:00 | Nota de entrega 24538 emitida | ",
      "2026-10-27 09:00 | Não entregue — carga ROM/2026/00066 | Douglas",
      "2026-10-27 10:00 | Entregue — carga ROM/2026/00066 | Douglas",
    ]);
  });
});
