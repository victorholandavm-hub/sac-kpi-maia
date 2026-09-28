"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listNpsRespostasPorFaseAction } from "@/app/kpis/actions";
import { NPS_DETRATOR_ORIGEM_LABELS, type NpsDetratorOrigem, type NpsResposta } from "@/lib/npsDetratores";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { NPS_SCORE_LABELS } from "./NpsCard";

// CPF/CNPJ só pra leitura -- máscara simples (11 dígitos = CPF, resto
// mostra cru). Sem validação de dígito verificador aqui, é só exibição de
// um dado que já veio pronto do cadastro/pedido.
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function scoreColor(score: number): string {
  if (score <= 2) return "var(--status-critical)";
  if (score === 3) return "var(--status-warning)";
  return "var(--status-good)";
}

// Card clicável no Resumo -- pedido do Victor 28/09/2026: "ver o nome das
// pessoas que avaliaram com algum tipo de dado delas, cpf, nome e a nota".
// Busca sob demanda (só quando o modal abre, não precarrega as 5 fases na
// tela de Resumo). CPF vem null pra "sac" (conversa do GHL, sem venda por
// trás) -- mostra telefone nesse caso, mesmo critério já usado na lista de
// Detratores.
export function NpsRespostasModal({ origem, onClose }: { origem: NpsDetratorOrigem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState<NpsResposta[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    listNpsRespostasPorFaseAction(origem)
      .then(setRespostas)
      .catch(() => setError("Não foi possível carregar as respostas."))
      .finally(() => setLoading(false));
  }, [origem]);

  return (
    <>
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-200"
        style={{ background: "rgba(0,0,0,0.5)", opacity: visible ? 1 : 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl transition-all duration-200 ease-out"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 border-b"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {NPS_DETRATOR_ORIGEM_LABELS[origem]}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {loading ? "Carregando…" : `${respostas.length} resposta${respostas.length === 1 ? "" : "s"}`}
              {origem === "sac" ? " · sem CPF nessa fonte (conversa do GHL, sem venda por trás) -- mostra telefone" : ""}
            </p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-1.5 shrink-0 hover:opacity-70 transition-opacity" style={{ color: "var(--text-muted)" }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Carregando…
            </p>
          ) : error ? (
            <p className="text-sm" style={{ color: "var(--status-critical)" }}>
              {error}
            </p>
          ) : respostas.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma resposta ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {respostas.map((r) => (
                <div
                  key={r.origemId}
                  className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {r.clientName ?? "Sem nome"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.clientCpf ? formatCpf(r.clientCpf) : r.clientPhone ? r.clientPhone : "Sem CPF/telefone"}
                      {" · "}
                      {formatDateTimeBr(r.respondidoEm)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color: scoreColor(r.score) }}>
                    {NPS_SCORE_LABELS[r.score] ?? r.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
