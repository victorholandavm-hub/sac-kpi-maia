"use client";

import { useEffect, useState } from "react";
import { bulkSetRotaAction, getAvailableRotasForDateAction } from "@/app/assistencia/actions";
import { ROTA_LABELS, type AvailableRota } from "@/lib/rotas";

// A lista de notificações que morava aqui (NotificacoesList, com seu
// próprio agrupamento por data+rota) foi removida em 24/08/2026 -- achado
// do Victor: "a tela de notificação de assistencia do sac deve ser igual
// a de admin, hoje nao está... as notificações de hoje, ta contando 11 e
// na minha tela de admin mostra 16". Era uma cópia paralela da mesma
// lógica de fila/page.tsx (aba Entregas) que foi divergindo aos poucos até
// contar diferente -- a tela do SAC (assistencia/sac/notificacoes/page.tsx)
// agora usa exatamente o mesmo agrupamento/renderização do admin (ver
// src/lib/entregaQueueGrouping.ts e EntregasGroupsList.tsx), sem cópia
// nenhuma. Só BulkRotaBar continua aqui -- é compartilhado de verdade
// (usado tanto pela tela do SAC quanto pela aba Entregas do admin via
// AssistenciaQueueGroup.tsx), não duplicado.
export function BulkRotaBar({
  selectedIds,
  count,
  onDone,
  onPartialProgress,
  onCancel,
}: {
  selectedIds: string[];
  count: number;
  onDone: () => void;
  // Chamado quando algum item deu certo mas nem todos (ver errors abaixo)
  // -- só atualiza a lista por trás (rota já aparece nos que funcionaram),
  // sem fechar o painel nem limpar a seleção, pra quem tá aplicando
  // continuar vendo os erros e decidir o que fazer com eles.
  onPartialProgress: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  // Id da atribuição escolhida, não só a rota -- pedido do Victor
  // 21/08/2026: precisa diferenciar duas atribuições com a MESMA rota
  // (principal + extra, motoristas diferentes), mesmo problema e mesma
  // solução de ScheduleField.tsx.
  const [assignmentId, setAssignmentId] = useState("");
  const [availableRotas, setAvailableRotas] = useState<AvailableRota[]>([]);
  const [loadingRotas, setLoadingRotas] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errors: string[] } | null>(null);

  const hasDateContext = !!date;

  useEffect(() => {
    if (!hasDateContext) return;
    const timer = setTimeout(() => {
      setLoadingRotas(true);
      getAvailableRotasForDateAction(date)
        .then((rotas) => {
          setAvailableRotas(rotas);
          setAssignmentId((prev) => (prev && !rotas.some((r) => r.id === prev) ? "" : prev));
        })
        .catch(() => setAvailableRotas([]))
        .finally(() => setLoadingRotas(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [hasDateContext, date]);

  // Sem data ainda, não mostra rota nenhuma (mesmo se `availableRotas` tiver
  // ficado com um valor antigo de uma data anterior) -- mesmo desenho do
  // ScheduleField.tsx, evita limpar o state direto no corpo do efeito.
  const effectiveAvailableRotas = hasDateContext ? availableRotas : [];
  const selectedAssignment = effectiveAvailableRotas.find((r) => r.id === assignmentId) ?? null;

  async function apply() {
    if (!selectedAssignment) return;
    setPending(true);
    setResult(null);
    try {
      const r = await bulkSetRotaAction(selectedIds, date, selectedAssignment.rota, selectedAssignment.driverName ?? undefined);
      setResult(r);
      if (r.errors.length === 0) {
        setOpen(false);
        onDone();
      } else if (r.successCount > 0) {
        onPartialProgress();
      }
    } catch (e) {
      setResult({ successCount: 0, errors: [e instanceof Error ? e.message : "Erro inesperado."] });
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs rounded-full px-3 py-1.5 font-medium whitespace-nowrap"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Mover {count} selecionado{count === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={onCancel} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
          limpar seleção
        </button>
      </div>
    );
  }

  // Modal, não painel expandido inline -- pedido do Victor 21/08/2026:
  // "Crie um modal direto para transferência em bloco com dois seletores
  // encadeados: Selecione a Nova Data -> Selecione a Rota de Destino".
  // Os dois campos já eram encadeados de verdade (a rota só aparece
  // depois de escolher a data, ver efeito acima) -- só o container que
  // virou overlay centralizado em vez de caixa inline.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "color-mix(in srgb, black 55%, transparent)" }}>
      <div
        className="flex flex-col gap-3 rounded-lg border p-4 w-full max-w-sm"
        style={{ borderColor: "var(--brand-green)", background: "var(--surface-1)" }}
      >
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Mover {count} solicitaç{count === 1 ? "ão" : "ões"}
        </span>

        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          1. Nova data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--border)" }}
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          2. Rota de destino
          <select
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            disabled={!date || loadingRotas}
            className="rounded border px-2 py-1.5 text-sm disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">{date ? "Selecione a rota…" : "Escolha a data primeiro"}</option>
            {effectiveAvailableRotas.map((r) => (
              <option key={r.id} value={r.id}>
                {ROTA_LABELS[r.rota]}
                {r.isExtra ? " (extra)" : ""}
                {r.driverName ? ` — ${r.driverName}` : ""}
              </option>
            ))}
          </select>
        </label>

        {!date ? null : loadingRotas ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Carregando rotas…
          </span>
        ) : effectiveAvailableRotas.length === 0 ? (
          <span className="text-xs" style={{ color: "var(--status-warning)" }}>
            Nenhuma rota disponível pra essa data.
          </span>
        ) : null}

        {result ? (
          <div className="flex flex-col gap-1">
            {result.successCount > 0 ? (
              <span className="text-xs" style={{ color: "var(--status-good)" }}>
                {result.successCount} atualizada{result.successCount === 1 ? "" : "s"} com sucesso.
              </span>
            ) : null}
            {result.errors.length > 0 ? (
              <div className="text-xs" style={{ color: "var(--status-critical)" }}>
                {result.errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={pending || !date || !selectedAssignment}
            onClick={apply}
            className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            {pending ? "Movendo…" : `Mover ${count} selecionado${count === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setResult(null);
            }}
            className="text-sm underline"
            style={{ color: "var(--text-secondary)" }}
          >
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
