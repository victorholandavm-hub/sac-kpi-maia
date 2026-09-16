"use client";

import { useState } from "react";
import type { PartOrder } from "@/lib/partOrders";
import { getPartOrderGroup, getPartOrderItemsAction } from "@/app/assistencia/pecas-actions";

// Uma peça (as 4 que variam por peça, ver migration 0132) -- forma comum
// pra unificar os dois jeitos de um chamado ter mais de uma peça: o
// LEGADO (migration 0131, 3 chamados linkados por group_id, cada um um
// PartOrder inteiro) e o ATUAL (migration 0132, part_order_items dentro
// de UM chamado só). buildBody/buildSubject abaixo trabalham só com essa
// forma, não com PartOrder inteiro -- não importa de onde veio.
type Piece = { partName: string; partCode: string | null; color: string | null; product: string | null };

function toPiece(o: Pick<PartOrder, "partName" | "partCode" | "color" | "product">): Piece {
  return { partName: o.partName, partCode: o.partCode, color: o.color, product: o.product };
}

// E-mail padrão que a assistência manda pro representante do fornecedor --
// pedido do Victor 10/09/2026, texto exato que ele já usa hoje (copiado
// literalmente, inclusive o bloco fixo de dados da empresa). Só os campos
// vazios do modelo original (Nome do Cliente, Fábrica, Produto, Cor, Peça,
// Código da Peça) são preenchidos com o dado do pedido -- "Descrição" não
// tem campo correspondente em part_orders, fica em branco pro atendente
// completar à mão (cai pra Observação quando o pedido já tem uma, só pra
// economizar digitação, não é o mesmo campo). "N° Pedido de Venda"
// (linha do modelo original) SAIU daqui 15/09/2026 -- achado do Victor:
// "Nota Fiscal e N° Pedido de Venda é a mesma coisa, pode deixar só uma"
// -- Nota Fiscal (abaixo) já cobre o mesmo conceito, agora com campo de
// verdade (invoiceNumber) por trás.
const EMPRESA_BLOCO = {
  municipio: "João Pessoa",
  estado: "Paraíba",
  razaoSocial: "LOJAS AIAM COMERCIO E DISTRIBUIDORA DE MOVEIS E COLCHOES LTDA",
  cnpj: "39.537.682/0013-45",
  endereco: "RUA HORTENCIO RIBEIRO DE LUNA 355- DISTRITO INDUSTRIAL JOÃO PESSOA",
};

// Número do chamado no assunto -- pedido do Victor 15/09/2026: "no
// assunto você coloque o numero do chamado". externalReference (CH0001..)
// pro histórico importado da planilha, senão #ticket_number -- mesmo
// critério já usado em toda a tela (ver PecasTable.tsx). Mais de uma peça
// na mesma solicitação (pedido do Victor 16/09/2026: "a fábrica manda
// tudo junto") -- assunto cita a 1ª referência + quantas peças, corpo
// (buildBody abaixo) lista cada uma.
function buildSubject(header: PartOrder, pieces: Piece[]): string {
  const ref = header.externalReference ?? `#${header.ticketNumber}`;
  return pieces.length > 1 ? `Solicitação de Peças - LOJAS AIAM - ${ref} (${pieces.length} peças)` : `Solicitação de Peças - LOJAS AIAM - ${ref}`;
}

