"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarContatoAction, registrarResultadoContatoAction } from "@/app/clientes/actions";
import { RECOMPRA_RESULTADO_LABELS, type RecompraContato, type RecompraResultado } from "@/lib/recompra";

function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

// Fase 2 do Motor de Recompra -- pedido do Victor 07/09/2026: "Marcar como
// contatado" direto na linha do candidato, sem tela própria. Fecha o elo
// de feedback que faltava no desenho original (motor-de-recompra.html) --
// sem registrar o resultado de cada contato, a régua nunca aprende sozinha
// se uma abordagem funcionou.
//
// Sem toast/useQuickAction (ToastProvider é só da árvore /assistencia,
// essa tela mora em /clientes, fora dela) -- estado de erro simples
// embutido na própria célula + router.refresh() no sucesso, que já
// revalida a página inteira (revalidatePath já roda do lado do server em
// clientes/actions.ts).
export function RecompraContatoCell({
  clientId,
  segmento,
  contato,
}: {
  clientId: string;
  segmento: string;
  contato: RecompraContato | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [quem, setQuem] = useState("");

  async function marcarContatado() {
    setPending(true);
    setError(null);
    try {
      await registrarContatoAction(clientId, segmento, quem);
      setFormOpen(false);
      setQuem("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setPending(false);
    }
  }

  async function marcarResultado(resultado: RecompraResultado) {
    if (!contato) return;
    setPending(true);
    setError(null);
    try {
      await registrarResultadoContatoAction(contato.id, resultado);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setPending(false);
    }
  }

  // Já teve resultado (virou venda ou não) -- mostra o desfecho + link pra
  // começar um ciclo novo de contato (cliente pode voltar a ser candidato
  // meses depois, ex.: comprou de novo e entrou em atrito de novo).
  if (contato?.resultado) {
    return (
      <div className="flex flex-col gap-0.5 items-end" onClick={(e) => e.stopPropagation()}>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
          style={
            contato.resultado === "vendeu"
              ? { color: "var(--status-good)", background: "color-mix(in srgb, var(--status-good) 15%, transparent)" }
              : { color: "var(--text-muted)", background: "var(--surface-2)" }
          }
        >
          {RECOMPRA_RESULTADO_LABELS[contato.resultado]}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {contato.resultadoEm ? formatDateOnly(contato.resultadoEm) : ""}
        </span>
      </div>
    );
  }

  // Contatado, esperando resultado.
  if (contato) {
    return (
      <div className="flex flex-col gap-1 items-end" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
          📞 {formatDateOnly(contato.contatadoEm)}
          {contato.contatadoPor ? ` · ${contato.contatadoPor}` : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => marcarResultado("vendeu")}
            className="text-[11px] rounded-full px-2 py-0.5 font-medium border disabled:opacity-60"
            style={{ borderColor: "var(--status-good)", color: "var(--status-good)" }}
          >
            ✅ Virou venda
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => marcarResultado("nao_vendeu")}
            className="text-[11px] rounded-full px-2 py-0.5 font-medium border disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            ❌ Não virou
          </button>
        </div>
        {error ? (
          <span className="text-[11px]" style={{ color: "var(--status-critical)" }}>
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  // Nunca contatado (ou ciclo anterior já resolvido, sem contato novo
  // ainda) -- formulário mínimo: "quem" é opcional (sem usuário
  // individual logado nesse painel, ver comentário acima).
  return (
    <div className="flex flex-col gap-1 items-end" onClick={(e) => e.stopPropagation()}>
      {formOpen ? (
        <>
          <input
            value={quem}
            onChange={(e) => setQuem(e.target.value)}
            placeholder="Quem contatou (opcional)"
            disabled={pending}
            className="text-xs rounded border px-2 py-1 w-40 disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={marcarContatado}
              className="text-[11px] rounded-full px-2.5 py-1 font-medium disabled:opacity-60"
              style={{ background: "var(--brand-orange)", color: "#fff" }}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-[11px] underline"
              style={{ color: "var(--text-secondary)" }}
            >
              cancelar
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="text-xs rounded-full px-2.5 py-1 font-medium border whitespace-nowrap"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          📞 Marcar como contatado
        </button>
      )}
      {error ? (
        <span className="text-[11px]" style={{ color: "var(--status-critical)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
