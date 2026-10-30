"use client";

import { useState } from "react";
import { buscarNotasDoClienteAction, type PedidoComNotas } from "@/app/assistencia/nota-automatica-actions";

// Nota da notificação puxada do sistema (Victor 30/10/2026): o SAC busca pelo
// CPF ou pedido e escolhe a nota -- o servidor anexa o PDF (createSacRequest).
// Anexar o PDF à mão continua valendo quando a nota não aparece.
export function NotaAutomatica({ cpf, inputStyle }: { cpf: string; inputStyle: React.CSSProperties }) {
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoComNotas[] | null>(null);
  const [erro, setErro] = useState("");
  const [chave, setChave] = useState("");
  const [rotulo, setRotulo] = useState("");

  const termo = q.trim() || cpf.trim();
  async function buscar() {
    if (!termo) return;
    setBuscando(true);
    setErro("");
    const r = await buscarNotasDoClienteAction(termo).catch(() => ({ ok: false as const, erro: "Não consegui buscar agora." }));
    setBuscando(false);
    if (!r.ok) {
      setErro(r.erro);
      setPedidos(null);
      return;
    }
    setPedidos(r.pedidos);
    const primeira = r.pedidos.length === 1 ? r.pedidos[0].notas[0] : undefined;
    setChave(primeira?.chave ?? "");
    setRotulo(primeira ? `${r.pedidos[0].pedido} · ${primeira.rotulo}` : "");
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="nota_chave" value={chave} />
      <input type="hidden" name="nota_rotulo" value={rotulo} />
      <div className="flex gap-2 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void buscar();
            }
          }}
          placeholder={cpf ? `CPF ${cpf} (ou digite o pedido)` : "CPF do cliente ou pedido (S01234)"}
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[200px]"
          style={inputStyle}
        />
        <button type="button" onClick={() => void buscar()} disabled={buscando || !termo} className="rounded px-3 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          {buscando ? "Buscando…" : "Buscar nota"}
        </button>
      </div>
      {erro ? <p className="text-xs" style={{ color: "var(--status-critical)" }}>{erro}</p> : null}
      {pedidos && !pedidos.length ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Nenhuma nota encontrada para “{termo}”. Anexe o PDF abaixo.</p>
      ) : null}
      {pedidos?.length ? (
        <div className="flex flex-col gap-1.5">
          {pedidos.map((p) => (
            <div key={p.pedido} className="rounded-lg p-2 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <b style={{ color: "var(--text-primary)" }}>{p.pedido}</b> · loja {p.loja} · {p.data.split("-").reverse().join("/")} · {p.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              {p.notas.map((n) => (
                <label key={n.chave} className="flex items-center gap-2 mt-1 cursor-pointer">
                  <input
                    type="radio"
                    name="nota_escolha"
                    checked={chave === n.chave}
                    onChange={() => {
                      setChave(n.chave);
                      setRotulo(`${p.pedido} · ${n.rotulo}`);
                    }}
                  />
                  {n.rotulo}
                  <a href={`/assistencia/nota-chave/${n.chave}`} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
                    ver
                  </a>
                </label>
              ))}
            </div>
          ))}
          {chave ? (
            <button type="button" onClick={() => { setChave(""); setRotulo(""); }} className="text-xs underline self-start" style={{ color: "var(--text-secondary)" }}>
              Não usar nota do sistema (vou anexar o PDF)
            </button>
          ) : null}
        </div>
      ) : null}
      {chave ? (
        <p className="text-xs font-semibold" style={{ color: "var(--status-good)" }}>
          ✓ {rotulo} — o PDF vai anexado sozinho na notificação.
        </p>
      ) : null}
      <NotaArquivo obrigatorio={!chave} inputStyle={inputStyle} />
    </div>
  );
}

function NotaArquivo({ obrigatorio, inputStyle }: { obrigatorio: boolean; inputStyle: React.CSSProperties }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
      {obrigatorio ? "Ou anexe o PDF da nota *" : "PDF da nota (opcional — já vai a do sistema)"}
      <input name="invoice_file" type="file" required={obrigatorio} accept="application/pdf" className="rounded border px-3 py-2 text-sm" style={inputStyle} />
    </label>
  );
}
