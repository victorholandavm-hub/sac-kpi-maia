"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAssistenciaOrderAction } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";
import { NewSinceBadge } from "./NewSinceBadge";
import { ProductsModalButton } from "./ProductsModalButton";
import { BulkRotaBar } from "./NotificacoesList";
import { formatDateTimeShortBr } from "@/lib/formatDateTime";
import type { RequestItem, ServiceRequestSummary } from "@/lib/serviceRequests";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

type PaymentFlag = "none" | "partial" | "complete" | "no_items";

// Sempre mostra algo (inclusive "tudo certo") -- silêncio quando o valor já
// tava definido dava a impressão de que nada tinha sido conferido ainda.
// Chamado sem item nenhum (removido depois, ou nunca cadastrado) também
// precisa de um selo -- sem isso, "items.length === 0" caía no silêncio de
// novo, a mesma falta que motivou esse badge existir.
function paymentValueFlag(items: RequestItem[]): PaymentFlag {
  if (items.length === 0) return "no_items";
  const withValue = items.filter((i) => i.unitValue != null).length;
  if (withValue === 0) return "none";
  if (withValue < items.length) return "partial";
  return "complete";
}

const PAYMENT_FLAG_LABELS: Record<PaymentFlag, string> = {
  none: "💰 Valor não definido",
  partial: "💰 Valor parcial",
  complete: "✓ Valor definido",
  no_items: "⚠ Sem produto cadastrado",
};
const PAYMENT_FLAG_COLORS: Record<PaymentFlag, string> = {
  none: "var(--status-critical)",
  partial: "#8a5a00",
  complete: "var(--status-good)",
  no_items: "var(--status-critical)",
};

// Cor fixa por tipo de serviço na aba Entregas -- pedido do Victor
// 21/08/2026: "Fixe a cor de cada tipo de serviço (Troca, Envio,
// Recolhimento)". Um tom por tipo, sem depender de status. Exportado --
// EntregasKanbanHoje.tsx (25/08/2026) reaproveita a mesma cor no card do
// Kanban, em vez de duplicar a tabela.
export const DELIVERY_TYPE_COLORS: Record<string, string> = {
  troca_produto: "var(--brand-orange)",
  entrega_produto: "var(--brand-green)",
  envio_peca: "var(--series-1)",
  recolhimento: "var(--series-4)",
  recolhimento_produto: "var(--series-5)",
  // Pedido do Victor 02/09/2026 -- series-7 (verde-água), não series-6
  // (vermelho, reservado pra alerta/crítico em outros lugares do app).
  envio_recolhimento_peca: "var(--series-7)",
};

// Tag compacta de aviso -- pedido do Victor 21/08/2026: "Mantenha a
// altura da linha fixa. Se houver observação, exiba uma tag amarela
// compacta... contendo apenas um ícone... Ao passar o mouse por cima
// (hover), o texto completo é exibido em um tooltip". `title` nativo do
// navegador já resolve o tooltip sem JS extra; o truncamento por largura
// máxima é o que garante altura fixa (nunca quebra linha, nunca empurra o
// resto do card pra baixo) -- como a observação é texto livre (não dá pra
// extrair "palavra-chave" de verdade sem NLP), o compromisso prático é
// cortar com reticências e confiar no tooltip pro texto inteiro.
// Preenchimento suave (14% da cor sobre branco) + texto na própria cor --
// Guia de Componentes Maia (Design System, 01/09/2026), mesma anatomia de
// badge usada em StatusBadge.tsx/tela da equipe técnica.
function WarningTag({ icon, text, color }: { icon?: string; text: string; color: string }) {
  return (
    <span
      title={text}
      className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap truncate max-w-[9rem] cursor-help"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, var(--surface-1))` }}
    >
      {icon ? `${icon} ` : ""}
      {text}
    </span>
  );
}

