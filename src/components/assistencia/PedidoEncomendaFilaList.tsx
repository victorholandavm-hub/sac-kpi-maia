"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkMarkEnviadoParaCD, advancePedidoStatus } from "@/app/assistencia/encomendas-actions";
import { useQuickAction } from "./useQuickAction";
import { PedidoEncomendaStatusBadge } from "./PedidoEncomendaStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { PEDIDO_ENCOMENDA_STATUS_COLORS, PEDIDO_ENCOMENDA_STATUS_LABELS } from "@/lib/assistenciaLabels";
import { prazoUrgencyStyle } from "@/lib/prazoStyle";
import { pinSemPrazoAndSort } from "@/lib/encomendaDeadline";
import type { PedidoEncomendaSummary, PedidoEncomendaItem } from "@/lib/pedidosEncomenda";

// Reforma da Fila de Encomendas -- pedido do Victor 25/08/2026: "simplificar
// a navegação, eliminar rolagem excessiva e padronizar o layout". Era uma
// lista de cards flexíveis (várias linhas cada, altura variável) agrupados
// em acordeões por dia de prazo -- virou uma lista única em formato de
// tabela compacta (linha única por pedido, colunas fixas), sem agrupar por
// dia: "Elimine a divisão de telas/visões separadas... Exiba uma lista
// única ordenada cronologicamente". A redução de altura por linha (cards
// grandes → linha compacta) é o que de fato elimina rolagem, mesmo
// mostrando tudo de uma vez sem acordeão escondendo nada.

// Único status de origem elegível pra seleção em lote hoje: fábrica termina a
// produção de vários pedidos e marca todos como "enviado para o CD" de uma
// vez, em vez de abrir pedido por pedido (ver bulkMarkEnviadoParaCD).
const BULK_ELIGIBLE_STATUS = "em_producao";

// A partir daqui o CD já confirmou o pedido de alguma forma (botou em carga
// ou marcou recebido/em estoque) -- só nesse ponto existe uma data real de
// chegada pra mostrar. "pronto_para_expedicao" fica DE FORA de propósito:
// é a fábrica dizendo "enviei", não o CD confirmando "recebi", então o
// prazo fábrica→CD continua sendo a informação que vale até o CD agir de
// verdade (ver chegadaCdByPedido/getChegadaCdDates em pedidosEncomenda.ts).
const CD_JA_CONFIRMOU: PedidoEncomendaSummary["status"][] = ["recebido_cd", "em_carga", "faturado", "entregue"];

function formatDateOnly(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Tag de data -- pedido do Victor 25/08/2026: "Data / Prazo: Tag com a data
// limite/previsão (ex: 12/08)". Mesmo desenho de dot+pílula de
// PedidoEncomendaStatusBadge/StatusBadge (consistência entre os badges do
// sistema), cor pela urgência (prazoUrgencyStyle) em vez de status.
function DeadlineTag({ dateStr, sub }: { dateStr: string; sub: string }) {
  const { color } = prazoUrgencyStyle(dateStr);
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap w-fit"
        style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        {formatDateOnly(dateStr)}
      </span>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {sub}
      </span>
    </div>
  );
}

// Coluna "Data / Prazo" -- prioridade igual à que já existia (chegada real
// > prazo p/ loja > prazo p/ CD), só que agora só UMA tag por linha (era
// possível mostrar duas empilhadas no card antigo) -- necessário pro
// formato de linha única. `sub` diferencia o que a data significa sem
// precisar de mais espaço.
function DeadlineCell({ p, chegadaCd }: { p: PedidoEncomendaSummary; chegadaCd?: string }) {
  if (CD_JA_CONFIRMOU.includes(p.status) && chegadaCd) {
    return (
      <div className="flex flex-col gap-0.5">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap w-fit"
          style={{ color: "var(--text-secondary)", background: "var(--surface-2)" }}
        >
          📦 {new Date(chegadaCd).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
        </span>
        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          chegou no cd
        </span>
      </div>
    );
  }
  if (p.prazoCdLoja) return <DeadlineTag dateStr={p.prazoCdLoja} sub="prazo p/ loja" />;
  if (p.prazoFabricaCd) return <DeadlineTag dateStr={p.prazoFabricaCd} sub="prazo p/ cd" />;
  return null;
}

// Coluna "Quantidade e Produto" -- pedido do Victor 25/08/2026: "Destaque
// para a quantidade em badge/negrito... Nome do produto limpo em caixa
// alta". Sem sub-tag de medidas/variação/cor (o exemplo do pedido tinha
// "128X188X35 | VOGA BEGE") -- não existe campo estruturado separado no
// banco pra isso, só a descrição livre inteira (mesma limitação já
// documentada em FabricaProducaoView.tsx, decisão do Victor 22/08/2026 de
// não mexer no schema agora) -- não dá pra recortar em blocos garantidamente
// certos sem isso.
function ItemsCell({ items }: { items: PedidoEncomendaItem[] }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 min-w-0">
          <span
            className="text-xs font-extrabold shrink-0 rounded px-1.5 py-0.5"
            style={{ color: "#fff", background: "var(--brand-orange)" }}
          >
            {item.quantidade}x
          </span>
          <span className="text-sm font-bold truncate uppercase" style={{ color: "var(--text-primary)" }}>
            {item.produtoDescricao}
          </span>
        </div>
      ))}
    </div>
  );
}

