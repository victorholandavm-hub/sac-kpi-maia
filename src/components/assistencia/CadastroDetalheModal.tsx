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

// Endereço importado é um campo só, mas em boa parte dos registros segue o
// padrão "rua + número, complemento - bairro" (ex.: "RUA JOAO ALVES
// RODRIGUES 72, CASA - VALENTINA DE FIGUEIREDO") -- separa pelo último " - "
// quando existe, pra não jogar o bairro dentro do campo de endereço no
// formulário de destino. Heurística, não garantia -- quando não bate o
// padrão, devolve tudo como endereço e bairro vazio (mesmo que digitar à
// mão de novo, não pior do que estava).
function splitEnderecoBairro(endereco: string): { address: string; neighborhood: string } {
  const idx = endereco.lastIndexOf(" - ");
  if (idx === -1) return { address: endereco, neighborhood: "" };
  return { address: endereco.slice(0, idx).trim(), neighborhood: endereco.slice(idx + 3).trim() };
}

// "Criar nova visita/entrega" -- pedido do Victor 02/10/2026: "coloca uma
// opção para no cadastro conseguirmos puxar os dados já para uma entrega
// ou montagem/vistoria/troca de peça". Monta a query string que
// nova-rapida/nova-entrega leem pra pré-preencher o formulário (ver
// useFormPrefill.ts) -- mesmo nome de campo dos dois lados, sem
// transformação. `client_protheus_code` é o pulo do gato: ao preenchê-lo,
// o próprio formulário de destino já dispara a busca TOTVS que ele sempre
// teve (debounce de 400ms), então nome/CPF/telefone/endereço/bairro podem
// vir atualizados de lá, não só do que o cadastro tinha registrado.
// "O que precisa ser feito" fica de propósito FORA daqui -- pedido do
// Victor 03/10/2026 ("precisa ficar vazio"), quem abre o formulário
// escreve com as próprias palavras.
function buildPrefillQuery(cadastro: Cadastro, type?: string): string {
  const { address, neighborhood } = cadastro.endereco ? splitEnderecoBairro(cadastro.endereco) : { address: "", neighborhood: "" };

  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (cadastro.codigoCliente) sp.set("client_protheus_code", cadastro.codigoCliente);
  if (cadastro.cpf) sp.set("client_cpf", cadastro.cpf);
  if (cadastro.cliente) sp.set("client_name", cadastro.cliente);
  if (cadastro.telefone) sp.set("client_phone", cadastro.telefone);
  if (address) sp.set("client_address", address);
  if (neighborhood) sp.set("client_neighborhood", neighborhood);
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
              {/* Logo abaixo do Código (produto) -- pedido do Victor
                  03/10/2026. Mesma coluna do grid de 2 (Código é a 2ª
                  posição da linha, "Vendedora" entra antes pra Código do
                  cliente cair bem embaixo dele, não do lado). */}
              <Row label="Vendedora" value={cadastro.vendedora} />
              <Row label="Código do cliente" value={cadastro.codigoCliente} />
              <Row label="Loja" value={cadastro.loja} />
              <Row label="CPF" value={cadastro.cpf} />
              <Row label="Telefone" value={cadastro.telefone} />
              <Row label="Endereço" value={cadastro.endereco} />
              <Row label="Data de abertura" value={cadastro.dataAbertura ? cadastro.dataAbertura.split("-").reverse().join("/") : null} />
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