// Linha de tabela de verdade (não mais cards flex empilhados) -- pedido
// do Victor 01/09/2026: "os cards verticais espremidos... destroem a
// usabilidade em desktop... aplique o padrão de Tabela Grid Horizontal
// de Alta Densidade e Largura Total". 6 colunas fixas: ID/Tipo, Data/
// Período, Cliente, Produto, Logística, Ações -- mesmo espírito das
// larguras percentuais de antes (21/08/2026: "o olho do atendente busca
// o dado sempre na mesma coluna vertical"), só que como colunas de
// `<table>` de verdade em vez de flex simulando colunas (que quebrava
// pra cards empilhados em telas estreitas e ficava desalinhado).
//
// Linha inteira clicável via onClick (mesma razão de TodayRow,
// EntregasKanbanHoje.tsx: não dá pra embrulhar <tr> num <Link>, HTML
// inválido dentro de <table>) -- checkbox/setas (coluna própria) e
// ProductsModalButton já param propagação, então continuam funcionando
// sem navegar.
function EntregaCardRow({
  r,
  i,
  orderLength,
  reorderable,
  saving,
  onMoveUp,
  onMoveDown,
  printable,
  selected,
  onToggleSelected,
  effectiveDate,
  needsAttention,
  nodeRef,
}: {
  r: ServiceRequestSummary;
  i: number;
  orderLength: number;
  reorderable: boolean;
  saving: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  printable?: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  effectiveDate: string | null;
  needsAttention: boolean;
  // Callback ref pra animação FLIP de reordenar (ver `move` em
  // AssistenciaQueueGroup) -- precisa apontar pro <tr> de verdade, não
  // dava mais pra anexar direto de fora como antes (era um <div>).
  nodeRef: (el: HTMLTableRowElement | null) => void;
}) {
  const router = useRouter();
  const hasLeftColumn = printable || reorderable;
  const productSummary = r.items.map((item) => item.product).join(", ") || "—";

  return (
    <tr
      ref={nodeRef}
      onClick={() => router.push(`/assistencia/${r.id}`)}
      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 cursor-pointer"
      style={needsAttention ? { borderLeft: `4px solid ${r.escalationRisk ? "var(--status-critical)" : "var(--status-warning)"}` } : undefined}
    >
      {hasLeftColumn ? (
        <td className="pl-4 pr-2 py-3 align-top" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {printable ? (
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelected}
                className="rounded shrink-0"
                aria-label={`Selecionar #${r.ticketNumber}`}
              />
            ) : null}
            {reorderable ? (
              <div className="flex flex-col shrink-0">
                <button
                  onClick={onMoveUp}
                  disabled={i === 0 || saving}
                  aria-label="Mover pra cima"
                  className="text-xs leading-none px-1 disabled:opacity-25 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ▲
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={i === orderLength - 1 || saving}
                  aria-label="Mover pra baixo"
                  className="text-xs leading-none px-1 disabled:opacity-25 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ▼
                </button>
              </div>
            ) : null}
          </div>
        </td>
      ) : null}

      {/* Coluna 1: ID / Tipo */}
      <td className={`${hasLeftColumn ? "pl-2" : "pl-4"} pr-3 py-3 align-top whitespace-nowrap`}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">#{r.ticketNumber}</span>
          <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
        </div>
        <span
          className="inline-flex mt-1 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
          style={{
            color: `color-mix(in srgb, ${DELIVERY_TYPE_COLORS[r.type] ?? "#6B7280"} 70%, var(--foreground))`,
            background: `color-mix(in srgb, ${DELIVERY_TYPE_COLORS[r.type] ?? "#6B7280"} 14%, var(--surface-1))`,
          }}
        >
          {REQUEST_TYPE_LABELS[r.type] ?? r.type}
          {r.type === "troca_produto" && r.exchangeRound > 1 ? ` · ${r.exchangeRound}ª` : ""}
        </span>
        <div className="mt-1">
          <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
        </div>
      </td>

      {/* Coluna 2: Data / Período -- badge laranja discreto só quando
          urgente (Guia de Componentes Maia: laranja é reservado pra
          alerta, nunca decoração). */}
      <td className="px-3 py-3 align-top whitespace-nowrap">
        {effectiveDate ? (
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {formatDateOnly(effectiveDate)}
            {effectiveDate === r.scheduledDate && r.scheduledTime ? ` · ${r.scheduledTime.slice(0, 5)}` : ""}
            {effectiveDate === r.scheduledDate && r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500">Sem data</span>
        )}
        {r.urgent ? (
          <div className="mt-1">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
              style={{ color: "color-mix(in srgb, var(--brand-orange) 70%, var(--foreground))", background: "color-mix(in srgb, var(--brand-orange) 16%, var(--surface-1))" }}
            >
              URGENTE
            </span>
          </div>
        ) : null}
      </td>

      {/* Coluna 3: Cliente -- nome em destaque numa linha, CPF+bairro numa
          segunda linha pequena e cinza logo abaixo (nunca empilhado
          telefone/bairro/CPF cada um na própria linha, pedido do
          Victor). */}
      <td className="px-3 py-3 align-top max-w-[220px]">
        <div className="text-sm font-bold uppercase truncate text-gray-800 dark:text-gray-100">{r.clientName ?? "Sem nome de cliente"}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {r.clientCpf ?? "CPF não informado"}
          {r.clientNeighborhood ? ` · ${r.clientNeighborhood}` : ""}
        </div>
        {r.clientTimeRestriction || r.escalationRisk || r.deadlineStatus === "pendente" ? (
          <div className="flex items-center gap-1 flex-wrap mt-1">
            {r.clientTimeRestriction ? <WarningTag icon="🕐" text={r.clientTimeRestriction} color="#8a5a00" /> : null}
            {r.escalationRisk ? <WarningTag icon="⚠" text="Risco de escalonamento" color="var(--status-critical)" /> : null}
            {r.deadlineStatus === "pendente" ? <WarningTag icon="⚠" text="Prazo pendente" color="#8a5a00" /> : null}
          </div>
        ) : null}
      </td>

      {/* Coluna 4: Produto / Especificação -- texto corrido, uma linha só,
          truncado com tooltip pro texto inteiro. */}
      <td className="px-3 py-3 align-top text-gray-600 dark:text-gray-300 max-w-[280px] truncate" title={productSummary}>
        {productSummary}
      </td>

      {/* Coluna 5: Logística -- loja de origem, atendente, responsável,
          motorista. "Responsável" -- pedido do Victor 02/09/2026: "que
          apareça quem é o responsável por aquela demanda já na lista, sem
          precisar entrar na demanda". */}
      <td className="px-3 py-3 align-top text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        <div className="truncate">{r.storeName}</div>
        <div className="truncate">Atendente: {r.requestedByName ?? "—"}</div>
        <div className="truncate">Responsável: {r.assignedToName ?? "—"}</div>
        <div className="truncate">{r.driverName ? `Motorista: ${r.driverName}` : "Sem motorista"}</div>
      </td>

      {/* Coluna 6: Ações -- só "Ver produtos", alinhado à direita. */}
      <td className="pl-3 pr-4 py-3 align-top text-right">
        <ProductsModalButton items={r.items} />
      </td>
    </tr>
  );
}

