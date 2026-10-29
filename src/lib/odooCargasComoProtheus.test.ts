import { describe, it, expect } from "vitest";
import { cargaComoProtheus, casarMotorista, diaHoraRecife, motivoComoProtheus, placaDoVeiculo, transportadoraComoProtheus } from "./odooCargasComoProtheus";
import type { CargaDetalhe } from "./odoo/logisticaTipos";

const motoristas = [
  { codigo: "000010", nome: "JOALISON FERREIRA (AIAM EXPRESSO)", transportadora: "TRANSP. LOJAS MAIA" },
  { codigo: "000003", nome: "RONALDO ALVES PEREIRA", transportadora: "RONALDO TRANSPORTES" },
];

const carga = (o: Partial<CargaDetalhe>): CargaDetalhe =>
  ({
    carga_id: 108, company_id: 13, empresa: "213 CD", romaneio: "ROM/2026/00094", tipo: "entrega", estado: "finalizada", cancelada: false,
    data_prevista: "2026-10-29", saiu_em: "2026-10-28 21:08:11", fim_rota_em: "2026-10-29 14:20:44", criada_em: "2026-10-27 15:59:26",
    motorista: "Ronaldo Alves Pereira", motorista_id: 35, veiculo: "Volkswagen/8.150E DELIVERY/NHX4E86", transportadora: "", zona: "Orla e Cabedelo", descricao: "",
    paradas: [
      { parada_id: 1, seq: 1, seq_executada: 1, cliente: "CLIENTE A", cliente_id: 10, endereco: "", telefone: "", resultado: "entregue", tempo_min: 5,
        pickings: [{ picking_id: 1, nome: "CD/OUT/1", pedido: "S1", estado: "done", nf5117: "22242/1", itens: [{ codigo: "070830", nome: "COLCHAO", qtd: 1 }] } as never] },
      { parada_id: 2, seq: 2, seq_executada: 2, cliente: "CLIENTE B", cliente_id: 11, endereco: "", telefone: "", resultado: "insucesso", tempo_min: 5,
        pickings: [{ picking_id: 2, nome: "CD/OUT/2", pedido: "S2", estado: "done", itens: [] }] },
    ],
    eventos: [
      { id: 1, tipo: "entregue", em: "2026-10-29 12:53:23", origem: "app", parada_id: 1, picking: "", motorista: "", motivo: "", prova: false, lat: false, lng: false },
      { id: 2, tipo: "insucesso", em: "2026-10-29 13:10:00", origem: "app", parada_id: 2, picking: "", motorista: "", motivo: "Cliente ausente", prova: false, lat: false, lng: false },
    ],
    ...o,
  }) as unknown as CargaDetalhe;

describe("cargas do Odoo no formato do Protheus", () => {
  it("entregue e não entregue com motivo, motorista do Protheus, placa e nota", () => {
    const { entregas, cargas } = cargaComoProtheus(carga({}), motoristas);
    expect(entregas.map((e) => [e.pedido, e.filialPadrao, e.statusAtual])).toEqual([["ODOO-S1", "213", "Entregue"], ["ODOO-S2", "213", "Não Entregue"]]);
    expect(cargas[0]).toMatchObject({
      carga: "ROM/2026/00094", dt_previsao: "2026-10-29", tipo_entrega: "Entrega", status_carga_codigo: "6", status_origem: "ENTREGA", status_entrega_codigo: "1",
      motorista_codigo: "000003", transportadora: "RONALDO TRANSPORTES", veiculo: "NHX4E86", regiao: "Orla e Cabedelo", nota_fiscal: "22242", serie: "1",
      dt_retorno: "2026-10-29", hr_retorno: "09:53",
    });
    expect(cargas[0].itens).toEqual([{ produto: "070830", descricao: "COLCHAO", quantidade: 1 }]);
    expect(cargas[1]).toMatchObject({ status_entrega_codigo: "3", ocorrencia_codigo: "C01", ocorrencia_descricao: "Cliente Ausente", hr_retorno: "10:10" });
  });
  it("carga ainda no CD fica como CARGA, sem baixa", () => {
    const { cargas } = cargaComoProtheus(carga({ estado: "separacao" }), motoristas);
    expect(cargas[0]).toMatchObject({ status_origem: "CARGA", status_carga_codigo: "1", status_entrega_codigo: "1", status_entrega: "Em Separação", dt_retorno: null });
  });
  it("abastecimento e cancelada não entram; retirada vira Retirada", () => {
    expect(cargaComoProtheus(carga({ tipo: "abastecimento" }), motoristas).cargas).toHaveLength(0);
    expect(cargaComoProtheus(carga({ cancelada: true }), motoristas).cargas).toHaveLength(0);
    expect(cargaComoProtheus(carga({ tipo: "retira_agendada" }), motoristas).cargas[0].tipo_entrega).toBe("Retirada");
  });
  it("auxiliares", () => {
    expect(casarMotorista("Joalison Ferreira", 37, motoristas)?.codigo).toBe("000010");
    expect(casarMotorista("Jardel", 31, motoristas)?.codigo).toBe("O31");
    expect(casarMotorista("Ronaldo", 35, motoristas)?.codigo).toBe("000003");
    expect(transportadoraComoProtheus("Lojsmaia")).toBe("TRANSP. LOJAS MAIA");
    expect(transportadoraComoProtheus("D&A")).toBe("TRANSP. D&A");
    expect(transportadoraComoProtheus("")).toBeNull();
    expect(motivoComoProtheus("Não saiu do CD (carregado por engano)")?.codigo).toBe("L06");
    expect(motivoComoProtheus("Endereço não encontrado")?.codigo).toBe("C04");
    expect(motivoComoProtheus("outro motivo qualquer")).toMatchObject({ codigo: "X99", descricao: "outro motivo qualquer" });
    expect(placaDoVeiculo("Fiat/STRADA ENDURAN CS13/TPA9E78")).toBe("TPA9E78");
    expect(diaHoraRecife("2026-10-29 02:30:00")).toEqual(["2026-10-28", "23:30"]);
  });
});
