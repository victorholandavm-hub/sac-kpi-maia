"use client";

import { useState } from "react";
import type { NotaAvulsa } from "@/lib/odoo/logistica";
import type { CatalogosOdoo } from "@/lib/odoo/logisticaTipos";
import { emitirMdfeAvulsoAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle } from "./ui";

// 29/10/2026 (Pedro/Adonis, Campina): a 5152 do atendimento de "Pedidos das lojas" sai SEM carga e o manifesto é por carga.
// Pro fisco o caminhão leva a nota de TRANSFERÊNCIA (as notas dos clientes são procedimento interno) -> aqui o CD marca as 5152,
// escolhe caminhão e motorista e emite o MDF-e. Vira uma carga "abastecimento" em rota só para amarrar o manifesto.
function quando(s?: string | null) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ManifestoAvulso({ empresa, notas, catalogos }: { empresa: number; notas: NotaAvulsa[]; catalogos: CatalogosOdoo | null }) {
  const { pending, run } = useAcaoOdoo();
  const [sel, setSel] = useState<number[]>([]);
  const [veiculo, setVeiculo] = useState<number>(0);
  const [motorista, setMotorista] = useState<number>(0);
  const [feito, setFeito] = useState<string>("");
  const [lista, setLista] = useState<NotaAvulsa[]>(notas);
  if (!lista.length) return null;
  const lojas = Array.from(new Set(lista.map((n) => n.loja)));
  const total = lista.filter((n) => sel.includes(n.doc_id)).reduce((t, n) => t + (n.valor || 0), 0);
  return (
    <div className="cartao p-3 flex flex-col gap-2 min-w-0" style={{ borderColor: "var(--status-warning, #B7791F)" }}>
      <div className="font-bold" style={{ color: "var(--text-primary)" }}>Notas de transferência sem carga ({lista.length}) — manifesto só da 5152</div>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Saíram pelo atendimento de &quot;Pedidos das lojas&quot; ({lojas.join(", ")}) e não estão em nenhuma carga. Marque as que vão no mesmo caminhão,
        escolha o veículo e o motorista e emita o manifesto. As notas dos clientes não entram: pro fisco vale a nota de transferência.
      </p>
      <div className="flex flex-col gap-1">
        {lista.map((n) => (
          <label key={n.doc_id} className="text-sm flex gap-2 items-center" style={{ color: "var(--text-primary)" }}>
            <input type="checkbox" checked={sel.includes(n.doc_id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, n.doc_id] : s.filter((x) => x !== n.doc_id)))} />
            <span><b>NF {n.numero}/{n.serie}</b> · {n.loja} · {n.itens} item(ns) · {brl(n.valor)} · {quando(n.data)}{n.ref ? <span style={{ color: "var(--text-secondary)" }}> · {n.ref}</span> : null}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <select className="rounded border p-1 text-sm" value={veiculo} onChange={(e) => setVeiculo(Number(e.target.value))}>
          <option value={0}>Veículo…</option>
          {(catalogos?.veiculos ?? []).map((v) => <option key={v.id} value={v.id}>{v.nome}{v.placa ? ` · ${v.placa}` : ""}</option>)}
        </select>
        <select className="rounded border p-1 text-sm" value={motorista} onChange={(e) => setMotorista(Number(e.target.value))}>
          <option value={0}>Motorista…</option>
          {(catalogos?.motoristas ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <button type="button" disabled={pending || !sel.length || !veiculo || !motorista} className={botaoClass} style={botaoPrimarioStyle}
          onClick={() => {
            if (!confirm(`Emitir o manifesto (MDF-e) com ${sel.length} nota(s) de transferência (${brl(total)})? Ele vai para a SEFAZ.`)) return;
            run(() => emitirMdfeAvulsoAction(empresa, sel, veiculo, motorista),
              (d) => `Manifesto ${String(d.numero ?? "")} ${String(d.estado ?? d.situacao ?? "")} (carga ${String(d.carga ?? "")})`.trim(),
              (d) => { setFeito(`MDF-e nº ${String(d.numero ?? "")} ${String(d.estado ?? "")} · carga ${String(d.carga ?? "")} (aparece na lista abaixo ao recarregar)`); setLista((l) => l.filter((n) => !sel.includes(n.doc_id))); setSel([]); });
          }}>
          {pending ? "Enviando…" : `Emitir manifesto (${sel.length} nota(s) · ${brl(total)})`}
        </button>
      </div>
      {feito ? <p className="text-sm" style={{ color: "var(--status-ok, #1B7E3B)" }}>{feito}</p> : null}
    </div>
  );
}
