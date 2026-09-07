"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarContatoAction, registrarResultadoContatoAction, marcarNaoContatarAction } from "@/app/clientes/actions";
import { RECOMPRA_RESULTADO_LABELS, type RecompraContato, type RecompraResultado } from "@/lib/recompra";

function formatDateOnly(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

// Fase 2 do Motor de Recompra -- pedido do Victor 07/09/2026: "Marcar como
// contatado" direto na linha do candidato, sem tela própria. Fecha o elo
// de feedback que faltava no desenho original (motor-de-recompra.html) --
// sem registrar o resultado de cada contato, a régua nunca aprende sozinha
// se uma abordagem funcionou. "🚫 Não contatar mais" (mesma conversa,
// salvaguarda de LGPD) fica sempre visível embaixo, em qualquer estado --
// um cliente pode pedir pra parar de ser contatado a qualquer momento,
// independente de já ter sido contatado antes ou não.
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
  const [naoContatarFormOpen, setNaoContatarFormOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

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

  async function marcarNaoContatar() {
    setPending(true);
    setError(null);
    try {
      await marcarNaoContatarAction(clientId, motivo, "");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setPending(false);
    }
  }

  let content: React.ReactNode;

  if (contato?.resultado) {
    // Já teve resultado (virou venda ou não) -- mostra o desfecho. Cliente
    // pode voltar a ser candidato meses depois (comprou de novo, entrou em
    // atrito de novo) -- não tem "novo ciclo" aqui, ele simplesmente some
    // e reaparece sozinho quando os sinais mudarem de novo.
    content = (
      <div className="flex flex-col gap-0.5 items-end">
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
  } else if (contato) {
    // Contatado, esperando resultado.
    content = (
      <div className="flex flex-col gap-1 items-end">
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
      </div>
    );
  } else {
    // Nunca contatado -- formulário mínimo: "quem" é opcional (sem usuário
    // individual logado nesse painel, ver comentário acima).
    content = formOpen ? (
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
          <button type="button" onClick={() => setFormOpen(false)} className="text-[11px] underline" style={{ color: "var(--text-secondary)" }}>
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
    );
  }

  return (
    <div className="flex flex-col gap-1 items-end" onClick={(e) => e.stopPropagation()}>
      {content}

      {naoContatarFormOpen ? (
        <div className="flex flex-col gap-1 items-end mt-1 pt-1" style={{ borderTop: "1px dashed var(--border)" }}>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            disabled={pending}
            className="text-xs rounded border px-2 py-1 w-40 disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={marcarNaoContatar}
              className="text-[11px] rounded-full px-2.5 py-1 font-medium disabled:opacity-60"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setNaoContatarFormOpen(false)}
              className="text-[11px] underline"
              style={{ color: "var(--text-secondary)" }}
            >
              cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNaoContatarFormOpen(true)}
          className="text-[10px] underline mt-0.5"
          style={{ color: "var(--text-muted)" }}
          title="Cliente pediu pra não ser mais contatado -- some da lista de recompra."
        >
          🚫 Não contatar mais
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
