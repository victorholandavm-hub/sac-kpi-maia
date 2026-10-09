"use client";

import { useState } from "react";
import { CargasMonitor } from "./CargasMonitor";
import { VolumePorteChart } from "./VolumePorteChart";
import { CausasVoltaChart } from "./CausasVoltaChart";
import { TabelaMotoristasOrdenavel } from "./TabelaMotoristasOrdenavel";
import { ThHint } from "./ThHint";
import { VISITAS_MINIMAS } from "@/lib/logisticaFormat";
import type { CargaKpi, MotoristaVolta, CausasVolta, VolumeDia } from "@/lib/kpisLogistica";

// Densidade alta (pedido do Victor 09/10/2026, 2ª rodada de refino:
// "p-1.5, space-y-1, text-xs... remova todo texto cinza explicativo
// renderizado direto na tela"): título com ícone "?" (ThHint) quando tem
// explicação -- nunca mais um parágrafo de texto solto ocupando espaço
// vertical. O texto completo continua acessível (tooltip nativo), só não
// fica mais sempre visível.
function Secao({ titulo, hint, children }: { titulo: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-2.5 flex flex-col gap-2 min-w-0" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
      <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
        {hint ? <ThHint hint={hint}>{titulo}</ThHint> : titulo}
      </h2>
      {children}
    </section>
  );
}

// "Terminal" de logística -- evolução (pedido do Victor 09/10/2026) do
// redesenho anterior (PR #584), estilo home broker: grid de 3 colunas
// (Monitor de Cargas / Volume por Dia / Causas da Volta) + tabela de
// motoristas ordenável e filtrável clicando numa carga. Client Component
// só por causa do estado de seleção compartilhado entre o Monitor
// (coluna 1) e a tabela (abaixo) -- o resto (cálculo, regra de negócio)
// é idêntico ao que já existia, só reorganizado.
//
// Substitui, nessa página: os 2 Blocos "Causas da Volta"/"Volume por
// porte" de antes + a tabela `<details>` "Ver as N cargas" (o Monitor de
// Cargas cobre o mesmo propósito de navegar pelas cargas, com o adicional
// de filtrar a tabela ao clicar) + o Bloco "Índice de Volta por
// motorista" + o aviso de atribuição estimada (AvisoAtribuicao.tsx,
// removido 09/10/2026 -- texto virou o hint do título dessa seção).
export function LogisticaTerminal({
  cargas,
  motoristas,
  porDia,
  causasVolta,
}: {
  cargas: CargaKpi[];
  motoristas: MotoristaVolta[];
  porDia: VolumeDia[];
  causasVolta: CausasVolta;
}) {
  const [selecionado, setSelecionado] = useState<{ codigo: string; nome: string | null } | null>(null);

  function handleSelect(c: CargaKpi) {
    if (!c.motorista) return;
    const codigo = c.motorista.codigo;
    const nome = c.motorista.nome;
    setSelecionado((prev) => (prev?.codigo === codigo ? null : { codigo, nome }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <Secao titulo="Monitor de Cargas" hint="Clique numa carga pra filtrar a tabela de motoristas abaixo pelo motorista dela. Clique de novo pra limpar.">
          <CargasMonitor cargas={cargas} selecionada={selecionado?.codigo ?? null} onSelect={handleSelect} />
        </Secao>
        <Secao titulo="Volume por porte (P/M/G)" hint="Unidades despachadas por dia, agrupadas por porte do produto.">
          <VolumePorteChart data={porDia} />
        </Secao>
        <Secao titulo="Causas da Volta" hint="Distribuição do que compõe o Índice de Volta, por motivo -- a soma das barras é o mesmo numerador.">
          <CausasVoltaChart causas={causasVolta} />
        </Secao>
      </div>

      <Secao
        titulo="Índice de Volta por motorista"
        hint={`Denominador: visitas (cada passagem de um pedido numa carga com resultado). Motoristas com menos de ${VISITAS_MINIMAS} visitas aparecem apagados. Clique num cabeçalho pra ordenar. Devoluções e assistências (≈) não dizem qual entrega originou o retorno -- são ligadas ao motorista da entrega mais recente ao mesmo CPF nos 30 dias anteriores, ou pela carga informada no chamado quando existe.`}
      >
        <TabelaMotoristasOrdenavel motoristas={motoristas} filtroCodigo={selecionado?.codigo ?? null} onLimparFiltro={() => setSelecionado(null)} />
      </Secao>
    </div>
  );
}
