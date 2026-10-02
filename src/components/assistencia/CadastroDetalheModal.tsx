"use client";

import { useState } from "react";
import Link from "next/link";
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

// "Criar nova visita/entrega" -- pedido do Victor 02/10/2026: "coloca uma
// opção para no cadastro conseguirmos puxar os dados já para uma entrega
// ou montagem/vistoria/troca de peça". Monta a query string que
// nova-rapida/nova-entrega leem pra pré-preencher o formulário (ver
// useFormPrefill.ts) -- mesmo nome de campo dos dois lados, sem
// transformação. Loja/NF não têm campo próprio nos dois formulários (loja
// aqui é texto livre, lá é um select de loja de verdade -- não dá pra
// mapear um pro outro sem risco de escolher a loja errada), então entram
// como contexto dentro do próprio "reason".
function buildPrefillQuery(cadastro: Cadastro, type?: string): string {
  const reasonParts = [cadastro.produto, cadastro.descricao].filter(Boolean);
  let reason = reasonParts.join(" — ");
  const contexto = [cadastro.loja ? `Loja: ${cadastro.loja}` : null, cadastro.nf ? `NF: ${cadastro.nf}` : null].filter(Boolean);
  if (contexto.length > 0) reason = reason ? `${reason} (${contexto.join(" · ")})` : `(${contexto.join(" · ")})`;

  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (cadastro.cpf) sp.set("client_cpf", cadastro.cpf);
  if (cadastro.cliente) sp.set("client_name", cadastro.cliente);
  if (cadastro.telefone) sp.set("client_phone", cadastro.telefone);
  if (cadastro.endereco) sp.set("client_address", cadastro.endereco);
  if (reason) sp.set("reason", reason);
  return sp.toString();
}

// MONTAGEM é o único tipo de cadastro com equivalente direto e inequívoco
// no tipo de "Nova visita" -- os outros (Assistência, Troca, Erro de
// entrega/faturamento, SAC) podem virar qualquer um dos 4 tipos de visita
// dependendo do caso, melhor deixar o campo "Tipo" no valor padrão do que
// presumir errado.
function visitaTypeFor(cadastro: Cadastro): string | undefined {
  return cadastro.tipo === "MONTAGEM" ? "montagem" : undefined;
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

            <div className="flex items-center gap-2 flex-wrap pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs w-full" style={{ color: "var(--text-muted)" }}>
                Puxar esses dados pra uma solicitação de verdade:
              </span>
              <Link
                href={`/assistencia/nova-rapida?${buildPrefillQuery(cadastro, visitaTypeFor(cadastro))}`}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                🛠️ Criar nova visita
              </Link>
              <Link
                href={`/assistencia/nova-entrega?${buildPrefillQuery(cadastro)}`}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                🚚 Criar nova entrega
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
