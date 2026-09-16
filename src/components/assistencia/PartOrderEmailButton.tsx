"use client";

import { useState } from "react";
import type { PartOrder } from "@/lib/partOrders";
import { getPartOrderGroup } from "@/app/assistencia/pecas-actions";

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
function buildSubject(orders: PartOrder[]): string {
  const first = orders[0];
  const ref = first.externalReference ?? `#${first.ticketNumber}`;
  return orders.length > 1 ? `Solicitação de Peças - LOJAS AIAM - ${ref} (${orders.length} peças)` : `Solicitação de Peças - LOJAS AIAM - ${ref}`;
}

function buildBody(orders: PartOrder[]): string {
  const first = orders[0];
  // Espaço (linha em branco) entre cada informação -- pedido do Victor
  // 14/09/2026: "gentileza em dar espaços em acada informação". Antes era
  // uma linha embaixo da outra sem respiro nenhum.
  const header = [
    `Nome do Cliente: ${first.clientName ?? ""}`,
    // Nota fiscal logo abaixo do nome do cliente -- pedido do Victor
    // 15/09/2026. Morava lá embaixo, perto de Código da Peça, desde que
    // ganhou campo próprio (14/09/2026).
    `Nota Fiscal: ${first.invoiceNumber ?? ""}`,
    `Município: ${EMPRESA_BLOCO.municipio}`,
    `Estado: ${EMPRESA_BLOCO.estado}`,
    `Razão Social: ${EMPRESA_BLOCO.razaoSocial}`,
    `CNPJ: ${EMPRESA_BLOCO.cnpj}`,
    `Endereço: ${EMPRESA_BLOCO.endereco}`,
    `Fábrica: ${first.supplier ?? ""}`,
    `Produto: ${first.product ?? ""}`,
  ];

  // Uma peça: formato de sempre, sem "Peça 1:" na frente (comportamento
  // idêntico ao de antes do pedido de várias peças). Mais de uma: cada
  // peça em bloco próprio, numerado -- pedido do Victor 16/09/2026:
  // "quando solicitamos mais de uma peça junta, a fábrica manda tudo
  // junto", um e-mail só em vez de um por peça.
  const pecaBlocks =
    orders.length === 1
      ? [`Cor: ${first.color ?? ""}`, `PEÇA: ${first.partName}`, `Código da Peça: ${first.partCode ?? ""}`]
      : orders.flatMap((o, i) => [`Peça ${i + 1}:`, `Cor: ${o.color ?? ""}`, `PEÇA: ${o.partName}`, `Código da Peça: ${o.partCode ?? ""}`]);

  return [...header, ...pecaBlocks, `Descrição: ${first.notes ?? ""}`, `FOTO/VÍDEO: `].join("\n\n");
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

export function PartOrderEmailButton({ o, groupId }: { o: PartOrder; groupId?: string | null }) {
  const [open, setOpen] = useState(false);
  // Mais de uma peça na mesma solicitação -- pedido do Victor 16/09/2026:
  // "a fábrica manda tudo junto", então o e-mail precisa listar todas, não
  // só a peça desta linha. Busca sob demanda (só ao abrir, não a cada
  // render da tabela/lista) via getPartOrderGroup -- não depende de quem
  // renderizou este botão já ter as peças-irmãs em mãos (a lista pode
  // estar paginada/filtrada e cortar a mesma solicitação em páginas
  // diferentes).
  const [group, setGroup] = useState<PartOrder[] | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(false);

  const orders = group ?? [o];
  const subject = buildSubject(orders);
  const body = buildBody(orders);

  async function handleOpen() {
    setOpen(true);
    if (groupId && !group) {
      setLoadingGroup(true);
      try {
        const siblings = await getPartOrderGroup(groupId);
        if (siblings.length > 1) setGroup(siblings);
      } finally {
        setLoadingGroup(false);
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
                {loadingGroup ? (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    carregando peças da solicitação…
                  </span>
                ) : orders.length > 1 ? (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    {orders.length} peças nesta solicitação
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
