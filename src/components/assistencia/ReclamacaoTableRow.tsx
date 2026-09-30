"use client";

import { useState } from "react";
import Link from "next/link";
import { updateReclamacaoFieldAction } from "@/app/assistencia/reclamacoes-actions";
import { isStatusInternoResolvido, STATUS_INTERNO_OPTIONS } from "@/lib/reclamacoesLabels";
import type { Reclamacao } from "@/lib/reclamacoes";

const inputStyle = { borderColor: "var(--border)" };

// timestamptz (UTC) -> valor de <input type="datetime-local"> em horário de
// Brasília -- mesmo espelhamento de toDatetimeLocalValue em ReclamacaoForm.tsx.
function toDatetimeLocalValue(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

type SaveState = "idle" | "saving" | "saved" | "error";

// "Salvo"/erro desaparece sozinho -- não precisa de um "X" pra fechar numa
// tabela com várias linhas editáveis ao mesmo tempo.
const FEEDBACK_MS = 2000;

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="text-xs" style={{ color: "var(--text-muted)" }}>salvando…</span>;
  if (state === "saved") return <span className="text-xs" style={{ color: "var(--status-good)" }}>✓ salvo</span>;
  return <span className="text-xs" style={{ color: "var(--status-critical)" }}>não salvou</span>;
}

// Edição inline (pedido do Victor 29/09/2026): Status, Status externo e
// Audiência mudam direto na linha, com salvamento automático -- sem abrir
// o formulário inteiro (ReclamacaoForm.tsx) só pra isso. Nome/Órgão/CPF
// continuam só leitura aqui (mudam raramente, e errar o nome de alguém sem
// confirmação é mais arriscado que errar um status). Sem branch read-only
// -- admin e supervisao (Akyla Thais, edição total a partir de 29/09/2026)
// usam a mesma linha editável.
export function ReclamacaoTableRow({ reclamacao }: { reclamacao: Reclamacao }) {
  const [statusInterno, setStatusInterno] = useState(reclamacao.statusInterno);
  const [statusExterno, setStatusExterno] = useState(reclamacao.statusExterno ?? "");
  const [dataAudiencia, setDataAudiencia] = useState(reclamacao.dataAudiencia ? toDatetimeLocalValue(reclamacao.dataAudiencia) : "");

  const [statusState, setStatusState] = useState<SaveState>("idle");
  const [externoState, setExternoState] = useState<SaveState>("idle");
  const [audienciaState, setAudienciaState] = useState<SaveState>("idle");

  async function save(field: "statusInterno" | "statusExterno" | "dataAudiencia", value: string | null, setState: (s: SaveState) => void) {
    setState("saving");
    const result = await updateReclamacaoFieldAction(reclamacao.id, field, value);
    setState(result.error ? "error" : "saved");
    setTimeout(() => setState("idle"), FEEDBACK_MS);
  }

  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2">
        <Link href={`/assistencia/reclamacoes/${reclamacao.id}/editar`} className="underline" style={{ color: "var(--text-primary)" }}>
          {reclamacao.nome}
        </Link>
        {reclamacao.cpf ? (
          <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
            {reclamacao.cpf}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
        {reclamacao.orgao}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1 min-w-[11rem]">
          <select
            value={statusInterno}
            onChange={(e) => {
              const value = e.target.value;
              setStatusInterno(value);
              save("statusInterno", value, setStatusState);
            }}
            className="rounded border px-2 py-1 text-xs"
            style={{
              ...inputStyle,
              background: isStatusInternoResolvido(statusInterno) ? "var(--status-good)" : "var(--brand-orange)",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            {/* Cobre o caso de um valor histórico fora da lista padrão (ver
                comentário em reclamacoesLabels.ts -- não é enum fechado) --
                sem isso o select trocaria silenciosamente pro 1º item da
                lista ao renderizar. */}
            {!STATUS_INTERNO_OPTIONS.includes(statusInterno as (typeof STATUS_INTERNO_OPTIONS)[number]) ? (
              <option value={statusInterno}>{statusInterno}</option>
            ) : null}
            {STATUS_INTERNO_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <SaveIndicator state={statusState} />
        </div>
      </td>
      <td className="px-3 py-2 max-w-xs">
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={statusExterno}
            onChange={(e) => setStatusExterno(e.target.value)}
            onBlur={() => {
              if (statusExterno !== (reclamacao.statusExterno ?? "")) save("statusExterno", statusExterno || null, setExternoState);
            }}
            placeholder="Ex.: Audiência designada, Respondido…"
            className="rounded border px-2 py-1 text-sm"
            style={{ ...inputStyle, color: "var(--text-secondary)" }}
          />
          <SaveIndicator state={externoState} />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <input
            type="datetime-local"
            value={dataAudiencia}
            onChange={(e) => {
              const value = e.target.value;
              setDataAudiencia(value);
              save("dataAudiencia", value ? `${value}:00-03:00` : null, setAudienciaState);
            }}
            className="rounded border px-2 py-1 text-xs tabular-nums"
            style={inputStyle}
          />
          <SaveIndicator state={audienciaState} />
        </div>
      </td>
    </tr>
  );
}
