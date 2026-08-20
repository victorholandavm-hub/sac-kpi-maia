"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setDriverOrderAction, driverBulkSetRota, driverGetAvailableRotasForDate } from "@/app/assistencia/driver-actions";
import { SHIFT_LABELS, DRIVER_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { ROTA_LABELS, type AvailableRota } from "@/lib/rotas";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";
import { DriverNotificationModalButton } from "./DriverNotificationModalButton";
import { formatFullAddress, type DriverRequestView } from "@/lib/serviceRequests";
import { telHref, whatsappHref } from "@/lib/phone";

function mapsHref(item: DriverRequestView): string | null {
  const address = [formatFullAddress(item), item.clientNeighborhood].filter(Boolean).join(" — ");
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Lista reordenável: o motorista decide a própria sequência (ex.: seguir por
// bairro) com os botões ▲▼, vendo a posição atual (1, 2, 3...) de cada
// entrega ao lado -- reordena local na hora (resposta imediata) e grava em
// segundo plano via setDriverOrderAction. Só reorganiza dentro do próprio
// grupo (mesmo dia + mesma rota) que está sendo mostrado -- não mistura
// numa ordem global entre dias/rotas diferentes.
export function DriverRouteGroup({
  items,
  showCompleted,
  reorderable,
  showDriverName,
  canMoveRota,
}: {
  items: DriverRequestView[];
  showCompleted: boolean;
  reorderable: boolean;
  // Modo "ver todas as rotas" (DISPATCH_SUPERVISOR_DRIVERS) -- mostra de quem
  // é cada entrega, já que aqui não é sempre "a minha própria".
  showDriverName?: boolean;
  // Só o Everton (expedição) -- pedido do Victor 19/08/2026: "conseguir
  // trocar uma notificação de uma rota pra outra". Seleção fica dentro
  // deste grupo (mesma rota+dia); mover pra outra rota tira o item daqui na
  // próxima renderização (o servidor já refletiu, ver router.refresh()).
  canMoveRota?: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [saving, setSaving] = useState(false);
  const [syncedItems, setSyncedItems] = useState(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // A tela usa polling (RealtimeQueueRefresher, a cada 15s) pra trazer
  // chamado novo/status mudado -- sem isso, a lista congelava até o
  // motorista dar F5, porque o componente cliente não remonta quando o
  // Server Component pai recebe dados novos. Ajusta o estado durante a
  // renderização (padrão oficial do React pra isso, evita o ciclo extra de
  // um useEffect) sempre que o prop `items` mudar de fato -- e só quando não
  // há reordenação em voo, senão o poll pisaria na ordem otimista antes
  // dela ser persistida.
  if (items !== syncedItems && !saving) {
    setSyncedItems(items);
    setOrder(items);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const previous = order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setSaving(true);
    try {
      await setDriverOrderAction(next.map((r) => ({ id: r.id, expectedOrder: r.driverOrder })));
      // Reflete localmente o driver_order que acabou de ser gravado, senão o
      // próximo clique manda um "expectedOrder" desatualizado pro servidor.
      setOrder(next.map((r, i) => ({ ...r, driverOrder: i + 1 })));
    } catch {
      // Reverte pra ordem de antes deste clique (não pro snapshot do
      // carregamento da página) -- assim um clique que falhou não apaga uma
      // reordenação anterior que já tinha sido salva com sucesso.
      setOrder(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {canMoveRota && !showCompleted && selected.size > 0 ? (
        <MoveRotaBar
          selectedIds={[...selected]}
          count={selected.size}
          onDone={() => {
            setSelected(new Set());
            router.refresh();
          }}
          onCancel={() => setSelected(new Set())}
        />
      ) : null}
      <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
          {order.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2 p-4 flex-wrap">
            {canMoveRota && !showCompleted ? (
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleSelected(r.id)}
                className="rounded shrink-0"
                aria-label={`Selecionar #${r.ticketNumber}`}
              />
            ) : null}
            {reorderable ? (
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                  style={{ border: "2px solid var(--brand-green)", color: "var(--text-primary)" }}
                  aria-label={`Posição ${i + 1} na sequência`}
                >
                  {i + 1}
                </span>
                {order.length > 1 ? (
                  <div className="flex flex-col shrink-0">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || saving}
                      aria-label="Mover pra cima"
                      className="text-sm leading-none px-1 disabled:opacity-25"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === order.length - 1 || saving}
                      aria-label="Mover pra baixo"
                      className="text-sm leading-none px-1 disabled:opacity-25"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      ▼
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 flex-wrap flex-1 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    #{r.ticketNumber}
                  </span>
                  <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ color: "var(--text-primary)", background: "var(--surface-2)" }}
                  >
                    {DRIVER_TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  {r.exchangeRound > 1 ? (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: "#fff", background: "var(--status-warning)" }}
                    >
                      {r.exchangeRound}ª troca
                    </span>
                  ) : null}
                  {showDriverName ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-primary)", background: "var(--brand-green-soft)" }}
                    >
                      🚚 {r.driverName ?? "Sem motorista"}
                    </span>
                  ) : null}
                  {r.shift === "urgencia" ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: "#fff", background: "var(--status-critical)" }}>
                      Urgente!
                    </span>
                  ) : null}
                  {/* Recolhimento só existe pra troca_produto (recolhe o
                      errado + entrega o certo) -- entrega_produto e envio de
                      peça são entrega em etapa única, sem nada pra recolher
                      (mesma regra de MotoristaRequestActions.tsx). */}
                  {!showCompleted && r.type === "troca_produto" && !r.pickupCompleted ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
                    >
                      Recolher produto
                    </span>
                  ) : null}
                </div>
                <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {r.clientName ?? "Sem nome de cliente"}
                </p>
                {r.clientNeighborhood || mapsHref(r) ? (
                  <p className="text-xs font-medium flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-secondary)" }}>
                    {r.clientNeighborhood ? <span>📍 {r.clientNeighborhood}</span> : null}
                    {mapsHref(r) ? (
                      <a
                        href={mapsHref(r)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium rounded-full px-2.5 py-1"
                        style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
                      >
                        🗺️ Ver no mapa
                      </a>
                    ) : null}
                  </p>
                ) : null}
                {r.clientPhone ? (
                  <p className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
                    <a
                      href={telHref(r.clientPhone)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-medium rounded-full px-2.5 py-1"
                      style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
                    >
                      📞 {r.clientPhone}
                    </a>
                    <a
                      href={whatsappHref(r.clientPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-medium rounded-full px-2.5 py-1"
                      style={{ background: "color-mix(in srgb, #25d366 18%, transparent)", color: "#1da851" }}
                    >
                      💬 WhatsApp
                    </a>
                  </p>
                ) : null}
                {r.productSummary ? (
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {r.productSummary}
                  </p>
                ) : null}
                {r.scheduledDate ? (
                  <p className="text-xs font-medium" style={{ color: "var(--brand-green)" }}>
                    {formatDateOnly(r.scheduledDate)}
                    {r.scheduledTime ? ` às ${r.scheduledTime.slice(0, 5)}` : ""}
                    {r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
                  </p>
                ) : (r.approvedDeadline ?? r.requestedDeadline) ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Prazo: {formatDateOnly(r.approvedDeadline ?? r.requestedDeadline)}
                  </p>
                ) : null}
                {r.rotaExceptionNote ? (
                  <p className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                    ⚠ Fora da rota do dia: {r.rotaExceptionNote}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <DriverNotificationModalButton item={r} />
                <Link
                  href={`/assistencia/motorista/${r.id}`}
                  className="text-sm rounded-lg px-3 py-2 font-medium shrink-0"
                  style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
                >
                  Ver notificação
                </Link>
              </div>
            </div>
          </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoveRotaBar({
  selectedIds,
  count,
  onDone,
  onCancel,
}: {
  selectedIds: string[];
  count: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [rota, setRota] = useState("");
  const [availableRotas, setAvailableRotas] = useState<AvailableRota[]>([]);
  const [loadingRotas, setLoadingRotas] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errors: string[] } | null>(null);
  const hasDateContext = !!date;

  useEffect(() => {
    if (!hasDateContext) return;
    const timer = setTimeout(() => {
      setLoadingRotas(true);
      driverGetAvailableRotasForDate(date)
        .then((rotas) => {
          setAvailableRotas(rotas);
          setRota((prev) => (prev && !rotas.some((r) => r.rota === prev) ? "" : prev));
        })
        .catch(() => setAvailableRotas([]))
        .finally(() => setLoadingRotas(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [hasDateContext, date]);

  const effectiveAvailableRotas = hasDateContext ? availableRotas : [];

  async function apply() {
    setPending(true);
    setResult(null);
    try {
      const r = await driverBulkSetRota(selectedIds, date, rota);
      setResult(r);
      if (r.errors.length === 0) {
        setOpen(false);
        onDone();
      }
    } catch (e) {
      setResult({ successCount: 0, errors: [e instanceof Error ? e.message : "Erro inesperado."] });
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {count} selecionada{count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs rounded-full px-3 py-1.5 font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Mover pra outra rota
        </button>
        <button type="button" onClick={onCancel} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
          limpar seleção
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--brand-green)", background: "var(--surface-1)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        Mover {count} notificaç{count === 1 ? "ão" : "ões"} pra outra rota
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
        <select
          value={rota}
          onChange={(e) => setRota(e.target.value)}
          disabled={!date || loadingRotas}
          className="rounded border px-2 py-1 text-sm disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">Selecione a rota…</option>
          {effectiveAvailableRotas.map((r) => (
            <option key={r.rota} value={r.rota}>
              {ROTA_LABELS[r.rota]}
              {r.driverName ? ` — ${r.driverName}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !date || !rota}
          onClick={apply}
          className="text-xs rounded px-3 py-1.5 font-medium disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {pending ? "Aplicando…" : "Aplicar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
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
              {result.successCount} movida{result.successCount === 1 ? "" : "s"} com sucesso.
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
    </div>
  );
}
