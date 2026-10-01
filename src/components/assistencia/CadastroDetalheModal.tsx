"use client";

import { useState } from "react";
import type { Cadastro } from "@/lib/cadastrosHistorico";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

// Detalhe completo de 1 registro de Cadastros -- mesmo padrão de modal de
// ProductsModalButton.tsx, adaptado (aqui não é lista de produtos, é um
// registro só -- "Ver detalhes" em vez de "Ver produtos (N)").
export function CadastroDetalheModal({ cadastro }: { cadastro: Cadastro }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        📄 Ver detalhes
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar detalhes"
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
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-lg max-h-[82vh] overflow-y-auto rounded-lg border p-4 shadow-lg flex flex-col gap-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {cadastro.cliente ?? "Sem nome de cliente"}
              </h3>
              <button
                aria-label="Fechar"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-xs px-2 py-1 rounded shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Row label="Produto" value={cadastro.produto} />
              <Row label="Descrição / problema" value={cadastro.descricao} />
              <Row label="NF" value={cadastro.nf} />
              <Row label="Código" value={cadastro.codigo} />
              <Row label="Vendedora" value={cadastro.vendedora} />
              <Row label="Loja" value={cadastro.loja} />
              <Row label="CPF" value={cadastro.cpf} />
              <Row label="Telefone" value={cadastro.telefone} />
              <Row label="Endereço" value={cadastro.endereco} />
              <Row label="Solicitante" value={cadastro.solicitante} />
              <Row label="Quem montou" value={cadastro.quemMontou} />
              <Row label="Origem (aba da planilha)" value={cadastro.origemPlanilha} />
            </div>

            {cadastro.prazoNota ? <Row label="Observação do prazo (texto original)" value={cadastro.prazoNota} /> : null}
            {cadastro.obs ? <Row label="OBS" value={cadastro.obs} /> : null}
          </div>
        </>
      ) : null}
    </>
  );
}
