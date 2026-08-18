"use client";

import { useEffect, useState } from "react";
import { setSchedule, getAvailableRotasForDateAction } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { SHIFTS, type Shift } from "@/lib/serviceRequests";
import { ROTA_LABELS, ROTA_COLORS, type Rota, type AvailableRota } from "@/lib/rotas";

// Selo colorido de rota -- igual ao usado no painel "Motorista do dia"
// (RotaMotoristaDoDia). Pedido do Victor 18/08/2026: a rota do chamado
// ficava só um texto pequeno grudado no fim da linha de data/turno, fácil
// de passar despercebido; agora é a primeira coisa que aparece, com cor
// própria por região.
export function RotaBadge({ rota }: { rota: Rota | null }) {
  return (
    <span
      className="text-xs font-medium rounded-full px-2 py-1 shrink-0"
      style={{ background: rota ? ROTA_COLORS[rota] : "var(--surface-2)", color: rota ? "#fff" : "var(--text-muted)" }}
    >
      {rota ? `Rota ${ROTA_LABELS[rota]}` : "Sem rota"}
    </span>
  );
}

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatTimeOnly(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

export function ScheduleField({
  requestId,
  scheduledDate,
  scheduledTime,
  shift,
  rota,
  rotaExceptionNote,
  showRota,
}: {
  requestId: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  shift: Shift | null;
  rota: Rota | null;
  // Nota de encaixe fora da rota -- só existe em registros de antes
  // 18/08/2026 (ver setSchedule/actions.ts); fica só de leitura, não dá mais
  // pra criar uma nova (a escolha de rota já vem restrita às disponíveis).
  rotaExceptionNote: string | null;
  // Rota (praia/sul/centro) é só pro motorista de entrega/recolhimento --
  // montagem, desmontagem, vistoria e troca de peça são visita de montador
  // e não têm rota nenhuma (ver isDeliveryType em RequestDetailContent).
  showRota: boolean;
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(scheduledDate ?? "");
  const [time, setTime] = useState(formatTimeOnly(scheduledTime) ?? "");
  const [selectedShift, setSelectedShift] = useState<string>(shift ?? "");
  const [selectedRota, setSelectedRota] = useState<string>(rota ?? "");
  // Rota só pode ser uma das disponíveis pra data escolhida (pedido do
  // Victor 18/08/2026) -- busca de novo toda vez que a data muda, em vez de
  // deixar escolher livre entre praia/sul/centro com aviso de exceção
  // depois (ver getAvailableRotasForDate em rotas.ts). Mesmo desenho do
  // getDayLoadAction em QuickCreateRequestForm.tsx: setState só dentro do
  // timer, nunca síncrono no corpo do efeito (regra do React Compiler).
  const [availableRotas, setAvailableRotas] = useState<AvailableRota[]>([]);
  const [loadingRotas, setLoadingRotas] = useState(false);
  const hasDateContext = editing && showRota && !!date;

  useEffect(() => {
    if (!hasDateContext) {
      return;
    }
    const timer = setTimeout(() => {
      setLoadingRotas(true);
      getAvailableRotasForDateAction(date)
        .then((rotas) => {
          setAvailableRotas(rotas);
          // Rota que tinha sido escolhida pode não valer mais pra data nova
          // -- nunca deixa uma rota fora da lista disponível "presa" no
          // select. EXCETO a rota que o chamado já tinha pra ESSA MESMA data
          // (bug achado 18/08/2026: chamado com rota "praia" numa terça, cujo
          // padrão da semana é "sul" -- sem essa exceção, só abrir "editar" e
          // salvar qualquer outro campo (turno, hora) apagava a rota
          // sozinho, porque "praia" não estava na lista de disponíveis
          // daquela data e o select resetava pra vazio).
          const isOriginalAssignment = date === scheduledDate && rota;
          setSelectedRota((prev) => {
            if (prev === rota && isOriginalAssignment) return prev;
            return prev && !rotas.some((r) => r.rota === prev) ? "" : prev;
          });
        })
        .catch(() => setAvailableRotas([]))
        .finally(() => setLoadingRotas(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [hasDateContext, date, scheduledDate, rota]);

  // Mesma exceção acima, refletida na lista mostrada no <select> -- a rota
  // original do chamado sempre aparece como opção enquanto a data não mudar,
  // mesmo que "oficialmente" não esteja mais disponível pra esse dia.
  const effectiveAvailableRotas = hasDateContext
    ? date === scheduledDate && rota && !availableRotas.some((r) => r.rota === rota)
      ? [...availableRotas, { rota, driverName: null }]
      : availableRotas
    : [];
  const effectiveLoadingRotas = hasDateContext && loadingRotas;
  // Motorista da rota escolhida -- pedido do Victor 18/08/2026: "quando eu
  // escolho a rota, ele ja deve preencher o motorista daquela rota". Só
  // preview aqui (setSchedule já grava isso sozinho ao salvar, ver
  // actions.ts); não dá pra digitar/trocar nesse campo.
  const previewDriverName = effectiveAvailableRotas.find((r) => r.rota === selectedRota)?.driverName ?? null;

  if (!editing) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Visita agendada
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {showRota ? <RotaBadge rota={rota} /> : null}
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {scheduledDate
              ? `${formatDateOnly(scheduledDate)}${formatTimeOnly(scheduledTime) ? ` às ${formatTimeOnly(scheduledTime)}` : ""}${shift ? ` · ${SHIFT_LABELS[shift]}` : ""}`
              : "Não agendada"}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            {scheduledDate ? "editar" : "agendar"}
          </button>
        </div>
        {showRota && rotaExceptionNote ? (
          <span className="text-xs" style={{ color: "var(--status-warning)" }}>
            Fora da rota do dia: {rotaExceptionNote}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Visita agendada
      </span>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <select
          value={selectedShift}
          onChange={(e) => setSelectedShift(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">Sem turno</option>
          {SHIFTS.map((s) => (
            <option key={s} value={s}>
              {SHIFT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {showRota ? (
        <div className="flex items-center gap-2 flex-wrap">
          <RotaBadge rota={(selectedRota as Rota) || null} />
          <select
            value={selectedRota}
            onChange={(e) => setSelectedRota(e.target.value)}
            disabled={!date || effectiveLoadingRotas}
            className="rounded border px-2 py-1 text-sm disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">Sem rota</option>
            {effectiveAvailableRotas.map((r) => (
              <option key={r.rota} value={r.rota}>
                {ROTA_LABELS[r.rota]}
              </option>
            ))}
          </select>
          {!date ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Escolha a data pra ver as rotas disponíveis.
            </span>
          ) : effectiveLoadingRotas ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Carregando rotas…
            </span>
          ) : effectiveAvailableRotas.length === 0 ? (
            <span className="text-xs" style={{ color: "var(--status-warning)" }}>
              Nenhuma rota disponível pra essa data.
            </span>
          ) : selectedRota ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Motorista: {previewDriverName ?? "nenhum escolhido ainda"}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() => {
            run(async () => {
              await setSchedule(requestId, date, selectedShift, time, selectedRota || undefined);
              setEditing(false);
            }, "Agenda atualizada.");
          }}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setDate(scheduledDate ?? "");
            setTime(formatTimeOnly(scheduledTime) ?? "");
            setSelectedShift(shift ?? "");
            setSelectedRota(rota ?? "");
            setEditing(false);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
    </div>
  );
}
