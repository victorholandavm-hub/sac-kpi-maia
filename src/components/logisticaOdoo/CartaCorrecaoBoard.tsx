"use client";

import { useState } from "react";
import type { NotaCce } from "@/lib/odoo/logistica";
import { enviarCceAction, lerCceAction } from "@/app/assistencia/logistica/cce-actions";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 27/10 (Eduardo/CD): cola a chave (ou nº + loja) -> vê a nota e as CC-e feitas -> escreve a correção -> envia -> protocolo + PDF.
export function CartaCorrecaoBoard({ empresas }: { empresas: { id: number; name: string }[] }) {
  const [chave, setChave] = useState("");
  const [numero, setNumero] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [texto, setTexto] = useState("");
  const [dados, setDados] = useState<NotaCce | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function buscar() {
    setMsg(null); setDados(null); setOcupado(true);
    const r = await lerCceAction({ chave: chave.replace(/\D/g, "") || undefined, numero: numero || undefined, company_id: empresa ? Number(empresa) : undefined });
    setOcupado(false);
    if (!r.ok) { setMsg({ tipo: "erro", texto: r.erro }); return; }
    setDados(r.dados);
    if (r.dados.nota.chave) setChave(r.dados.nota.chave);
  }

  async function enviar() {
    if (!dados) return;
    const t = texto.trim();
    if (t.length < 15) { setMsg({ tipo: "erro", texto: "Escreva pelo menos 15 caracteres." }); return; }
    if (!window.confirm(`Enviar a carta de correção da NF-e ${dados.nota.numero} à SEFAZ?\n\n${t}`)) return;
    setOcupado(true); setMsg(null);
    const r = await enviarCceAction(dados.nota.chave, t);
    setOcupado(false);
    if (!r.ok) { setMsg({ tipo: "erro", texto: r.erro }); return; }
    setMsg({ tipo: "ok", texto: `Carta de correção registrada na SEFAZ · seq. ${r.dados.carta.sequencia} · protocolo ${r.dados.carta.protocolo}` });
    setTexto("");
    setDados({ ...dados, cartas: r.dados.cartas });
  }

  const n = dados?.nota;
  return (
    <div className="flex flex-col gap-3">
      <div className="cartao p-4 flex flex-col gap-2">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Cole a chave de acesso da NF-e (44 números) ou informe o número e a loja que emitiu.</p>
        <input className={inputClass} style={inputStyle} placeholder="Chave de acesso (44 números)" value={chave} onChange={(e) => setChave(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          <input className={inputClass} style={{ ...inputStyle, maxWidth: 180 }} placeholder="ou nº da nota" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <select className={inputClass} style={{ ...inputStyle, maxWidth: 260 }} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="">loja que emitiu…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button type="button" className={botaoClass} style={botaoPrimarioStyle} disabled={ocupado} onClick={buscar}>Buscar nota</button>
        </div>
      </div>
      {msg ? <p className="text-sm" style={{ color: msg.tipo === "ok" ? "var(--brand-green)" : "var(--status-critical)" }}>{msg.texto}</p> : null}
      {n ? (
        <div className="cartao p-4 flex flex-col gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          <b>NF-e {n.numero}/{n.serie} · {n.empresa}</b>
          <span style={{ color: "var(--text-secondary)" }}>{n.cliente} · {n.operacao} · R$ {Number(n.valor || 0).toFixed(2).replace(".", ",")} · emissão {n.data} · {n.situacao}</span>
          <p className="text-xs rounded-lg p-2" style={{ background: "var(--surface-2)", color: "var(--status-serious)" }}>⚠️ {dados?.aviso}</p>
          {dados && dados.cartas.length ? (
            <div className="flex flex-col gap-1">
              <b>Cartas já feitas</b>
              {dados.cartas.map((c) => (
                <div key={c.sequencia + c.data} className="flex justify-between gap-2 border-b py-1" style={{ borderColor: "var(--border)" }}>
                  <span>Seq. {c.sequencia} · {c.situacao} · protocolo {c.protocolo} · {c.data}<br /><span style={{ color: "var(--text-secondary)" }}>{c.texto}</span></span>
                  <a className={botaoClass} style={botaoStyle} href={`/assistencia/logistica/pdf/cce?chave=${n.chave}&seq=${encodeURIComponent(c.sequencia)}`} target="_blank" rel="noreferrer">PDF</a>
                </div>
              ))}
            </div>
          ) : null}
          {dados?.pode ? (
            <>
              <label className="flex flex-col gap-1">Texto da correção (15 a 1000 caracteres; acentos são retirados no envio)
                <textarea className={inputClass} style={inputStyle} rows={4} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Obra: ..., CNO: ..., Rua ..., CEP ..." />
              </label>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{texto.length}/1000</span>
              <button type="button" className={botaoClass} style={{ ...botaoPrimarioStyle, alignSelf: "flex-start" }} disabled={ocupado} onClick={enviar}>Enviar carta de correção à SEFAZ</button>
            </>
          ) : <span style={{ color: "var(--status-critical)" }}>Esta nota não está autorizada: não aceita carta de correção.</span>}
        </div>
      ) : null}
    </div>
  );
}
