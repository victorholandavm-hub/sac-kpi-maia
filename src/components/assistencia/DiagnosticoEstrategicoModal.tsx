"use client";

import { useEffect, useState } from "react";
import { Target, X, AlertTriangle, Factory, Armchair, BedDouble, ClipboardList, Wrench, Lightbulb, PackageCheck, Boxes, GraduationCap } from "lucide-react";

// Modal de Diagnóstico Estratégico -- pedido do Victor 21/09/2026: plano de
// ação (causa raiz + ações operacionais) pra reduzir a taxa de assistência
// pra menos de 3%. Conteúdo 100% ESTÁTICO -- texto e percentuais que o
// próprio Victor escreveu, não calculado de `data` (diferente de
// PrejuizoDetalheModal.tsx, todo dinâmico) -- por isso sem props de dado
// nenhum, só onClose. Aberto pelo card "Economia potencial (meta ideal)"
// em KpisAssistenciaView.tsx.
const VILOES = [
  {
    icon: Factory,
    titulo: "Fábrica Sob Alerta (58% dos chamados)",
    descricao: "O gráfico de causa raiz aponta que o maior gargalo financeiro está dentro da nossa própria indústria.",
  },
  {
    icon: Armchair,
    titulo: "Cadeira Helena Linho (21% dos defeitos totais)",
    descricao:
      "Campeã absoluta de assistências devido a problemas crônicos em tecido claro (manchas/cola), costura desfiando ou instabilidade estrutural.",
  },
  {
    icon: BedDouble,
    titulo: "Colchão La Serena (9% dos defeitos) & Cadeira Heloisa (14% somando Chumbo/Caramel)",
    descricao: "Completam o topo do prejuízo na tapeçaria e estrutura industrial.",
  },
  {
    icon: ClipboardList,
    titulo: "Erro de Conferência (13% dos chamados)",
    descricao: "Segundo maior problema geral (itens enviados de forma parcial ou kits de ferragens trocados na expedição).",
  },
];

const ACOES = [
  {
    icon: Lightbulb,
    titulo: "Ação 1: Check-out da Fábrica com Selo de Qualidade",
    descricao:
      'Implementar uma bancada de luz forte para inspeção visual agressiva da Cadeira Helena e Colchão La Serena antes da embalagem. O operador deve colar um adesivo físico assinado embaixo do produto ("Inspecionado por: X") para gerar responsabilidade de lote.',
  },
  {
    icon: PackageCheck,
    titulo: "Ação 2: Blindagem no Transporte de Tecidos Claros",
    descricao:
      "Substituir o plástico bolha simples por camada dupla de plástico filme esticável (shrink) + cantoneiras de papelão grosso nas quinas das cadeiras, evitando rasgos e sujeira no caminhão durante as rotas de João Pessoa.",
  },
  {
    icon: Boxes,
    titulo: "Ação 3: Célula de Kitting no CD contra Erros de Conferência (13%)",
    descricao:
      "Agrupar kits de ferragens e acessórios em embalagens amarradas e etiquetadas junto ao volume principal. O motorista só pode carregar se todos os sub-volumes do kit forem bipados juntos.",
  },
  {
    icon: GraduationCap,
    titulo: "Ação 4: Alinhamento de Expectativa nas 14 Lojas",
    descricao:
      "Treinar os vendedores das lojas físicas e online para explicar ao cliente sobre a acomodação natural da espuma de colchões nos primeiros dias, mitigando chamados improcedentes por falta de informação.",
  },
];

export function DiagnosticoEstrategicoModal({ onClose }: { onClose: () => void }) {
  // Transição suave de abertura -- monta com opacity/scale reduzidos,
  // sobe pro estado final 1 frame depois (sem lib de animação, o projeto
  // não usa nenhuma).
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <button
        aria-label="Fechar diagnóstico estratégico"
        onClick={onClose}
        className="fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-200"
        style={{ background: "rgba(0,0,0,0.5)", opacity: visible ? 1 : 0 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-[4vh] z-50 mx-auto max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl transition-all duration-200 ease-out"
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
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="flex items-center justify-center rounded-full p-2 shrink-0"
              style={{ background: "color-mix(in srgb, var(--brand-orange) 16%, var(--surface-1))" }}
            >
              <Target size={20} style={{ color: "var(--brand-orange)" }} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Plano de Ataque: Redução de Assistências para {"< 3%"}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Diagnóstico executivo baseado em 14 lojas, e-commerce, CD e 2 fábricas próprias.
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-lg p-1.5 shrink-0 hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} style={{ color: "var(--status-critical)" }} aria-hidden="true" />
              <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Os Grandes Vilões (Causa Raiz)
              </h4>
            </div>
            <ul className="flex flex-col gap-3">
              {VILOES.map((item) => (
                <li key={item.titulo} className="flex gap-3 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
                  <span
                    className="flex items-center justify-center rounded-md p-1.5 shrink-0 h-fit"
                    style={{ background: "color-mix(in srgb, var(--status-critical) 14%, var(--surface-1))" }}
                  >
                    <item.icon size={15} style={{ color: "var(--status-critical)" }} aria-hidden="true" />
                  </span>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {item.titulo}
                    </span>
                    {": "}
                    {item.descricao}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Wrench size={16} style={{ color: "var(--brand-green)" }} aria-hidden="true" />
              <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Plano de Ataque Operacional
              </h4>
            </div>
            <ul className="flex flex-col gap-3">
              {ACOES.map((item) => (
                <li key={item.titulo} className="flex gap-3 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
                  <span
                    className="flex items-center justify-center rounded-md p-1.5 shrink-0 h-fit"
                    style={{ background: "color-mix(in srgb, var(--brand-green) 16%, var(--surface-1))" }}
                  >
                    <item.icon size={15} style={{ color: "var(--brand-green)" }} aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {item.titulo}
                    </span>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {item.descricao}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
