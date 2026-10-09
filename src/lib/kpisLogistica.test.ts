import { describe, expect, it } from "vitest";
import {
  calcularVariacao,
  periodoAnterior,
  resumirLogistica,
  resumoPorVeiculo,
  volumesPorDia,
  type CargaKpi,
  type KpisLogistica,
  type MotoristaVolta,
} from "./kpisLogistica";

function carga(carga: string, dia: string, P: number, M: number, G: number, naoClassificado = 0, tipoVeiculo = "Caminhão"): CargaKpi {
  return {
    carga, dia, tipo: "Entrega", veiculo: null, tipoVeiculo, tipoVeiculoOrigem: "placa", motorista: null,
    pedidos: 2, entregues: 2, parciais: 0, naoEntregues: 0, canceladas: 0,
    volumes: { P, M, G, naoClassificado },
  };
}

function motorista(visitas: number, entregues: number, extra: Partial<MotoristaVolta> = {}): MotoristaVolta {
  return {
    codigo: "1", nome: "X", cargas: 1, visitas, entregues, entregasRealizadas: entregues,
    insucessos: { total: 0, cliente: 0, logistica: 0, cd: 0, outros: 0 },
    parciais: 0, devolucoes: 0,
    assistencias: { total: 0, porCarga: 0, porCpf: 0, transporte: 0 },
    pecas: { total: 0, porNf: 0, porCliente: 0 },
    posVenda: { total: 0, pecas: 0, trocaProduto: 0, recolhimento: 0, entregaProduto: 0, porCarga: 0, porNf: 0, porCliente: 0 },
    indiceVolta: null, indiceVoltaLogistica: null, indicePecas: null, indiceAssistencia: null,
    ...extra,
  };
}

const base: KpisLogistica = {
  periodo: { de: "2026-10-01", ate: "2026-10-02", tipo: null, tipoVeiculo: null },
  cargasPorDia: [{ dia: "2026-10-01", cargas: 2, pedidos: 4 }, { dia: "2026-10-02", cargas: 1, pedidos: 2 }],
  cargas: [carga("A", "2026-10-02", 1, 0, 3), carga("B", "2026-10-01", 2, 1, 0, 1), carga("C", "2026-10-01", 0, 2, 2, 0, "Carro")],
  motoristas: [
    motorista(80, 60, {
      insucessos: { total: 10, cliente: 7, logistica: 1, cd: 2, outros: 0 },
      parciais: 2, devolucoes: 3,
      assistencias: { total: 5, porCarga: 1, porCpf: 4, transporte: 1 },
      pecas: { total: 3, porNf: 2, porCliente: 1 },
      posVenda: { total: 7, pecas: 3, trocaProduto: 2, recolhimento: 1, entregaProduto: 1, porCarga: 1, porNf: 2, porCliente: 4 },
    }),
    motorista(20, 20, { pecas: { total: 1, porNf: 1, porCliente: 0 } }),
  ],
  pecasPeriodo: { total: 6, vinculadas: 4 },
  posVendaPeriodo: { total: 10, vinculadas: 7, pecas: 4, trocaProduto: 3, recolhimento: 2, entregaProduto: 1 },
};

describe("resumirLogistica", () => {
  it("soma volumes, pedidos e calcula os índices ponderados por visita", () => {
    const r = resumirLogistica(base);
    expect(r).toMatchObject({ cargas: 3, dias: 2, pedidos: 6, visitas: 100, entregues: 80, insucessosCd: 2 });
    expect(r.volumes).toEqual({ P: 3, M: 3, G: 5, naoClassificado: 1, total: 12 });
    expect(r.indiceVolta).toBeCloseTo(20 / 100);
    expect(r.indiceVoltaLogistica).toBeCloseTo(2 / 100);
    expect(r).toMatchObject({ entregasRealizadas: 80, pecas: 4 });
    expect(r.indicePecas).toBeCloseTo(4 / 80);
    expect(r.posVenda).toEqual({ total: 7, pecas: 3, trocaProduto: 2, recolhimento: 1, entregaProduto: 1 });
    expect(r.indiceAssistencia).toBeCloseTo(7 / 80);
    // Soma das causas bate com o numerador de indiceVolta (20/100 acima).
    expect(r.causasVolta).toEqual({
      insucessoCliente: 7,
      insucessoLogistica: 1,
      insucessoCd: 2,
      insucessoOutros: 0,
      parciais: 2,
      devolucoes: 3,
      assistencias: 5,
    });
  });

  it("sem visitas, índices nulos em vez de divisão por zero", () => {
    const r = resumirLogistica({ ...base, motoristas: [] });
    expect(r.indiceVolta).toBeNull();
    expect(r.indiceVoltaLogistica).toBeNull();
    expect(r.indicePecas).toBeNull();
    expect(r.indiceAssistencia).toBeNull();
  });
});

describe("volumesPorDia", () => {
  it("agrupa as cargas por dia, em ordem crescente", () => {
    expect(volumesPorDia(base)).toEqual([
      { dia: "2026-10-01", cargas: 2, P: 2, M: 3, G: 2, naoClassificado: 1 },
      { dia: "2026-10-02", cargas: 1, P: 1, M: 0, G: 3, naoClassificado: 0 },
    ]);
  });
});

describe("periodoAnterior", () => {
  it("devolve o período imediatamente anterior, com a mesma duração", () => {
    expect(periodoAnterior("2026-10-01", "2026-10-09")).toEqual({ de: "2026-09-22", ate: "2026-09-30" });
  });

  it("funciona pra 1 dia só", () => {
    expect(periodoAnterior("2026-10-05", "2026-10-05")).toEqual({ de: "2026-10-04", ate: "2026-10-04" });
  });

  it("atravessa virada de mês/ano corretamente", () => {
    expect(periodoAnterior("2026-01-01", "2026-01-03")).toEqual({ de: "2025-12-29", ate: "2025-12-31" });
  });
});

describe("calcularVariacao", () => {
  it("índice de volta caiu (menor é melhor) -- melhorou", () => {
    const v = calcularVariacao(0.1, 0.15, true);
    expect(v).toMatchObject({ atual: 0.1, anterior: 0.15, melhorou: true });
    expect(v.delta).toBeCloseTo(-0.05);
  });

  it("índice de volta subiu (menor é melhor) -- piorou", () => {
    const v = calcularVariacao(0.21, 0.19, true);
    expect(v).toMatchObject({ atual: 0.21, anterior: 0.19, melhorou: false });
    expect(v.delta).toBeCloseTo(0.02);
  });

  it("contagem bruta (cargas) sobe -- sem julgamento de melhor/pior", () => {
    expect(calcularVariacao(296, 284)).toEqual({ atual: 296, anterior: 284, delta: 12, melhorou: null });
  });

  it("sem período anterior pra comparar -- delta e melhorou nulos", () => {
    expect(calcularVariacao(0.1, null, true)).toEqual({ atual: 0.1, anterior: null, delta: null, melhorou: null });
  });
});

describe("resumoPorVeiculo", () => {
  it("separa Carro e Caminhão com pedidos e unidades por carga", () => {
    expect(resumoPorVeiculo(base)).toEqual([
      { tipoVeiculo: "Caminhão", cargas: 2, pedidos: 4, pedidosPorCarga: 2, unidadesPorCarga: 4 },
      { tipoVeiculo: "Carro", cargas: 1, pedidos: 2, pedidosPorCarga: 2, unidadesPorCarga: 4 },
    ]);
  });
});