function PedidoRow({
  p,
  position,
  needsAction,
  selectable,
  selected,
  onToggleSelected,
  chegadaCd,
  quickAdvance,
  pending,
  onAdvance,
}: {
  p: PedidoEncomendaSummary;
  position: number | undefined;
  needsAction: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  chegadaCd: string | undefined;
  quickAdvance: string | null;
  pending: boolean;
  onAdvance: () => void;
}) {
  const fornecedorLabel = p.fornecedorTipo === "fabrica_externa" ? `Externo: ${p.fornecedorExterno}` : p.fabricaNome;

  return (
    <div className="flex items-stretch" style={needsAction ? { borderLeft: "4px solid var(--status-warning)" } : undefined}>
      {/* Checkbox de seleção em lote + posição na fila -- fora do <Link>
          abaixo, controles próprios (checkbox precisa ficar clicável sem
          navegar; posição é só leitura, mas fica no mesmo bloco fixo). */}
      <div className="flex flex-col items-center justify-center gap-1 w-9 shrink-0 py-2">
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="w-4 h-4 cursor-pointer"
            aria-label={`Selecionar pedido #${p.pedidoNumber}`}
          />
        ) : null}
        {position ? (
          <div className="rounded flex flex-col items-center justify-center px-1 py-0.5 shrink-0 leading-none" style={{ background: "var(--brand-green)", color: "#fff" }}>
            <span className="text-xs font-bold">{position}º</span>
          </div>
        ) : null}
      </div>

      {/* Colunas fixas -- pedido do Victor 25/08/2026: "Substitua os cards
          expansíveis e desalinhados por um layout em tabela compacta de
          linha única". display:contents faz o <Link> não gerar caixa
          própria no layout -- as 4 primeiras colunas viram itens diretos
          do flex container externo, mesmo estando dentro do link (mesmo
          padrão de EntregaCardRow em AssistenciaQueueGroup.tsx). Ações
          fica FORA do link -- tem botão de verdade dentro. */}
      <Link href={`/assistencia/encomendas/fila/${p.id}`} className="contents">
        <div className="w-full sm:w-[12%] shrink-0 flex items-center sm:pr-3 py-2">
          <DeadlineCell p={p} chegadaCd={chegadaCd} />
        </div>

        <div className="w-full sm:w-[33%] shrink-0 flex items-center min-w-0 sm:pr-3 py-2">
          <ItemsCell items={p.items} />
        </div>

        <div className="w-full sm:w-[20%] shrink-0 flex flex-col gap-0.5 min-w-0 sm:pr-3 py-2 justify-center">
          <span className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
            {p.storeName}
          </span>
          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            Ped: #{p.pedidoNumber}
            {fornecedorLabel ? ` · ${fornecedorLabel}` : ""}
          </span>
        </div>

        {/* Badge de status, não mais a linha de progresso (StatusStepper)
            que substituiu o badge em 22/08/2026 -- pedido do Victor
            25/08/2026 ("guia de padronização" da fila): "Status Atual:
            Badge colorida com a etapa atual". A linha de progresso
            inteira (6 etapas) não cabe numa coluna estreita de linha
            única; o badge cabe. */}
        <div className="w-full sm:w-[13%] shrink-0 flex items-center gap-1.5 flex-wrap sm:pr-3 py-2">
          <PedidoEncomendaStatusBadge status={p.status} />
          <NewSinceBadge createdAt={p.createdAt} storageKey="fila-encomendas-last-seen" />
        </div>
      </Link>

      <div className="w-full sm:w-[12%] shrink-0 flex flex-col items-start sm:items-end justify-center gap-1.5 py-2 pr-2">
        {quickAdvance ? (
          <button
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              onAdvance();
            }}
            className="text-xs font-bold px-2.5 py-1.5 rounded-md whitespace-nowrap disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Avançar →
          </button>
        ) : null}
        <Link href={`/assistencia/encomendas/fila/${p.id}`} className="text-xs underline whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
          Ver detalhes
        </Link>
      </div>
    </div>
  );
}

