import { consultarCarga, type CargaConsulta, type ParadaComFotos } from "@/lib/consultaCarga";
import { ESTADO_CARGA_LABELS, RESULTADO_LABELS, TIPO_CARGA_LABELS, formatarDataHoraOdoo, formatarDiaIso, type EventoCarga } from "@/lib/odoo/logisticaTipos";

// Carga do Odoo dentro da consulta de pedido (busca "ROM/2026/00058" ou link
// da tentativa) -- Victor 26/10/2026. Ver consultaCarga.ts.

const EVENTO_LABELS: Record<string, string> = {
  separacao_iniciada: "Separação iniciada",
  conferida: "Conferida",
  liberada: "Liberada (motorista + veículo)",
  saiu_em_rota: "Saiu em rota",
  chegada: "Motorista chegou no cliente",
  entregue: "Entregue",
  entrega_parcial: "Entrega parcial",
  insucesso: "Não entregue",
  reagendada: "Reagendada",
  fim_de_rota: "Fim de rota",
};

const COR_RESULTADO: Record<string, string> = {
  entregue: "var(--status-good)",
  entrega_parcial: "var(--status-warning)",
  insucesso: "var(--status-critical)",
  reagendada: "var(--status-warning)",
};

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {rotulo}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {valor}
      </span>
    </div>
  );
}

// Evento do Odoo ↔ ação gravada pela tela de Logística (odoo_carga_acoes).
const ACAO_DO_EVENTO: Record<string, string> = {
  separacao_iniciada: "separacao",
  conferida: "conferir",
  liberada: "liberar",
  saiu_em_rota: "sair",
  fim_de_rota: "finalizar",
};

function Evento({ e, quem }: { e: EventoCarga; quem?: string }) {
  return (
    <li className="text-sm pl-3 py-0.5" style={{ borderLeft: "2px solid var(--brand-green)" }}>
      <b style={{ color: "var(--text-primary)" }}>{EVENTO_LABELS[e.tipo] ?? e.tipo.replace(/_/g, " ")}</b>{" "}
      <span style={{ color: "var(--text-secondary)" }}>
        {formatarDataHoraOdoo(e.em)}
        {e.picking ? ` · ${e.picking}` : ""}
        {e.motivo ? ` · ${e.motivo}` : ""}
        {quem ? ` · por ${quem}` : ""}
      </span>
    </li>
  );
}

function Parada({ p }: { p: ParadaComFotos }) {
  const cor = p.resultado ? COR_RESULTADO[p.resultado] : "var(--text-muted)";
  return (
    <li className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5" style={{ background: "var(--surface-2)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {p.seq}. {p.cliente}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, color: "var(--text-primary)" }}
        >
          <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
          {p.resultado ? RESULTADO_LABELS[p.resultado] : "Sem baixa"}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {p.endereco}
        {p.pickings.length ? ` · pedido ${[...new Set(p.pickings.map((k) => k.pedido))].join(", ")}` : ""}
      </p>
      {p.fotos.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {p.fotos.map((f) => (
            <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="Foto da entrega" loading="lazy" className="w-20 h-20 object-cover rounded-lg" />
            </a>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function Carga({ c }: { c: CargaConsulta }) {
  const conferida = c.eventos.find((e) => e.tipo === "conferida");
  const quem = (acao: string | undefined) => (acao ? [...c.acoes].reverse().find((a) => a.acao === acao)?.operador : undefined);
  const conferente = quem("conferir");
  const eventos = [...c.eventos].sort((a, b) => String(a.em || "").localeCompare(String(b.em || "")));
  return (
    <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-5" style={{ background: "var(--surface-1)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            Carga {c.romaneio}
          </span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {TIPO_CARGA_LABELS[c.tipo] ?? c.tipo} · {c.empresa ?? ""} · prevista {formatarDiaIso(c.data_prevista)}
          </span>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          {c.cancelada ? "Cancelada" : ESTADO_CARGA_LABELS[c.estado] ?? c.estado}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Dado rotulo="Motorista" valor={c.motorista || "—"} />
        <Dado rotulo="Veículo" valor={c.veiculo || "—"} />
        <Dado rotulo="Ajudantes" valor={c.ajudantes?.length ? c.ajudantes.join(", ") : "—"} />
        <Dado
          rotulo="Conferência"
          valor={
            conferida ? (
              <>
                {formatarDataHoraOdoo(conferida.em)}
                <span className="block text-xs" style={{ color: conferente ? "var(--text-secondary)" : "var(--text-muted)" }}>
                  {conferente ? `por ${conferente}` : "conferente não registrado (cargas até 26/10)"}
                </span>
              </>
            ) : (
              "Ainda não conferida"
            )
          }
        />
        {c.transportadora ? <Dado rotulo="Transportadora" valor={c.transportadora} /> : null}
        <Dado rotulo="Saiu em rota" valor={formatarDataHoraOdoo(c.saiu_em)} />
        <Dado rotulo="Fim de rota" valor={formatarDataHoraOdoo(c.fim_rota_em)} />
        <Dado rotulo="Paradas / pedidos" valor={`${c.qtd_paradas} / ${c.qtd_pedidos}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Histórico
          </span>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Criada {formatarDataHoraOdoo(c.criada_em)} · liberada {formatarDataHoraOdoo(c.liberada_em)}
          </p>
          <ol className="flex flex-col gap-1">
            {eventos.length === 0 ? (
              <li className="text-sm" style={{ color: "var(--text-muted)" }}>
                Sem eventos ainda.
              </li>
            ) : (
              eventos.map((e) => <Evento key={e.id} e={e} quem={quem(ACAO_DO_EVENTO[e.tipo])} />)
            )}
          </ol>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Paradas
          </span>
          <ol className="flex flex-col gap-2">
            {c.paradas.map((p) => (
              <Parada key={p.parada_id} p={p} />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export async function ConsultaCargaView({ busca }: { busca: string }) {
  const r = await consultarCarga(busca);
  if (r.erro) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {r.erro}
      </p>
    );
  }
  if (!r.carga) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma carga do Odoo com o romaneio “{busca}” nos últimos 120 dias. Carga do Protheus (até 24/10) aparece dentro do pedido.
      </p>
    );
  }
  return <Carga c={r.carga} />;
}
