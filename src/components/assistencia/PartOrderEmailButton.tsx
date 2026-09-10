"use client";

import { useState } from "react";
import type { PartOrder } from "@/lib/partOrders";

// E-mail padrão que a assistência manda pro representante do fornecedor --
// pedido do Victor 10/09/2026, texto exato que ele já usa hoje (copiado
// literalmente, inclusive o bloco fixo de dados da empresa). Só os campos
// vazios do modelo original (Nome do Cliente, Fábrica, Produto, Cor, Peça,
// Código da Peça) são preenchidos com o dado do pedido -- "N° Pedido de
// Venda" e "Descrição" não têm campo correspondente em part_orders, ficam
// em branco pro atendente completar à mão (Descrição cai pra Observação
// quando o pedido já tem uma, só pra economizar digitação, não é o mesmo
// campo).
const EMPRESA_BLOCO = {
  municipio: "João Pessoa",
  estado: "Paraíba",
  razaoSocial: "LOJAS AIAM COMERCIO E DISTRIBUIDORA DE MOVEIS E COLCHOES LTDA",
  cnpj: "39.537.682/0013-45",
  endereco: "RUA HORTENCIO RIBEIRO DE LUNA 355- DISTRITO INDUSTRIAL JOÃO PESSOA",
};

function buildSubject(): string {
  return "Solicitação de Peças - LOJAS AIAM";
}

function buildBody(o: PartOrder): string {
  return [
    `Nome do Cliente: ${o.clientName ?? ""}`,
    `N° Pedido de Venda: `,
    `Município: ${EMPRESA_BLOCO.municipio}`,
    `Estado: ${EMPRESA_BLOCO.estado}`,
    `Razão Social: ${EMPRESA_BLOCO.razaoSocial}`,
    `CNPJ: ${EMPRESA_BLOCO.cnpj}`,
    `Endereço: ${EMPRESA_BLOCO.endereco}`,
    `Fábrica: ${o.supplier ?? ""}`,
    `Produto: ${o.product ?? ""}`,
    `Cor: ${o.color ?? ""}`,
    `PEÇA: ${o.partName}`,
    `Código da Peça: ${o.partCode ?? ""}`,
    `Descrição: ${o.notes ?? ""}`,
    `FOTO/VÍDEO: `,
  ].join("\n");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
      style={{
        color: copied ? "var(--status-good)" : "var(--text-primary)",
        background: `color-mix(in srgb, ${copied ? "var(--status-good)" : "var(--text-secondary)"} 15%, var(--surface-1))`,
      }}
    >
      {copied ? "Copiado!" : label}
    </button>
  );
}

export function PartOrderEmailButton({ o }: { o: PartOrder }) {
  const [open, setOpen] = useState(false);
  const subject = buildSubject();
  const body = buildBody(o);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap underline"
        style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--text-secondary) 15%, var(--surface-1))" }}
      >
        ✉️ E-mail
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar e-mail"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-lg max-h-[80vh] overflow-y-auto rounded-lg border p-4 shadow-lg flex flex-col gap-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                E-mail pro representante
              </h3>
              <button
                aria-label="Fechar"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Assunto
                </span>
                <CopyButton text={subject} label="Copiar assunto" />
              </div>
              <p className="text-sm rounded border px-3 py-2" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {subject}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Corpo do e-mail
                </span>
                <CopyButton text={body} label="Copiar corpo" />
              </div>
              <textarea
                readOnly
                rows={16}
                value={body}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="text-sm rounded border px-3 py-2 whitespace-pre-line font-mono"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" }}
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
