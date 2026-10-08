import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { PeriodoKpis } from "@/lib/logisticaApi";

// Formato devolvido pela RPC kpis_logistica (migração 0157) -- o mesmo
// JSON do GET /api/logistica/v1/kpis/logistica (schema KpisLogistica do
// openapi.yaml em lojas-maia-integracao/apis/logistica-v1).
export type VolumesPorte = { P: number; M: number; G: number; naoClassificado: number };

export type CargaKpi = {
  carga: string;
  dia: string;
  tipo: string | null;
  veiculo: string | null;
  // "placa" | "motorista" (carga sem placa, motorista fixo de um Carro) | "padrao"
  tipoVeiculo: string;
  tipoVeiculoOrigem: string;
  motorista: { codigo: string; nome: string | null } | null;
  pedidos: number;
  entregues: number;
  parciais: number;
  naoEntregues: number;
  canceladas: number;
  volumes: VolumesPorte;
};

export type MotoristaVolta = {
  codigo: string;
  nome: string | null;
  cargas: number;
  visitas: number;
  entregues: number;
  entregasRealizadas: number;
  insucessos: { total: number; cliente: number; logistica: number; cd: number; outros: number };
  parciais: number;
  devolucoes: number;
  assistencias: { total: number; porCarga: number; porCpf: number; transporte: number };
  pecas: { total: number; porNf: number; porCliente: number };
  indiceVolta: number | null;
  indiceVoltaLogistica: number | null;
  indicePecas: number | null;
};

export type KpisLogistica = {
  periodo: { de: string; ate: string; tipo: string | null; tipoVeiculo: string | null };
  cargasPorDia: { dia: string; cargas: number; pedidos: number }[];
  cargas: CargaKpi[];
  motoristas: MotoristaVolta[];
  pecasPeriodo: { total: number; vinculadas: number };
};

// Lida direto no servidor (tela /kpis/logistica e a rota da API) -- a
// X-API-Key só protege a rota HTTP para consumidores de fora; aqui o
// service_role já fica no servidor e nada chega ao navegador.
export async function getKpisLogistica({ de, ate, tipo, tipoVeiculo }: PeriodoKpis): Promise<KpisLogistica> {
  const { data, error } = await getSupabaseAdmin().rpc("kpis_logistica", {
    p_de: de,
    p_ate: ate,
    p_tipo: tipo,
    p_tipo_veiculo: tipoVeiculo,
  });
  if (error) throw new Error(`kpis_logistica: ${error.message}`);
  return data as KpisLogistica;
}

export type ResumoLogistica = {
  cargas: number;
  dias: number;
  pedidos: number;
  volumes: VolumesPorte & { total: number };
  visitas: number;
  entregues: number;
  indiceVolta: number | null;
  indiceVoltaLogistica: number | null;
  insucessosCd: number;
  entregasRealizadas: number;
  pecas: number;
  indicePecas: number | null;
};

export function resumirLogistica(k: KpisLogistica): ResumoLogistica {
  const volumes = { P: 0, M: 0, G: 0, naoClassificado: 0 };
  for (const c of k.cargas) {
    volumes.P += c.volumes.P;
    volumes.M += c.volumes.M;
    volumes.G += c.volumes.G;
    volumes.naoClassificado += c.volumes.naoClassificado;
  }
  let visitas = 0;
  let entregues = 0;
  let voltas = 0;
  let voltasLogistica = 0;
  let insucessosCd = 0;
  let entregasRealizadas = 0;
  let pecas = 0;
  for (const m of k.motoristas) {
    entregasRealizadas += m.entregasRealizadas;
    pecas += m.pecas.total;
    visitas += m.visitas;
    entregues += m.entregues;
    voltas += m.insucessos.total + m.parciais + m.devolucoes + m.assistencias.total;
    voltasLogistica += m.insucessos.logistica + m.assistencias.transporte;
    insucessosCd += m.insucessos.cd;
  }
  return {
    cargas: k.cargas.length,
    dias: k.cargasPorDia.length,
    pedidos: k.cargas.reduce((s, c) => s + c.pedidos, 0),
    volumes: { ...volumes, total: volumes.P + volumes.M + volumes.G + volumes.naoClassificado },
    visitas,
    entregues,
    indiceVolta: visitas > 0 ? voltas / visitas : null,
    indiceVoltaLogistica: visitas > 0 ? voltasLogistica / visitas : null,
    insucessosCd,
    entregasRealizadas,
    pecas,
    indicePecas: entregasRealizadas > 0 ? pecas / entregasRealizadas : null,
  };
}

export type VolumeDia = { dia: string; cargas: number } & VolumesPorte;

export function volumesPorDia(k: KpisLogistica): VolumeDia[] {
  const porDia = new Map<string, VolumeDia>();
  for (const c of k.cargas) {
    const d = porDia.get(c.dia) ?? { dia: c.dia, cargas: 0, P: 0, M: 0, G: 0, naoClassificado: 0 };
    d.cargas += 1;
    d.P += c.volumes.P;
    d.M += c.volumes.M;
    d.G += c.volumes.G;
    d.naoClassificado += c.volumes.naoClassificado;
    porDia.set(c.dia, d);
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

export type ResumoVeiculo = { tipoVeiculo: string; cargas: number; pedidos: number; pedidosPorCarga: number; unidadesPorCarga: number };

export function resumoPorVeiculo(k: KpisLogistica): ResumoVeiculo[] {
  const porTipo = new Map<string, { cargas: number; pedidos: number; unidades: number }>();
  for (const c of k.cargas) {
    const t = porTipo.get(c.tipoVeiculo) ?? { cargas: 0, pedidos: 0, unidades: 0 };
    t.cargas += 1;
    t.pedidos += c.pedidos;
    t.unidades += c.volumes.P + c.volumes.M + c.volumes.G + c.volumes.naoClassificado;
    porTipo.set(c.tipoVeiculo, t);
  }
  return [...porTipo.entries()]
    .map(([tipoVeiculo, t]) => ({
      tipoVeiculo,
      cargas: t.cargas,
      pedidos: t.pedidos,
      pedidosPorCarga: t.pedidos / t.cargas,
      unidadesPorCarga: t.unidades / t.cargas,
    }))
    .sort((a, b) => a.tipoVeiculo.localeCompare(b.tipoVeiculo, "pt-BR"));
}
