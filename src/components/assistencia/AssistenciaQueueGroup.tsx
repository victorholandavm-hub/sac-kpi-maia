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
  partial: "var(--status-warning)",
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
function WarningTag({ icon, text, color }: { icon?: string; text: string; color: string }) {
  return (
    <span
      title={text}
      className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap truncate max-w-[9rem] cursor-help"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
    >
      {icon ? `${icon} ` : ""}
      {text}
    </span>
  );
}

// Linha de tabela com 6 colunas de largura fixa (percentual), só pra aba
// Entregas -- pedido do Victor 21/08/2026: "trave o card com larguras
// percentuais fixas para cada dado. Assim, ao rolar a tela, o olho do
// atendente busca o dado sempre na mesma coluna vertical". Empilha em
// coluna única no celular (w-full) e vira linha de verdade a partir do
// `sm:` -- larguras percentuais só fazem sentido numa tela larga o
// bastante pra caber as 6 colunas lado a lado sem espremer.
//
// Coluna 1 (checkbox+setas) e coluna 6 (Ver produtos) ficam FORA do
// <Link> -- são controles clicáveis próprios, não podem estar dentro de
// um link (cliques neles não podem navegar pro chamado). As colunas 2-5
// entram numa <Link style={{display:"contents"}}> -- isso faz o próprio
// <a> não gerar caixa nenhuma no layout, então os 4 filhos viram itens
// diretos do flex container externo (cada um com sua largura percentual
// certa), mesmo estando dentro do link.
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
  showStaleBadge,
  now,
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
  showStaleBadge: boolean;
  now: number;
}) {
  // Sempre false na prática (showStaleBadge vem false pra Entregas, ver
  // AssistenciaQueueGroup) -- mantido genérico só caso esse componente
  // seja reaproveitado num contexto onde volte a fazer sentido.
  const staleOpen = showStaleBadge && r.status === "aberta" && now - new Date(r.createdAt).getTime() > 4 * 3_600_000;

  return (
    <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-0">
      {/* Coluna 1 (5%): checkbox + setas de ordenação. `sm:pr-3` em todas as
          colunas (menos a última) -- pedido do Victor 22/08/2026: "os
          elementos ainda variam de posição dependendo do tamanho do nome do
          cliente". As colunas já são 100% fixas em largura (confirmado via
          medição real: mesma coordenada X em toda notificação, mesmo com
          nome de 40+ caracteres truncando) -- o problema era zero espaço
          entre colunas (`sm:gap-0` no container), então um nome no limite do
          truncamento encostava literalmente na coluna seguinte, parecendo
          desalinhado mesmo sem estar. `pr-3` (padding interno, não gap)
          evita esse encostamento sem risco de estourar a largura total. */}
      {/* `sm:justify-start`, não `sm:justify-center` -- mesmo achado do
          Victor 23/08/2026 na aba Visitas (ver VisitaCardRow): a linha toda
          fica com a altura da coluna mais alta (geralmente a Coluna 4,
          cliente), e checkbox+setas centralizados na altura TOTAL flutuam
          sem alinhar com o conteúdo top-anchored da Coluna 2 (ID+status). */}
      <div className="w-full sm:w-[5%] shrink-0 flex sm:flex-col items-center sm:justify-start gap-2 sm:gap-0.5 sm:pr-3">
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
          <div className="flex sm:flex-col items-center gap-0.5 shrink-0">
            <button
              onClick={onMoveUp}
              disabled={i === 0 || saving}
              aria-label="Mover pra cima"
              className="text-sm leading-none px-1 disabled:opacity-25"
              style={{ color: "var(--text-secondary)" }}
            >
              ▲
            </button>
            <button
              onClick={onMoveDown}
              disabled={i === orderLength - 1 || saving}
              aria-label="Mover pra baixo"
              className="text-sm leading-none px-1 disabled:opacity-25"
              style={{ color: "var(--text-secondary)" }}
            >
              ▼
            </button>
          </div>
        ) : null}
      </div>

      {/* display:contents -- sem hover:opacity aqui, opacity não tem efeito
          num elemento sem caixa própria (os filhos que viram itens diretos
          do flex são o que realmente aparece). */}
      <Link href={`/assistencia/${r.id}`} className="contents">
        {/* Coluna 2 (12%): ID + status */}
        <div className="w-full sm:w-[12%] shrink-0 flex flex-row sm:flex-col gap-2 sm:gap-1 min-w-0 items-center sm:items-start sm:pr-3">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            #{r.ticketNumber}
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <DeliveryStatusBadge status={r.status} scheduledDate={r.scheduledDate} rota={r.rota} />
            <NewSinceBadge createdAt={r.createdAt} storageKey="fila-montagem-last-seen" />
          </div>
        </div>

        {/* Coluna 3 (18%): tipo de serviço + data/turno */}
        <div className="w-full sm:w-[18%] shrink-0 flex flex-row sm:flex-col gap-2 sm:gap-1 min-w-0 items-center sm:items-start sm:pr-3">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: DELIVERY_TYPE_COLORS[r.type] ?? "var(--text-muted)", color: "#fff" }}
          >
            {REQUEST_TYPE_LABELS[r.type] ?? r.type}
            {r.type === "troca_produto" && r.exchangeRound > 1 ? ` · ${r.exchangeRound}ª` : ""}
          </span>
          {/* Data em destaque -- pedido do Victor 27/08/2026: "a data nas
              notificações fiquem maiores de mais visiveis" (antes
              text-xs cinza apagado, quase do mesmo peso visual do "Sem
              data"). Segue o mesmo padrão de ênfase que o nome do
              cliente/bairro já usam na coluna ao lado (text-sm font-bold,
              --text-primary). */}
          <span className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
            {effectiveDate ? (
              <>
                📅 {formatDateOnly(effectiveDate)}
                {effectiveDate === r.scheduledDate && r.scheduledTime ? ` ${r.scheduledTime.slice(0, 5)}` : ""}
                {effectiveDate === r.scheduledDate && r.shift ? ` · ${SHIFT_LABELS[r.shift]}` : ""}
              </>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>Sem data</span>
            )}
          </span>
          {r.urgent ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ color: "#fff", background: "var(--status-critical)" }}
            >
              URGENTE
            </span>
          ) : null}
        </div>

        {/* Coluna 4 (35%): cliente em destaque, telefone, bairro +
            observações (tag compacta, altura fixa -- ver WarningTag) --
            pedido do Victor 21/08/2026: "padronize a tipografia do nome
            do cliente, telefone e bairro em negrito e tamanho legível". */}
        <div className="w-full sm:w-[35%] shrink-0 flex flex-col gap-0.5 min-w-0 sm:pr-3">
          {/* Caixa alta -- pedido do Victor 25/08/2026 ("guia de
              padronização"): "Nome do Cliente (Bold, caixa alta)". Só
              visual (Tailwind `uppercase`), o dado no banco continua com
              a grafia original. */}
          <span className="text-sm font-bold truncate uppercase" style={{ color: "var(--text-primary)" }}>
            {r.clientName ?? "Sem nome de cliente"}
          </span>
          <span className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
            {r.clientPhone ?? "—"}
          </span>
          <span className="text-sm font-bold truncate" style={{ color: "var(--text-secondary)" }}>
            {r.clientNeighborhood ?? "—"}
          </span>
          {r.clientTimeRestriction || staleOpen || r.escalationRisk || r.deadlineStatus === "pendente" ? (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {r.clientTimeRestriction ? <WarningTag icon="🕐" text={r.clientTimeRestriction} color="var(--status-warning)" /> : null}
              {staleOpen ? (
                <WarningTag
                  icon="⏱"
                  text={`parada há ${Math.floor((now - new Date(r.createdAt).getTime()) / 3_600_000)}h`}
                  color="var(--status-critical)"
                />
              ) : null}
              {r.escalationRisk ? <WarningTag icon="⚠" text="Risco de escalonamento" color="var(--status-critical)" /> : null}
              {r.deadlineStatus === "pendente" ? <WarningTag icon="⚠" text="Prazo pendente" color="var(--status-warning)" /> : null}
            </div>
          ) : null}
        </div>

        {/* Coluna 5 (20%): loja de origem, atendente que criou, motorista */}
        <div className="w-full sm:w-[20%] shrink-0 flex flex-col gap-0.5 min-w-0 text-xs sm:pr-3" style={{ color: "var(--text-muted)" }}>
          <span className="truncate">{r.storeName}</span>
          <span className="truncate">Atendente: {r.requestedByName ?? "—"}</span>
          <span className="truncate">{r.driverName ? `Motorista: ${r.driverName}` : "Sem motorista"}</span>
        </div>
      </Link>

      {/* Coluna 6 (10%): Ver produtos -- fora do <Link>, é botão próprio */}
      <div className="w-full sm:w-[10%] shrink-0 flex items-center justify-start sm:justify-center">
        <ProductsModalButton items={r.items} />
      </div>
    </div>
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
                style={{ color: "var(--text-secondary)" }}
              >
                ▲
              </button>
              <button
                onClick={onMoveDown}
                disabled={i === orderLength - 1 || saving}
                aria-label="Mover pra baixo"
                className="text-sm leading-none px-1 disabled:opacity-25"
                style={{ color: "var(--text-secondary)" }}
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
            <span className="text-sm font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
              {REQUEST_TYPE_LABELS[r.type] ?? r.type}
            </span>
            {r.comboMontagemDesmontagem ? (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
              >
                {r.type === "montagem" ? "+ desmontagem" : "+ montagem"}
              </span>
            ) : null}
            {isPartialCompletion ? (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--brand-orange) 35%, var(--surface-1))" }}
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
            <span className="text-sm font-bold truncate uppercase" style={{ color: "var(--text-primary)" }}>
              {r.clientName ?? "Sem nome de cliente"}
            </span>
            <span className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
              {r.clientPhone ?? "—"}
            </span>
            <span className="text-sm font-bold truncate" style={{ color: "var(--text-secondary)" }}>
              📍 {r.clientNeighborhood ?? "—"}
            </span>
            <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              🏬 {r.storeName}
            </span>
          </div>

          {/* Coluna 3 (16%): montador responsável -- tag vermelha quando
              não tem, pedido do Victor: "Em vez de deixar a palavra Não
              definido em cinza apagado, use uma tag em destaque (ex: Sem
              Montador) para atrair o olho do operador imediatamente".
              🔧 identifica que é o montador (não outro tipo de nome/pessoa
              na linha) -- pedido do Victor 23/08/2026: "coloque, no
              bairro, aquele pino de localização que tinha e coloque algo
              tambem para identificar o montador". */}
          <div className="w-full sm:w-[16%] shrink-0 flex items-center min-w-0 sm:pr-3">
            {r.assemblerName ? (
              <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
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
          </div>

          {/* Coluna 4 (17%): datas de abertura e previsão */}
          <div className="w-full sm:w-[17%] shrink-0 flex flex-col gap-0.5 min-w-0 text-xs sm:pr-3" style={{ color: "var(--text-muted)" }}>
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
                  style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--status-warning) 35%, var(--surface-1))" }}
                >
                  📋 Instrução
                </button>
              ) : null}
              {r.clientTimeRestriction ? <WarningTag icon="🕐" text={r.clientTimeRestriction} color="var(--status-warning)" /> : null}
              {staleOpen ? (
                <WarningTag
                  icon="⏱"
                  text={`parada há ${Math.floor((now - new Date(r.createdAt).getTime()) / 3_600_000)}h`}
                  color="var(--status-critical)"
                />
              ) : null}
              {r.escalationRisk ? <WarningTag icon="⚠" text="Risco de escalonamento" color="var(--status-critical)" /> : null}
              {r.deadlineStatus === "pendente" ? <WarningTag icon="⚠" text="Prazo pendente" color="var(--status-warning)" /> : null}
              {paymentFlag ? <WarningTag text={PAYMENT_FLAG_LABELS[paymentFlag]} color={PAYMENT_FLAG_COLORS[paymentFlag]} /> : null}
            </div>
          ) : null}
          <ProductsModalButton items={r.items} />
        </div>
      </div>

      {instructionOpen && r.montadorInstruction ? (
        <div
          className="rounded-lg p-2.5 sm:ml-[4%]"
          style={{ background: "color-mix(in srgb, var(--status-warning) 12%, var(--surface-1))", border: "2px solid var(--status-warning)" }}
        >
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
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
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
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
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
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
      <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
      {order.map((r, i) => {
        const needsAttention = r.deadlineStatus === "pendente" || r.escalationRisk;
        // Só scheduledDate (ScheduleField) ou approvedDeadline
        // (approveDeadline/rejectDeadline) -- as duas são decisão da
        // assistência. De propósito SEM cair pra requestedDeadline (o pedido
        // da loja, ainda não aprovado): mostrar isso aqui como se fosse a
        // data definida enganaria quem tá vendo a fila -- pra esse caso já
        // existe o badge "Prazo pendente".
        const effectiveDate = r.scheduledDate ?? r.approvedDeadline;
        // "Concluída parcialmente" não é um status próprio -- vira
        // "remarcar" com os itens já feitos marcados (ver
        // montadorCompletePartially em montador-actions.ts).
        const isPartialCompletion = r.status === "remarcar" && r.items.some((item) => item.completed);
        // Só montagem/desmontagem tem valor de montador a pagar por item --
        // confirmado com o usuário que troca de peça não entra aqui (#4588
        // era falso positivo).
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
            className="flex flex-col gap-2 p-4"
            style={needsAttention ? { borderLeft: `4px solid ${r.escalationRisk ? "var(--status-critical)" : "var(--status-warning)"}` } : undefined}
          >
          {showCreatedDate ? (
            // Aba Entregas -- tabela de 6 colunas fixas (ver EntregaCardRow
            // acima), não o layout fluido de badges variados da Visitas.
            // Esse componente já cuida do checkbox/setas (coluna 1) e do
            // botão Ver produtos (coluna 6) por dentro -- nada fica de fora
            // dele nesse ramo.
            <EntregaCardRow
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
              showStaleBadge={showStaleBadge}
              now={now}
            />
          ) : (
            // Aba Visitas -- tabela de colunas fixas (ver VisitaCardRow
            // acima), mesma ideia de Entregas: card sempre com a mesma
            // altura, sem depender de quais avisos/campos essa notificação
            // específica tem.
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
          )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
