"use client";

import { useState } from "react";
import type { CargaManifesto, MdfeAbertoPlaca, MdfeCarga, NotaCarga } from "@/lib/odoo/logistica";
import { acaoMdfeAction, cancelarMdfeDocAction, encerrarMdfeDocAction, notasDaCargaAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { Chip, botaoClass, botaoPrimarioStyle, botaoStyle, botaoPerigoStyle } from "./ui";

const ESTADO: Record<string, string> = { liberada: "liberada", em_rota: "em rota", finalizada: "finalizada" };
const TIPO: Record<string, string> = { entrega: "entrega", abastecimento: "abastecimento de loja", retira_agendada: "retirada" };
const SIT_MDFE: Record<string, string> = { autorizada: "autorizado", encerrada: "encerrado", cancelada: "cancelado", rejeitada: "rejeitado", a_enviar: "não enviado", em_digitacao: "em digitação" };

function situacao(m: MdfeCarga) {
  if (!m) return <Chip>sem manifesto</Chip>;
  if (m.estado === "autorizada" && m.encerrado) return <Chip>MDF-e {m.numero}/{m.serie} · encerrado</Chip>;
  const ok = m.estado === "autorizada";
  return <Chip cor={ok ? "var(--status-ok, #1B7E3B)" : m.estado === "rejeitada" ? "var(--status-critical)" : undefined}>MDF-e {m.numero}/{m.serie} · {SIT_MDFE[m.estado] ?? m.estado}</Chip>;
}

// data do servidor vem em UTC ("2026-10-28 19:01:28")
function quando(s?: string | null) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
// a SEFAZ só cancela o manifesto até 24 h depois de autorizado; depois disso, só encerrar
function passou24h(s?: string | null) {
  if (!s) return false;
  const t = new Date(s.replace(" ", "T") + "Z").getTime();
  return Number.isFinite(t) && Date.now() - t > 24 * 3600 * 1000;
}

type Run = ReturnType<typeof useAcaoOdoo>["run"];

function pedirCancelamento(numero: string): string | null {
  const j = prompt(`Motivo do cancelamento do manifesto nº ${numero} (mínimo 15 letras):`, "Emitir um manifesto só com todas as cargas do caminhão");
  if (j === null) return null;
  const t = j.replace(/\s+/g, " ").trim();
  if (t.length < 15) { alert("O motivo precisa ter pelo menos 15 letras. Nada foi cancelado."); return null; }
  if (!confirm(`Cancelar o manifesto nº ${numero}? Ele é cancelado na SEFAZ e não tem volta.`)) return null;
  return t;
}

// botões encerrar/cancelar de um MDF-e (da própria carga ou de outra carga do mesmo caminhão)
function BotoesMdfe({ docId, numero, autorizadoEm, romaneio, pending, run, onFeito }: {
  docId: number; numero: string; autorizadoEm?: string | null; romaneio: string; pending: boolean; run: Run; onFeito: (acao: "encerrado" | "cancelado") => void;
}) {
  const velho = passou24h(autorizadoEm);
  return (
    <>
      <button type="button" disabled={pending} className={botaoClass} style={botaoPerigoStyle}
        onClick={() => { if (!confirm(`Encerrar o manifesto nº ${numero} (carga ${romaneio})? Faça isso quando o caminhão terminar a viagem dessa carga.`)) return;
          run(() => encerrarMdfeDocAction(docId), `Manifesto nº ${numero} encerrado.`, () => onFeito("encerrado")); }}>
        {pending ? "Enviando…" : `Encerrar MDF-e nº ${numero}`}
      </button>
      <button type="button" disabled={pending || velho} className={botaoClass} style={botaoStyle}
        title={velho ? "Passou de 24 h da autorização: a SEFAZ não deixa mais cancelar, só encerrar." : undefined}
        onClick={() => { const j = pedirCancelamento(numero); if (!j) return;
          run(() => cancelarMdfeDocAction(docId, j), `Manifesto nº ${numero} cancelado.`, () => onFeito("cancelado")); }}>
        {pending ? "Enviando…" : `Cancelar MDF-e nº ${numero}`}
      </button>
      {velho ? <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Autorizado há mais de 24 h: só dá para encerrar.</span> : null}
    </>
  );
}

function AvisoPlaca({ a, placa, pending, run, onFeito }: { a: NonNullable<MdfeAbertoPlaca>; placa: string; pending: boolean; run: Run; onFeito: () => void }) {
  return (
    <div className="rounded-lg border-2 p-2 text-sm flex flex-col gap-2" style={{ borderColor: "var(--status-critical)", color: "var(--text-primary)" }}>
      <div>
        <b style={{ color: "var(--status-critical)" }}>⚠ Caminhão {placa} já tem MDF-e nº {a.numero} aberto</b> (carga {a.romaneio}, {a.estado_carga}
        {a.autorizado_em ? `, autorizado em ${quando(a.autorizado_em)}` : ""}). Encerre quando a viagem acabar, ou cancele para emitir um só com todas as cargas.
        {" "}Enquanto ele estiver aberto, a SEFAZ recusa outro manifesto para este caminhão.
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <BotoesMdfe docId={a.doc_id} numero={a.numero} autorizadoEm={a.autorizado_em} romaneio={a.romaneio} pending={pending} run={run} onFeito={() => onFeito()} />
      </div>
    </div>
  );
}

function Carga({ c }: { c: CargaManifesto }) {
  const { pending, run } = useAcaoOdoo();
  const [aberta, setAberta] = useState(false);
  const [notas, setNotas] = useState<NotaCarga[] | null>(c.notas);
  const [faltas, setFaltas] = useState<string[]>(c.faltas);
  const [mdfe, setMdfe] = useState<MdfeCarga>(c.mdfe);
  const [aberto, setAberto] = useState<MdfeAbertoPlaca>(c.mdfe_aberto_placa ?? null);
  const placa = c.placa || (c.veiculo || "").split("/").pop() || "";
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const saiu = c.estado === "em_rota" || c.estado === "finalizada";
  const prot = c.romaneio.startsWith("PROT/");

  async function abrir() {
    setAberta((a) => !a);
    if (notas !== null || !saiu) return;
    setCarregando(true); setErro("");
    const r = await notasDaCargaAction(c.carga_id);
    setCarregando(false);
    if (r.ok && r.dados) { setNotas(r.dados.notas); setFaltas(r.dados.faltas); setMdfe(r.dados.mdfe); } else if (!r.ok) setErro(r.erro);
  }

  const n5152 = (notas ?? []).filter((n) => n.tipo === "5152");
  const nCli = (notas ?? []).filter((n) => n.tipo !== "5152");
  const podeEmitir = saiu && !prot && !aberto && faltas.length === 0 && (!mdfe || (mdfe.estado !== "autorizada" && mdfe.estado !== "encerrada"));
  const meuAberto = !!mdfe && mdfe.estado === "autorizada" && !mdfe.encerrado;

  return (
    <div className="cartao p-3 flex flex-col gap-2 min-w-0">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <button type="button" onClick={abrir} className="text-left flex flex-col" style={{ color: "var(--text-primary)" }}>
          <span className="font-bold">{aberta ? "▾" : "▸"} {c.romaneio} <span className="text-sm font-normal" style={{ color: "var(--text-secondary)" }}>· {TIPO[c.tipo] ?? c.tipo} · {ESTADO[c.estado] ?? c.estado}</span></span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Motorista: {c.motorista || "—"} · Veículo: {c.veiculo || "—"}</span>
        </button>
        <div className="flex gap-2 items-center flex-wrap">{situacao(mdfe)}{aberto ? <Chip cor="var(--status-critical)">caminhão com MDF-e aberto</Chip> : null}{faltas.length ? <Chip cor="var(--status-critical)">falta cadastro</Chip> : null}</div>
      </div>
      {aberto && !prot ? <AvisoPlaca a={aberto} placa={placa} pending={pending} run={run} onFeito={() => setAberto(null)} /> : null}
      {aberta ? (
        <div className="flex flex-col gap-2">
          {!saiu ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>A carga ainda não saiu em rota: as notas e o manifesto só existem depois de &quot;Sair em rota&quot;.</p> : null}
          {carregando ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Lendo as notas da carga…</p> : null}
          {erro ? <p className="text-sm" style={{ color: "var(--status-critical)" }}>{erro}</p> : null}
          {faltas.length ? (
            <div className="rounded-lg border p-2 text-sm" style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}>
              <b>Para emitir o manifesto falta:</b>
              <ul className="list-disc pl-5">{faltas.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
          ) : null}
          {notas && notas.length ? (
            <div className="text-sm flex flex-col gap-1" style={{ color: "var(--text-primary)" }}>
              {n5152.length ? <div><b>Transferência (todos os produtos do caminhão):</b> {n5152.map((n) => `NF ${n.numero}`).join(", ")}</div> : null}
              {nCli.length ? <div><b>Notas dos clientes ({nCli.length}):</b> {nCli.map((n) => `${n.tipo} ${n.numero} · ${n.cliente}`).join(" · ")}</div> : null}
            </div>
          ) : saiu && !carregando && notas ? <p className="text-sm">Nenhuma nota encontrada nesta carga.</p> : null}
          <div className="flex gap-2 flex-wrap">
            {saiu ? (
              <button type="button" className={botaoClass} style={botaoStyle} onClick={() => window.open(`/assistencia/logistica/pdf/danfes/${c.carga_id}`, "_blank")}>
                🖨 Imprimir todas as notas (transferência + clientes)
              </button>
            ) : null}
            {saiu && !prot ? (
              <button type="button" disabled={pending || !podeEmitir} className={botaoClass} style={botaoPrimarioStyle}
                onClick={() => { if (!confirm(`Emitir o manifesto (MDF-e) da carga ${c.romaneio}? Ele vai para a SEFAZ.`)) return;
                  run(() => acaoMdfeAction(c.carga_id, "emitir"), (d) => `Manifesto ${String(d.numero ?? "")} ${String(d.estado ?? d.situacao ?? "")}`.trim(),
                    (d) => setMdfe({ numero: String(d.numero ?? ""), serie: String(d.serie ?? ""), chave: String(d.chave ?? ""), estado: String(d.estado ?? "autorizada") })); }}>
                {pending ? "Enviando…" : "Emitir manifesto"}
              </button>
            ) : null}
            {mdfe ? (
              <>
                <button type="button" className={botaoClass} style={botaoStyle} onClick={() => window.open(`/assistencia/logistica/pdf/damdfe/${c.carga_id}`, "_blank")}>🖨 Imprimir DAMDFE</button>
                <button type="button" disabled={pending} className={botaoClass} style={botaoStyle} onClick={() => run(() => acaoMdfeAction(c.carga_id, "consultar"), "Situação atualizada.")}>Consultar situação</button>
                {meuAberto && mdfe.doc_id ? (
                  <BotoesMdfe docId={mdfe.doc_id} numero={mdfe.numero} autorizadoEm={mdfe.autorizado_em} romaneio={c.romaneio} pending={pending} run={run}
                    onFeito={(a) => setMdfe(a === "encerrado" ? { ...mdfe, encerrado: true } : { ...mdfe, estado: "cancelada" })} />
                ) : meuAberto ? (
                  <button type="button" disabled={pending} className={botaoClass} style={botaoPerigoStyle}
                    onClick={() => { if (!confirm(`Encerrar o manifesto da carga ${c.romaneio}? Faça isso quando o caminhão terminar a viagem.`)) return;
                      run(() => acaoMdfeAction(c.carga_id, "encerrar"), "Manifesto encerrado.", () => setMdfe({ ...mdfe, encerrado: true })); }}>
                    Encerrar manifesto
                  </button>
                ) : null}
              </>
            ) : null}
            {prot ? <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Carga do sistema antigo: o manifesto dela é feito no sistema antigo.</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ManifestoBoard({ cargas }: { cargas: CargaManifesto[] }) {
  if (!cargas.length) return <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Nenhuma carga liberada, em rota ou finalizada nos últimos 7 dias.</p>;
  return <div className="flex flex-col gap-2">{cargas.map((c) => <Carga key={c.carga_id} c={c} />)}</div>;
}