function buildBody(header: PartOrder, pieces: Piece[]): string {
  // Espaço (linha em branco) entre cada informação -- pedido do Victor
  // 14/09/2026: "gentileza em dar espaços em acada informação". Antes era
  // uma linha embaixo da outra sem respiro nenhum.
  const headerLines = [
    `Nome do Cliente: ${header.clientName ?? ""}`,
    // Nota fiscal logo abaixo do nome do cliente -- pedido do Victor
    // 15/09/2026. Morava lá embaixo, perto de Código da Peça, desde que
    // ganhou campo próprio (14/09/2026).
    `Nota Fiscal: ${header.invoiceNumber ?? ""}`,
    `Município: ${EMPRESA_BLOCO.municipio}`,
    `Estado: ${EMPRESA_BLOCO.estado}`,
    `Razão Social: ${EMPRESA_BLOCO.razaoSocial}`,
    `CNPJ: ${EMPRESA_BLOCO.cnpj}`,
    `Endereço: ${EMPRESA_BLOCO.endereco}`,
    `Fábrica: ${header.supplier ?? ""}`,
  ];

  // Produto entrou no bloco de CADA peça (não mais no cabeçalho
  // compartilhado) -- pedido do Victor 16/09/2026: "produto do cliente
  // também precisa seguir a mesma lógica... já que uma peça está ligada a
  // um produto". Uma peça: formato de sempre, sem "Peça 1:" na frente
  // (comportamento idêntico ao de antes do pedido de várias peças). Mais
  // de uma: cada peça em bloco próprio, numerado -- pedido do Victor
  // 16/09/2026: "quando solicitamos mais de uma peça junta, a fábrica
  // manda tudo junto", um e-mail só em vez de um por peça.
  const pecaBlocks =
    pieces.length === 1
      ? [`Produto: ${pieces[0].product ?? ""}`, `Cor: ${pieces[0].color ?? ""}`, `PEÇA: ${pieces[0].partName}`, `Código da Peça: ${pieces[0].partCode ?? ""}`]
      : pieces.flatMap((p, i) => [
          // "Produto N:" em vez de "Peça N:" -- pedido do Victor 16/09/2026:
          // "colocar na parte da linha abaixo onde tem produto... esse
          // negócio de peça 1 confunde" (a linha logo abaixo já é "Produto:
          // X", ter os dois rótulos diferentes -- "Peça" no cabeçalho do
          // bloco e "Produto" no campo -- confundia quem lia o e-mail).
          `Produto ${i + 1}:`,
          `Produto: ${p.product ?? ""}`,
          `Cor: ${p.color ?? ""}`,
          `PEÇA: ${p.partName}`,
          `Código da Peça: ${p.partCode ?? ""}`,
        ]);

  return [...headerLines, ...pecaBlocks, `Descrição: ${header.notes ?? ""}`, `FOTO/VÍDEO: `].join("\n\n");
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

export function PartOrderEmailButton({
  o,
  groupId,
  extraItemsCount = 0,
}: {
  o: PartOrder;
  // LEGADO (migration 0131) -- só os 3 chamados criados antes da correção
  // de 16/09/2026 ainda usam isso (ver comentário em PartOrder,
  // partOrders.ts). Chamado novo nunca tem group_id.
  groupId?: string | null;
  // ATUAL (migration 0132) -- quantas peças em part_order_items além da
  // 1ª (que já vem em `o`). Ver PartOrder.extraItemsCount.
  extraItemsCount?: number;
}) {
  const [open, setOpen] = useState(false);
  // Mais de uma peça no mesmo chamado -- pedido do Victor 16/09/2026: "a
  // fábrica manda tudo junto", então o e-mail precisa listar todas, não só
  // a 1ª. Busca sob demanda (só ao abrir, não a cada render da tabela/
  // lista) -- não depende de quem renderizou este botão já ter as demais
  // peças em mãos (a lista pode estar paginada/filtrada).
  const [extraPieces, setExtraPieces] = useState<Piece[] | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const pieces = [toPiece(o), ...(extraPieces ?? [])];
  const subject = buildSubject(o, pieces);
  const body = buildBody(o, pieces);

  async function handleOpen() {
    setOpen(true);
    if (extraPieces) return;
    if (extraItemsCount > 0) {
      setLoadingExtra(true);
      try {
        const items = await getPartOrderItemsAction(o.id);
        setExtraPieces(items.map((it) => ({ partName: it.partName, partCode: it.partCode, color: it.color, product: it.product })));
      } finally {
        setLoadingExtra(false);
      }
    } else if (groupId) {
      // LEGADO -- ver comentário no tipo das props acima.
      setLoadingExtra(true);
      try {
        const siblings = await getPartOrderGroup(groupId);
        setExtraPieces(siblings.filter((s) => s.id !== o.id).map(toPiece));
      } finally {
        setLoadingExtra(false);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
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
                {loadingExtra ? (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    carregando peças do chamado…
                  </span>
                ) : pieces.length > 1 ? (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    {pieces.length} peças neste chamado
                  </span>
                ) : null}
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