// Linha de tabela com colunas fixas, aba Visitas -- pedido do Victor
// 22/08/2026: "alguns cards têm aviso em amarelo... outros mostram texto de
// loja... outros exibem o cliente. Trave o card em uma linha com colunas
// fixas: Col 1: Status + Tipo. Col 2: Cliente/Loja + Bairro. Col 3: Montador
// Responsável (ou tag Sem Montador). Col 4: Datas. Col 5: Ícone/Badge de
// Observação + Ver produtos". Mesmo esqueleto de EntregaCardRow (setas fora
// do <Link>, colunas 1-4 dentro de um <Link display:contents>, coluna de
// observação/ação fora) -- Visitas nunca é `printable` (ver fila/page.tsx),
// então não tem checkbox, só as setas de ordenação.
function VisitaCardRow({
  r,
  i,
  orderLength,
  reorderable,
  saving,
  onMoveUp,
  onMoveDown,
  effectiveDate,
  staleOpen,
  isPartialCompletion,
  paymentFlag,
  now,
}: {
  r: ServiceRequestSummary;
  i: number;
  orderLength: number;
  reorderable: boolean;
  saving: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  effectiveDate: string | null;
  staleOpen: boolean;
  isPartialCompletion: boolean;
  paymentFlag: PaymentFlag | null;
  now: number;
}) {
  // "Instrução pro montador" clicável -- pedido do Victor 22/08/2026: "O
  // bloco amarelo esticado... toma espaço vertical excessivo quando está
  // vazio ou com texto curto. Transforme-o em uma tag/ícone de alerta
  // clicável na linha do card. Ao passar o mouse (hover) ou clicar, exibe a
  // instrução". `title` já cobre o hover (tooltip nativo); o clique abre a
  // caixa completa abaixo da linha -- só nesse caso a altura do card cresce
  // (ação do usuário, não estado passivo, então não quebra o alinhamento
  // vertical da lista igual o bloco amarelo sempre-visível quebrava).
  const [instructionOpen, setInstructionOpen] = useState(false);
  const hasObservacoes =
    !!r.montadorInstruction || !!r.clientTimeRestriction || staleOpen || r.escalationRisk || r.deadlineStatus === "pendente" || !!paymentFlag;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-0">
        {/* Setas de ordenação (sem checkbox -- Visitas nunca é printable).
            `sm:justify-start`, não `sm:justify-center` -- achado do Victor
            23/08/2026 (print em anexo): a linha inteira fica com a altura da
            coluna mais alta (geralmente a Coluna 2, cliente/telefone/
            bairro/loja, 4 linhas), e a Coluna 1 (status+tipo) só tem 2
            linhas, ancoradas no topo por padrão -- com as setas centralizadas
            na altura TOTAL da linha, elas flutuavam no meio, sem alinhar com
            "Concluída" nem com "Montagem". Ancorando no topo igual a
            Coluna 1, as setas ficam nas mesmas linhas de verdade. */}
        <div className="w-full sm:w-[4%] shrink-0 flex sm:flex-col items-center sm:justify-start gap-2 sm:gap-0.5 sm:pr-2">
          {reorderable ? (
            <div className="flex sm:flex-col items-center gap-0.5 shrink-0">
              <button
                onClick={onMoveUp}
                disabled={i === 0 || saving}
                aria-label="Mover pra cima"
                className="text-sm leading-none px-1 disabled:opacity-25"
                style={{ color: "#4B5563" }}
              >
                ▲
              </button>
              <button
                onClick={onMoveDown}
                disabled={i === orderLength - 1 || saving}
                aria-label="Mover pra baixo"
                className="text-sm leading-none px-1 disabled:opacity-25"
                style={{ color: "#4B5563" }}
              >
                ▼
              </button>
            </div>
          ) : null}
        </div>

        <Link href={`/assistencia/${r.id}`} className="contents">
          {/* Coluna 1 (15%): status + tipo (com nuances de status: parcial,
              combo montagem+desmontagem, parada há tempo) */}
          <div className="w-full sm:w-[15%] shrink-0 flex flex-row sm:flex-col gap-2 sm:gap-1 min-w-0 items-center sm:items-start sm:pr-3">
            <div className="flex items-center gap-1 flex-wrap">
              <StatusBadge status={r.status} />
              <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
            </div>
            <span className="text-sm font-medium whitespace-nowrap" style={{ color: "#1F2937" }}>
              {REQUEST_TYPE_LABELS[r.type] ?? r.type}
            </span>
            {r.comboMontagemDesmontagem ? (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: "#8a4c0d", background: "color-mix(in srgb, var(--brand-orange) 14%, var(--surface-1))" }}
              >
                {r.type === "montagem" ? "+ desmontagem" : "+ montagem"}
              </span>
            ) : null}
            {isPartialCompletion ? (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: "#8a4c0d", background: "color-mix(in srgb, var(--brand-orange) 14%, var(--surface-1))" }}
              >
                ◐ Parcial
              </span>
            ) : null}
          </div>

          {/* Coluna 2 (28%): cliente/loja em destaque + bairro -- pedido do
              Victor: "Cliente/Loja em negrito + Bairro". Mostruário já vem
              com esse nome dentro do próprio clientName (ver
              isMostruarioRequest em serviceRequests.ts, ex: "Mostruário —
              Maia Barão"), então não precisa de lógica extra aqui pra
              diferenciar cliente de loja. */}
          <div className="w-full sm:w-[28%] shrink-0 flex flex-col gap-0.5 min-w-0 sm:pr-3">
            {/* Caixa alta -- mesmo pedido/motivo de EntregaCardRow (ver
                acima), guia de padronização 25/08/2026. */}
            <span className="text-sm font-bold truncate uppercase" style={{ color: "#1F2937" }}>
              {r.clientName ?? "Sem nome de cliente"}
            </span>
            <span className="text-xs font-semibold truncate" style={{ color: "#4B5563" }}>
              {r.clientPhone ?? "—"}
            </span>
            <span className="text-sm font-bold truncate" style={{ color: "#4B5563" }}>
              📍 {r.clientNeighborhood ?? "—"}
            </span>
            <span className="text-xs truncate" style={{ color: "#9CA3AF" }}>
              🏬 {r.storeName}
            </span>
          </div>

          {/* Coluna 3 (16%): montador + responsável -- tag vermelha quando
              não tem montador, pedido do Victor: "Em vez de deixar a
              palavra Não definido em cinza apagado, use uma tag em
              destaque (ex: Sem Montador) para atrair o olho do operador
              imediatamente". 🔧 identifica que é o montador (não outro
              tipo de nome/pessoa na linha) -- pedido do Victor 23/08/2026:
              "coloque, no bairro, aquele pino de localização que tinha e
              coloque algo tambem para identificar o montador". Responsável
              (assignedToName) empilhado embaixo -- pedido do Victor
              02/09/2026: "que apareça quem é o responsável por aquela
              demanda já na lista, sem precisar entrar na demanda". */}
          <div className="w-full sm:w-[16%] shrink-0 flex flex-col items-start justify-center gap-1 min-w-0 sm:pr-3">
            {r.assemblerName ? (
              <span className="text-sm font-semibold truncate" style={{ color: "#1F2937" }}>
                🔧 {r.assemblerName}
              </span>
            ) : (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: "var(--status-critical)", color: "#fff" }}
              >
                ⚠️ Sem Montador
              </span>
            )}
            <span className="text-xs truncate" style={{ color: "#9CA3AF" }}>
              Responsável: {r.assignedToName ?? "—"}
            </span>
          </div>

          {/* Coluna 4 (17%): datas de abertura e previsão */}
          <div className="w-full sm:w-[17%] shrink-0 flex flex-col gap-0.5 min-w-0 text-xs sm:pr-3" style={{ color: "#9CA3AF" }}>
            <span className="whitespace-nowrap">Aberta {new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
            {effectiveDate ? (
              <span className="whitespace-nowrap">
                Previsão: {formatDateOnly(effectiveDate)}
                {effectiveDate === r.scheduledDate && r.scheduledTime ? ` ${r.scheduledTime.slice(0, 5)}` : ""}
                {effectiveDate === r.scheduledDate && r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
              </span>
            ) : (
              <span className="whitespace-nowrap">Sem previsão</span>
            )}
            {r.completedAt ? <span className="whitespace-nowrap">Concluída {formatDateTimeShortBr(r.completedAt)}</span> : null}
            {r.urgent ? (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap self-start"
                style={{ color: "#fff", background: "var(--status-critical)" }}
              >
                URGENTE
              </span>
            ) : null}
          </div>
        </Link>

        {/* Coluna 5 (20%): ícone/badge de observação + Ver produtos -- fora
            do <Link>, são controles próprios (botão de instrução é
            clicável, Ver produtos abre modal). `min-w-0` -- sem isso (achado
            do Victor 22/08/2026: "quando tem tres badges as duas primeiras
            ficam... deslocadas à coluna do lado") a largura mínima
            automática do item flex vira o min-content dos badges (2-3
            badges de até 9rem cada não cabem em 20%), forçando a coluna
            inteira a ficar mais larga que o previsto e invadir a coluna 4
            ao lado -- mesmo problema, mesma causa, mesmo fix que todas as
            outras colunas já tinham (ver Coluna 2-4 acima), só essa aqui
            que ficou faltando.
            Empilhamento vertical explícito (`flex-col`), não mais
            `flex-wrap` horizontal -- achado do Victor 23/08/2026 (prints
            em anexo, persistiu mesmo após o fix do min-w-0 acima): com 2-3
            badges, o `flex-wrap` deixava a decisão de quebrar linha pro
            cálculo de largura disponível, que em alguns navegadores/zoom
            ficava visualmente apertado o bastante pra parecer que os
            badges se tocavam. Empilhar cada badge na própria linha, sem
            depender de wrap nenhum, elimina essa ambiguidade de vez --
            cada linha tem sua altura garantida, sem cálculo de quebra. */}
        <div className="w-full sm:w-[20%] shrink-0 min-w-0 flex flex-col gap-2 items-start">
          {hasObservacoes ? (
            <div className="flex flex-col gap-1.5 items-start w-full">
              {r.montadorInstruction ? (
                <button
                  type="button"
                  title={r.montadorInstruction}
                  onClick={() => setInstructionOpen((v) => !v)}
                  className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-pointer"
                  style={{ color: "#8a5a00", background: "color-mix(in srgb, var(--status-warning) 14%, var(--surface-1))" }}
                >
                  📋 Instrução
                </button>
              ) : null}
              {r.clientTimeRestriction ? <WarningTag icon="🕐" text={r.clientTimeRestriction} color="#8a5a00" /> : null}
              {staleOpen ? (
                <WarningTag
                  icon="⏱"
                  text={`parada há ${Math.floor((now - new Date(r.createdAt).getTime()) / 3_600_000)}h`}
                  color="var(--status-critical)"
                />
              ) : null}
              {r.escalationRisk ? <WarningTag icon="⚠" text="Risco de escalonamento" color="var(--status-critical)" /> : null}
              {r.deadlineStatus === "pendente" ? <WarningTag icon="⚠" text="Prazo pendente" color="#8a5a00" /> : null}
              {paymentFlag ? <WarningTag text={PAYMENT_FLAG_LABELS[paymentFlag]} color={PAYMENT_FLAG_COLORS[paymentFlag]} /> : null}
            </div>
          ) : null}
          <ProductsModalButton items={r.items} />
        </div>
      </div>

      {instructionOpen && r.montadorInstruction ? (
        <div
          className="rounded-lg p-2.5 sm:ml-[4%]"
          style={{ background: "color-mix(in srgb, var(--status-warning) 12%, #ffffff)", border: "2px solid var(--status-warning)" }}
        >
          <p className="text-sm whitespace-pre-line" style={{ color: "#1F2937" }}>
            {r.montadorInstruction}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Fila reordenável com feedback visual: ao clicar ▲▼, os dois cards que
// trocam de lugar deslizam pra posição nova em vez de simplesmente
// "teleportar" -- técnica FLIP (mede a posição antes de trocar o estado,
// depois anima do delta até zero), sem precisar de biblioteca nova. Mesma
// ideia de mover-e-persistir de DriverRouteGroup.tsx (setas ▲▼, grava em
// segundo plano com trava de corrida via expectedOrder), adaptada pra fila
// da assistência: só reordena dentro do grupo do dia mostrado na tela, não
// mistura ordem entre dias diferentes.
export function AssistenciaQueueGroup({
  items,
  reorderable,
  now,
  showCreatedDate,
  printable,
  showStaleBadge = true,
}: {
  items: ServiceRequestSummary[];
  reorderable: boolean;
  // Vem do servidor (ver fila/page.tsx) em vez de Date.now() aqui dentro --
  // esse componente usa hooks ("use client"), e chamar função impura direto
  // no corpo do render quebra a regra de pureza do React Compiler.
  now: number;
  // Grupo por data (aba Visitas) já deixa a data óbvia no cabeçalho do
  // grupo -- só repete aqui (dentro do card) quando o agrupamento é por
  // outra coisa, ex. rota (aba Entregas), pedido do Victor 18/08/2026.
  showCreatedDate?: boolean;
  // Seleção em bloco pra imprimir vários despachos de uma vez -- só na aba
  // Entregas (pedido do Victor 19/08/2026: "estenda pra aba entregas",
  // mesma seleção que já existia em NotificacoesList.tsx, ver PR #108).
  // Seleção fica por grupo (cada grupo já é uma rota+data aqui, ver
  // groupByRota em fila/page.tsx), não precisa atravessar grupos.
  printable?: boolean;
  // "Parada há Xh" só faz sentido pra visita de montador (aba Visitas) --
  // pedido do Victor 21/08/2026: "na aba de notificação de assistência...
  // não precisa estar ali, só tem sentido estar na aba de montagem e
  // desmontagem". Entrega/notificação (aba Entregas) usa outro sinal de
  // atraso, o prazo (📅), não tempo parado sem contato.
  showStaleBadge?: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [saving, setSaving] = useState(false);
  const [syncedItems, setSyncedItems] = useState(items);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // HTMLElement genérico, não HTMLDivElement -- Entregas agora ancora em
  // <tr> (EntregaCardRow), Visitas continua em <div> (VisitaCardRow); as
  // duas são HTMLElement, é só o que a animação FLIP abaixo precisa
  // (getBoundingClientRect/style).
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const prevRects = useRef<Map<string, DOMRect> | null>(null);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Selecionar todas" desse grupo (cada grupo já é uma rota+data aqui, ver
  // groupByRota em fila/page.tsx) -- pedido do Victor 21/08/2026: precisa
  // existir tanto aqui (admin/assistência) quanto em NotificacoesList.tsx
  // (SAC/admin), e selecionando tudo de um dia/rota específico de uma vez,
  // não item por item.
  const allSelected = items.length > 0 && items.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((r) => r.id)));
  }

  // Mesmo ajuste-durante-render de DriverRouteGroup.tsx: RealtimeQueueRefresher
  // traz dado novo do Server Component pai sem remontar este client component.
  if (items !== syncedItems && !saving) {
    setSyncedItems(items);
    setOrder(items);
  }

  useLayoutEffect(() => {
    const prev = prevRects.current;
    if (!prev) return;
    prevRects.current = null;
    for (const [id, el] of nodeRefs.current) {
      const before = prev.get(id);
      if (!before) continue;
      const after = el.getBoundingClientRect();
      const deltaY = before.top - after.top;
      if (deltaY) {
        el.style.transition = "none";
        el.style.transform = `translateY(${deltaY}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 220ms ease";
          el.style.transform = "";
        });
      }
    }
  }, [order]);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;

    const rects = new Map<string, DOMRect>();
    for (const [id, el] of nodeRefs.current) rects.set(id, el.getBoundingClientRect());
    prevRects.current = rects;

    const previous = order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setSaving(true);
    try {
      await setAssistenciaOrderAction(next.map((r) => ({ id: r.id, expectedOrder: r.assistenciaOrder })));
      // Reflete localmente o assistencia_order que acabou de ser gravado,
      // senão o próximo clique manda um expectedOrder desatualizado.
      setOrder(next.map((r, i) => ({ ...r, assistenciaOrder: i + 1 })));
    } catch {
      setOrder(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {printable ? (
        <div className="flex items-center gap-3 flex-wrap px-4 pt-2">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "#4B5563" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
            Selecionar todas
          </label>
        </div>
      ) : null}
      {/* Barra flutuante fixa no rodapé -- pedido do Victor 21/08/2026:
          "ao marcar um ou mais checkboxes, apareça uma barra fixa na
          parte inferior da tela com os botões [ Mover X Selecionados ] e
          [ Imprimir Selecionados ]. Isso elimina a necessidade de rolar a
          página para cima". Mesmo padrão de barra flutuante já usado em
          PedidoEncomendaFilaList.tsx (bottom-20 no mobile por causa da
          barra de navegação inferior, bottom-4 no desktop). */}
      {printable && selected.size > 0 ? (
        <div
          className="fixed bottom-20 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto z-40 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg flex-wrap"
          style={{ background: "var(--surface-1)", borderColor: "var(--brand-green)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {selected.size} selecionada{selected.size === 1 ? "" : "s"}
          </span>
          <Link
            href={`/assistencia/despacho-lote?ids=${[...selected].join(",")}`}
            target="_blank"
            className="text-sm rounded-full px-3 py-1.5 font-medium border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            🖨️ Imprimir selecionados
          </Link>
          {/* Mudar motorista/rota em bloco -- pedido do Victor
              21/08/2026: "preciso de uma forma de selecionar em bloco,
              no meu acesso de admin, para mudar aquelas notificações
              para outro motorista/rota". Mesmo BulkRotaBar já usado na
              aba do SAC (NotificacoesList.tsx), reaproveitado aqui em
              vez de duplicado. */}
          <BulkRotaBar
            selectedIds={[...selected]}
            count={selected.size}
            onDone={() => {
              setSelected(new Set());
              router.refresh();
            }}
            onPartialProgress={() => router.refresh()}
            onCancel={() => setSelected(new Set())}
          />
        </div>
      ) : null}
      {showCreatedDate ? (
        // Aba Entregas -- Tabela Grid Horizontal de Alta Densidade e
        // Largura Total (Guia de Componentes Maia, Design System
        // 01/09/2026), substitui os cards empilhados de antes. Cabeçalho
        // próprio aqui (não em EntregaCardRow) -- é renderizado uma vez
        // por grupo (cada grupo já é um dia+rota, ver EntregasGroupsList),
        // mesmo padrão de cabeçalho repetido por instância que
        // DeliveryItemsTable.tsx já usa.
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: "980px" }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                {(printable || reorderable ? [""] : ([] as string[]))
                  .concat(["ID / Tipo", "Data / Período", "Cliente", "Produto", "Logística", ""])
                  .map((h, idx) => (
                    <th key={idx} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {order.map((r, i) => {
                const needsAttention = r.deadlineStatus === "pendente" || r.escalationRisk;
                // Só scheduledDate (ScheduleField) ou approvedDeadline
                // (approveDeadline/rejectDeadline) -- as duas são decisão
                // da assistência. De propósito SEM cair pra
                // requestedDeadline (o pedido da loja, ainda não
                // aprovado): mostrar isso aqui como se fosse a data
                // definida enganaria quem tá vendo a fila -- pra esse
                // caso já existe o badge "Prazo pendente".
                const effectiveDate = r.scheduledDate ?? r.approvedDeadline;
                return (
                  <EntregaCardRow
                    key={r.id}
                    r={r}
                    i={i}
                    orderLength={order.length}
                    reorderable={reorderable}
                    saving={saving}
                    onMoveUp={() => move(i, -1)}
                    onMoveDown={() => move(i, 1)}
                    printable={printable}
                    selected={selected.has(r.id)}
                    onToggleSelected={() => toggleSelected(r.id)}
                    effectiveDate={effectiveDate}
                    needsAttention={needsAttention}
                    nodeRef={(el) => {
                      if (el) nodeRefs.current.set(r.id, el);
                      else nodeRefs.current.delete(r.id);
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {order.map((r, i) => {
            const needsAttention = r.deadlineStatus === "pendente" || r.escalationRisk;
            const effectiveDate = r.scheduledDate ?? r.approvedDeadline;
            // "Concluída parcialmente" não é um status próprio -- vira
            // "remarcar" com os itens já feitos marcados (ver
            // montadorCompletePartially em montador-actions.ts).
            const isPartialCompletion = r.status === "remarcar" && r.items.some((item) => item.completed);
            // Só montagem/desmontagem tem valor de montador a pagar por
            // item -- confirmado com o usuário que troca de peça não
            // entra aqui (#4588 era falso positivo).
            const showPaymentFlag = (r.type === "montagem" || r.type === "desmontagem") && (r.status === "concluida" || isPartialCompletion);
            const paymentFlag = showPaymentFlag ? paymentValueFlag(r.items) : null;
            // "Aberta" parada há muito tempo sem ninguém sequer entrar em
            // contato -- indício de triagem esquecida, não de trabalho em
            // andamento (esse já muda pra "em_contato"/"em_andamento").
            const staleOpen = showStaleBadge && r.status === "aberta" && now - new Date(r.createdAt).getTime() > 4 * 3_600_000;

            return (
              <div
                key={r.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(r.id, el);
                  else nodeRefs.current.delete(r.id);
                }}
                className="flex flex-col gap-2 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                style={needsAttention ? { borderLeft: `4px solid ${r.escalationRisk ? "var(--status-critical)" : "var(--status-warning)"}` } : undefined}
              >
                {/* Aba Visitas -- tabela de colunas fixas (ver
                    VisitaCardRow acima), sem mudança nessa leva (só a
                    Entregas quebrava a harmonia visual em desktop, ver
                    EntregaCardRow). */}
                <VisitaCardRow
                  r={r}
                  i={i}
                  orderLength={order.length}
                  reorderable={reorderable}
                  saving={saving}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, 1)}
                  effectiveDate={effectiveDate}
                  staleOpen={staleOpen}
                  isPartialCompletion={isPartialCompletion}
                  paymentFlag={paymentFlag}
                  now={now}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