export function PedidoEncomendaFilaList({
  pedidos,
  queuePosition,
  actionNeededIds,
  canBulkAdvance,
  chegadaCdByPedido,
  quickAdvanceByPedido,
}: {
  pedidos: PedidoEncomendaSummary[];
  queuePosition: [string, number][];
  actionNeededIds: Set<string>;
  canBulkAdvance: boolean;
  // Data real (não prazo) em que cada pedido chegou no CD -- ver
  // getChegadaCdDates (pedidosEncomenda.ts). Ausente quando o pedido ainda
  // não passou por lá.
  chegadaCdByPedido: Record<string, string>;
  // Próximo status pra oferecer o botão "Avançar" direto na linha -- ver
  // nextQuickAdvance (dal.ts). null quando não existe uma transição única
  // e segura de disparar sem preencher mais nada antes (aí só sobra "Ver
  // detalhes").
  quickAdvanceByPedido: Record<string, string | null>;
}) {
  const positionMap = new Map(queuePosition);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pending, run } = useQuickAction();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markSelected() {
    const ids = [...selected];
    const plural = ids.length > 1 ? "s" : "";
    run(async () => {
      await bulkMarkEnviadoParaCD(ids);
      setSelected(new Set());
    }, `${ids.length} pedido${plural} marcado${plural} como enviado para o CD.`);
  }

  function advance(p: PedidoEncomendaSummary, toStatus: string) {
    run(async () => {
      await advancePedidoStatus(p.id, toStatus);
    }, `Pedido #${p.pedidoNumber}: ${PEDIDO_ENCOMENDA_STATUS_LABELS[toStatus] ?? toStatus}.`);
  }

  const { semPrazo, comPrazo } = pinSemPrazoAndSort(pedidos);

  function renderRow(p: PedidoEncomendaSummary) {
    const needsAction = actionNeededIds.has(p.id);
    const eligible = canBulkAdvance && p.status === BULK_ELIGIBLE_STATUS;
    return (
      <PedidoRow
        key={p.id}
        p={p}
        position={positionMap.get(p.id)}
        needsAction={needsAction}
        selectable={eligible}
        selected={selected.has(p.id)}
        onToggleSelected={() => toggle(p.id)}
        chegadaCd={chegadaCdByPedido[p.id]}
        quickAdvance={quickAdvanceByPedido[p.id] ?? null}
        pending={pending}
        onAdvance={() => advance(p, quickAdvanceByPedido[p.id]!)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Bloco fixo no topo, sempre visível (não é acordeão) -- pedido
            do Victor 25/08/2026: "Os itens sem data/prazo definido não
            devem ficar no fim da página. Fixe um bloco de alerta no topo
            da lista com esses itens críticos para resolução imediata". */}
        {semPrazo.length > 0 ? (
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--status-warning)" }}>
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: "var(--status-warning)" }}>
              <span aria-hidden="true">⚠️</span>
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#fff" }}>
                Sem prazo definido
              </span>
              <span className="text-xs font-semibold" style={{ color: "#fff", opacity: 0.9 }}>
                ({semPrazo.length})
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--status-warning)" }}>
              {semPrazo.map(renderRow)}
            </div>
          </div>
        ) : null}

        {/* Lista única, cronológica, sem agrupar por dia -- pedido do
            Victor 25/08/2026 (ver comentário no topo do arquivo). */}
        {comPrazo.length > 0 ? (
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
            <div className="divide-y" style={{ borderColor: "var(--brand-green)" }}>
              {comPrazo.map(renderRow)}
            </div>
          </div>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div
          className="fixed bottom-20 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto z-40 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg flex-wrap"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          <button
            disabled={pending}
            onClick={markSelected}
            className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
            style={{ background: PEDIDO_ENCOMENDA_STATUS_COLORS.pronto_para_expedicao, color: "#fff" }}
          >
            Marcar como enviado para o CD
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Limpar seleção
          </button>
        </div>
      ) : null}
    </>
  );
}
