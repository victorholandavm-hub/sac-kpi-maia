"use client";

import { useEffect, useState } from "react";
import { setSchedule, getAvailableRotasForDateAction } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { SHIFTS, type Shift } from "@/lib/serviceRequests";
import { JP_EXTRA_ROTA, ROTA_COLORS, ROTA_LABELS, labelAvailableRota, type Rota, type AvailableRota } from "@/lib/rotas";

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
      {/* "Rota extra" já é o nome inteiro (ver JP_EXTRA_ROTA em
          rotas.ts) -- sem isso virava "Rota Rota extra", duplicado. */}
      {rota ? (rota === JP_EXTRA_ROTA ? ROTA_LABELS[rota] : `Rota ${ROTA_LABELS[rota]}`) : "Sem rota"}
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
  urgent,
  rota,
  rotaExceptionNote,
  showRota,
  editButtonVariant = "link",
}: {
  requestId: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  shift: Shift | null;
  // Independente do turno desde 27/08/2026 (pedido do Victor) -- pode vir
  // junto de qualquer período, ou sozinho.
  urgent: boolean;
  rota: Rota | null;
  // Nota de encaixe fora da rota -- só existe em registros de antes
  // 18/08/2026 (ver setSchedule/actions.ts); fica só de leitura, não dá mais
  // pra criar uma nova (a escolha de rota já vem restrita às disponíveis).
  rotaExceptionNote: string | null;
  // Rota (praia/sul/centro) é só pro motorista de entrega/recolhimento --
  // montagem, desmontagem, vistoria e troca de peça são visita de montador
  // e não têm rota nenhuma (ver isDeliveryType em RequestDetailContent).
  showRota: boolean;
  // "link" (padrão) -- texto discreto sublinhado, do jeito que sempre foi,
  // pensado pra caber numa linha de tabela densa (AssistenciaQueueGroup,
  // DriverRouteGroup, NotificacoesList). "button" -- Guia de Componentes
  // Maia (Design System, 01/09/2026), pedido do Victor: "o botão editar
  // tem que ficar com cara de botão na cor verde escura padrão" -- usado
  // só na tela de detalhe do chamado (DeliveryRequestDetailContent), onde
  // tem espaço de sobra e o campo é claramente a ação principal do card,
  // não uma linha entre várias.
  editButtonVariant?: "link" | "button";
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(scheduledDate ?? "");
  const [time, setTime] = useState(formatTimeOnly(scheduledTime) ?? "");
  const [selectedShift, setSelectedShift] = useState<string>(shift ?? "");
  const [selectedUrgent, setSelectedUrgent] = useState<boolean>(urgent);
  // Duas coisas distintas: a ROTA escolhida (o que fica gravado em
  // service_requests.rota) e QUAL atribuição específica (id de
  // rota_driver_assignments) -- normalmente uma escolhe a outra sozinha,
  // mas quando tem uma rota extra igual à principal (ex.: dois carros na
  // rota Sul, motoristas diferentes), as duas opções têm a MESMA rota e só
  // o id diferencia qual motorista vai pro chamado. Selecionar pelo id (em
  // vez de só pela rota) é o que resolve o pedido do Victor 21/08/2026:
  // "quando eu preciso mudar uma notificação de um motorista para outro...
  // coloquei a mesma rota do dia, não apareceu a rota extra" -- antes elas
  // colidiam (mesma rota = mesma opção no select), agora cada atribuição é
  // uma opção própria.
  const [selectedRota, setSelectedRota] = useState<string>(rota ?? "");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
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
          // Id só é preenchido de novo se o que já estava selecionado sumiu
          // da lista nova (data mudou) -- senão mantém a escolha explícita
          // de qual atribuição (não só qual rota) a pessoa já tinha feito.
          setSelectedAssignmentId((prevId) => {
            if (prevId && rotas.some((r) => r.id === prevId)) return prevId;
            const targetRota = isOriginalAssignment ? rota : null;
            return rotas.find((r) => r.rota === targetRota)?.id ?? "";
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
      ? [...availableRotas, { id: "current", rota, driverName: null, isExtra: false }]
      : availableRotas
    : [];
  const effectiveLoadingRotas = hasDateContext && loadingRotas;
  const selectedAssignment = effectiveAvailableRotas.find((r) => r.id === selectedAssignmentId) ?? null;
  // Motorista da rota escolhida -- pedido do Victor 18/08/2026: "quando eu
  // escolho a rota, ele ja deve preencher o motorista daquela rota". Só
  // preview aqui (setSchedule já grava isso sozinho ao salvar, ver
  // actions.ts); não dá pra digitar/trocar nesse campo.
  const previewDriverName = selectedAssignment?.driverName ?? null;

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
          {urgent ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              URGENTE
            </span>
          ) : null}
          <button
            onClick={() => setEditing(true)}
            className={
              editButtonVariant === "button"
                ? "text-xs font-semibold rounded-lg px-3 py-1.5 text-white shadow-sm transition-all duration-200 hover:brightness-110"
                : "text-xs underline"
            }
            style={editButtonVariant === "button" ? { background: "#1B5E3C" } : { color: "var(--text-secondary)" }}
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
        <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
          <input
            type="checkbox"
            checked={selectedUrgent}
            onChange={(e) => setSelectedUrgent(e.target.checked)}
          />
          Urgente
        </label>
      </div>

      {showRota ? (
        <div className="flex items-center gap-2 flex-wrap">
          <RotaBadge rota={(selectedRota as Rota) || null} />
          <select
            value={selectedAssignmentId}
            onChange={(e) => {
              const id = e.target.value;
              const entry = effectiveAvailableRotas.find((r) => r.id === id);
              setSelectedAssignmentId(id);
              setSelectedRota(entry?.rota ?? "");
            }}
            disabled={!date || effectiveLoadingRotas}
            className="rounded border px-2 py-1 text-sm disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">Sem rota</option>
            {effectiveAvailableRotas.map((r) => (
              <option key={r.id} value={r.id}>
                {labelAvailableRota(effectiveAvailableRotas, r)}
                {r.driverName ? ` — ${r.driverName}` : ""}
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
              // driverName explícito (da atribuição escolhida, não
              // re-derivado da rota no servidor) -- é isso que permite
              // escolher a extra certa quando ela tem a mesma rota da
              // principal (ver comentário no estado selectedAssignmentId
              // acima).
              await setSchedule(requestId, date, selectedShift, time, selectedRota || undefined, selectedAssignment?.driverName ?? undefined, selectedUrgent);
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
            setSelectedUrgent(urgent);
            setSelectedRota(rota ?? "");
            setSelectedAssignmentId("");
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
