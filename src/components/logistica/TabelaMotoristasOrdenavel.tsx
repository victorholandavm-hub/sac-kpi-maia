"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { StatusPill } from "@/components/KpiCardShell";
import { ThHint } from "./ThHint";
import { pct, VISITAS_MINIMAS, toneIndiceVolta } from "@/lib/logisticaFormat";
import type { MotoristaVolta } from "@/lib/kpisLogistica";

// Versão "order book" da tabela de Índice de Volta -- pedido do Victor
// 09/10/2026 (evolução do PR #584, estilo home broker): "ordenar
// instantaneamente por qualquer coluna". Client Component só por causa
// disso (estado de ordenação) -- o resto (dado, regras de negócio) é
// idêntico ao TabelaMotoristas anterior, só virou clicável.
type SortKey = "nome" | "cargas" | "visitas" | "insucessos" | "parciais" | "devolucoes" | "assistencias" | "indiceVolta" | "indiceVoltaLogistica";

const COLUNAS: { key: SortKey; label: React.ReactNode; hint?: string }[] = [
  { key: "cargas", label: "Cargas" },
  { key: "visitas", label: "Visitas" },
  { key: "insucessos", label: "Insucessos", hint: "Cliente / logística / CD (L06, pedido não carregado) / outros" },
  { key: "parciais", label: "Parciais" },
  { key: "devolucoes", label: "≈ Devoluções", hint: "Estimado pelo CPF (ver aviso acima)" },
  { key: "assistencias", label: "≈ Assistências", hint: "Pela carga do chamado ou estimado pelo CPF (ver aviso acima)" },
  { key: "indiceVolta", label: "Volta total", hint: "(insucessos + parciais + devoluções + assistências) ÷ visitas" },
  {
    key: "indiceVoltaLogistica",
    label: "Volta logística",
    hint: "(insucessos de logística, exceto L06 + assistências por erro do motorista ou avaria no transporte) ÷ visitas",
  },
];

function valorOrdenavel(m: MotoristaVolta, key: SortKey): number | string {
  switch (key) {
    case "nome":
      return m.nome ?? m.codigo;
    case "cargas":
      return m.cargas;
    case "visitas":
      return m.visitas;
    case "insucessos":
      return m.insucessos.total;
    case "parciais":
      return m.parciais;
    case "devolucoes":
      return m.devolucoes;
    case "assistencias":
      return m.assistencias.total;
    case "indiceVolta":
      return m.indiceVolta ?? -1;
    case "indiceVoltaLogistica":
      return m.indiceVoltaLogistica ?? -1;
  }
}

const th = "px-2 py-1.5 font-semibold whitespace-nowrap";
const thStyle = { color: "var(--text-secondary)" };

export function TabelaMotoristasOrdenavel({
  motoristas,
  filtroCodigo,
  onLimparFiltro,
}: {
  motoristas: MotoristaVolta[];
  // Código do motorista selecionado no Monitor de Cargas (coluna 1) --
  // filtra pra só essa linha, com um aviso pra limpar (ver
  // LogisticaTerminal.tsx, dono do estado de seleção).
  filtroCodigo: string | null;
  onLimparFiltro: () => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "indiceVolta", dir: "desc" });

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  const linhas = useMemo(() => {
    const base = filtroCodigo ? motoristas.filter((m) => m.codigo === filtroCodigo) : motoristas;
    const sorted = [...base].sort((a, b) => {
      const va = valorOrdenavel(a, sort.key);
      const vb = valorOrdenavel(b, sort.key);
      const cmp = typeof va === "string" || typeof vb === "string" ? String(va).localeCompare(String(vb), "pt-BR") : (va as number) - (vb as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [motoristas, filtroCodigo, sort]);

  if (motoristas.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma visita registrada no período.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtroCodigo ? (
        <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 self-start" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          Filtrado pela carga selecionada no monitor
          <button type="button" onClick={onLimparFiltro} className="flex items-center gap-0.5 font-semibold underline" style={{ color: "var(--text-primary)" }}>
            <X aria-hidden size={12} />
            limpar
          </button>
        </div>
      ) : null}
      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <th className={`${th} text-left`} style={thStyle}>
                <button type="button" onClick={() => toggleSort("nome")} className="inline-flex items-center gap-1">
                  Motorista
                  {sort.key === "nome" ? sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} style={{ color: "var(--text-muted)" }} />}
                </button>
              </th>
              {COLUNAS.map((c) => (
                <th key={c.key} className={`${th} text-right`} style={thStyle}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1">
                    {c.hint ? <ThHint hint={c.hint}>{c.label}</ThHint> : c.label}
                    {sort.key === c.key ? (
                      sort.dir === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )
                    ) : (
                      <ArrowUpDown size={12} style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => {
              const poucas = m.visitas < VISITAS_MINIMAS;
              return (
                <tr key={m.codigo} className="border-b" style={{ borderColor: "var(--border)", opacity: poucas ? 0.55 : 1 }}>
                  <td className="px-2 py-1.5">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {m.nome ?? "Sem nome"}
                    </span>
                    <span className="ml-2 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {m.codigo}
                      {poucas ? " · poucas visitas" : ""}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.cargas}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.visitas}</td>
                  <td
                    className="px-2 py-1.5 text-right tabular-nums font-semibold"
                    title={`Cliente ${m.insucessos.cliente} · logística ${m.insucessos.logistica} · CD ${m.insucessos.cd} · outros ${m.insucessos.outros}`}
                  >
                    {m.insucessos.total}
                    {m.insucessos.cd > 0 && (
                      <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
                        ({m.insucessos.cd} CD)
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.parciais}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.devolucoes}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold" title={`${m.assistencias.porCarga} pela carga do chamado · ${m.assistencias.porCpf} pelo CPF`}>
                    {m.assistencias.total}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <StatusPill label={pct(m.indiceVolta)} tone={toneIndiceVolta(m.indiceVolta)} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <StatusPill label={pct(m.indiceVoltaLogistica)} tone={toneIndiceVolta(m.indiceVoltaLogistica)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
