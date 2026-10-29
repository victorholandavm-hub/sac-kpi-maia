import { faturamentosDeOutros, type FaturamentoDeOutro } from "@/lib/notasDeOutros";
import { CienteNotaBotao } from "./CienteNotaBotao";

// Quadro do CD: notas de entrega faturadas por quem não é Adonis nem John --
// Victor 29/10/2026. Pendentes (sem ciente) em destaque; as já vistas ficam
// recolhidas. Falha ao ler só esconde o quadro.

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Linha({ f, comBotao }: { f: FaturamentoDeOutro; comBotao: boolean }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span style={{ color: "var(--text-primary)" }}>
          <b>{f.quem}</b> faturou em {quando(f.em)} ·{" "}
          <a href={`/assistencia/logistica/cargas/${f.cargaId}`} className="underline">
            carga {f.romaneio ?? f.cargaId}
          </a>
        </span>
        {f.notas.length ? (
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {f.notas.map((n) => `${n.pedido}${n.cliente ? ` · ${n.cliente}` : ""}${n.nf ? ` · NF ${n.nf}` : ""}`).join("  |  ")}
          </span>
        ) : null}
        {f.ciente ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            ciente: {f.ciente.por} em {quando(f.ciente.em)}
          </span>
        ) : null}
      </div>
      {comBotao ? <CienteNotaBotao acaoId={f.acaoId} /> : null}
    </li>
  );
}

export async function NotasDeOutros() {
  const todas = await faturamentosDeOutros().catch(() => []);
  if (todas.length === 0) return null;
  const pendentes = todas.filter((f) => !f.ciente);
  const vistas = todas.filter((f) => f.ciente);
  // 29/10 (Victor): fechado, só um botão na tela; clica abre, clica de novo fecha.
  return (
    <details className="cartao px-4 py-2 group" style={{ border: pendentes.length ? "2px solid var(--status-critical)" : "1px solid var(--border)" }}>
      <summary className="cursor-pointer list-none flex items-center gap-2 py-1 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
        Notas de entrega faturadas por outras pessoas
        {pendentes.length ? (
          <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--status-critical)", color: "#fff" }}>
            {pendentes.length} nova{pendentes.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
            nenhuma nova
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-1 pb-2">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Últimos 7 dias. Não entram as do Adonis e do Jhon nem as emitidas direto no Odoo.
        </p>
        {pendentes.length ? (
          <ul>
            {pendentes.map((f) => (
              <Linha key={f.acaoId} f={f} comBotao />
            ))}
          </ul>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Nenhuma nova.
          </p>
        )}
        {vistas.length ? (
          <details>
            <summary className="cursor-pointer text-xs" style={{ color: "var(--text-secondary)" }}>
              Já vistas ({vistas.length})
            </summary>
            <ul>
              {vistas.map((f) => (
                <Linha key={f.acaoId} f={f} comBotao={false} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </details>
  );
}
