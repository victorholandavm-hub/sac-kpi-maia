"use client";

import { useState } from "react";
import {
  setRotaDriverAssignment as assistenciaSetRotaDriverAssignment,
  addRotaExtra as assistenciaAddRotaExtra,
  removeRotaExtra as assistenciaRemoveRotaExtra,
  getRotaDriverAssignmentsAction as assistenciaGetRotaDriverAssignments,
} from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import {
  CG_ROTAS,
  JP_EXTRA_ROTA,
  JP_PRIMARY_ROTAS,
  ROTA_LABELS,
  ROTA_COLORS,
  WEEKDAY_LABELS,
  labelAvailableRota,
  type Rota,
  type RotaDayOverview,
  type RotaDriverAssignments,
} from "@/lib/rotas";

type RotaActions = {
  setRotaDriverAssignment: (date: string, rota: string, driverName: string) => Promise<{ updatedCount: number }>;
  addRotaExtra: (date: string, rota: string, driverName: string) => Promise<{ updatedCount: number }>;
  removeRotaExtra: (id: string) => Promise<void>;
  getRotaDriverAssignments: (date: string) => Promise<RotaDriverAssignments>;
};

// Ações padrão = assistência/SAC/admin (getProfile). Everton (expedição, ver
// DISPATCH_SUPERVISOR_DRIVERS) reaproveita esse mesmo componente a partir do
// app do motorista (pedido do Victor 19/08/2026), passando as versões
// autenticadas por sessão de PIN em vez de Supabase Auth (ver
// driver-actions.ts) via a prop `actions` -- resto do componente idêntico,
// só troca de onde vem a permissão.
const DEFAULT_ACTIONS: RotaActions = {
  setRotaDriverAssignment: assistenciaSetRotaDriverAssignment,
  addRotaExtra: assistenciaAddRotaExtra,
  removeRotaExtra: assistenciaRemoveRotaExtra,
  getRotaDriverAssignments: assistenciaGetRotaDriverAssignments,
};

// "Motorista do dia" -- painel de calendário (semana atual + seguinte) com a
// rota já pré-preenchida pelo padrão semanal (rota_weekday_config): no dia a
// dia só falta escolher o motorista. Mudar a rota em si (exceção pro padrão)
// fica atrás do lápis, pra não competir visualmente com o que é escolhido
// toda hora.
//
// Virou grade de calendário (pedido do Victor 18/08/2026 -- antes era uma
// lista vertical de linhas, uma por dia, ocupando muito mais altura pra
// mostrar a mesma informação). `overview` já vem sempre começando numa
// segunda-feira (ver startOfRotaWeek/getRotaWeekOverview), então dá pra
// fatiar direto em duas semanas de 7 dias sem recalcular nada.
//
// Só existe UMA rota principal por dia (pedido do Victor 17/08/2026 -- antes
// dava pra editar praia/sul/centro como 3 slots independentes pro mesmo
// dia). Rota extra não tem limite de quantidade.
const WEEKDAY_SHORT = WEEKDAY_LABELS.map((w) => w.slice(0, 3));

// Quantos dias aparecem recolhido por padrão -- ver comentário em
// `showAllDays` no componente. Grid é flexível (minmax 380px, sem
// número fixo de colunas), então não dá pra saber exatamente quantos
// cabem numa fileira em cada tela -- nas telas onde esse painel mora
// (largura de container ~1024px), 2 é o que cabe numa fileira só, com
// a célula bem maior de 24/08/2026 (João Pessoa + Campina Grande lado a
// lado).
const DEFAULT_VISIBLE_DAYS = 2;

// Resumo de uma linha pro cabeçalho do painel recolhido -- pedido do
// Victor 25/08/2026 (revisão da tela de notificações): "o bloco
// 'Motorista do dia' consome bastante espaço vertical... transforme
// essa área em um painel retrátil, deixe apenas um resumo compacto em
// linha". Só a rota principal (João Pessoa) + as 2 de Campina Grande --
// rota extra genérica de JP entra só como contador ("+N extra"), não
// teria espaço pra listar motorista de cada uma numa linha só.
function daySummaryLabel(day: RotaDayOverview): string {
  const rota = day.assignments.primary?.rota ?? day.expectedRota;
  const driver = day.assignments.primary?.driverName;
  const primaryPart = rota ? `${ROTA_LABELS[rota]}${driver ? `: ${driver}` : " (sem motorista)"}` : "Sem rota";
  const cgParts = CG_ROTAS.map((r) => {
    const assignment = day.assignments.extras.find((e) => e.rota === r);
    return `${ROTA_LABELS[r]}: ${assignment ? assignment.driverName : "—"}`;
  });
  const jpExtrasCount = day.assignments.extras.filter((e) => e.rota === JP_EXTRA_ROTA).length;
  const extraPart = jpExtrasCount > 0 ? [`+${jpExtrasCount} extra${jpExtrasCount > 1 ? "s" : ""}`] : [];
  return [primaryPart, ...cgParts, ...extraPart].join(" · ");
}

export function RotaMotoristaDoDia({
  today,
  initialOverview,
  drivers,
  actions = DEFAULT_ACTIONS,
  compact,
  defaultDriver,
  buttonOnly,
}: {
  today: string;
  initialOverview: RotaDayOverview[];
  drivers: string[];
  actions?: RotaActions;
  // Everton/Samuel (expedição) não precisam da semana inteira, só hoje +
  // amanhã (pedido do Victor 19/08/2026) -- sem grade de calendário nem
  // "mostrar semana seguinte", só 2 células bem maiores (o pedido era
  // justamente deixar os botões de editar/rota extra maiores, e menos
  // células no mesmo espaço já resolve isso sozinho). `initialOverview` já
  // vem só com os 2 dias nesse modo (ver motorista/page.tsx).
  compact?: boolean;
  // Motorista pré-selecionado (e já exibido, mesmo sem editar) quando um
  // dia ainda não tem motorista salvo -- pedido do Victor 21/08/2026
  // ("deixe Junior como motorista padrão da aba de notificação de
  // assistência"), ampliado em 26/08/2026 ("coloque por padrão, o
  // motorista junior na rota do dia de joao pessoa") pra também valer na
  // aba Entregas da própria assistência (ver fila/page.tsx), não só na
  // notificação do SAC. Só preenche quando o dia ainda não tem motorista
  // salvo -- não sobrescreve atribuição já feita. Sempre o mesmo valor de
  // JP_DEFAULT_DRIVER (rotas.ts) -- desde 27/08/2026 esse painel só
  // ESPELHA o que getAvailableRotasForDate já resolve de verdade pro
  // agendamento (Junior, ver comentário lá), não é mais só decoração
  // visual sem efeito nenhum.
  defaultDriver?: string;
  // Só o botão "Gestão de Motoristas & Escala", sem a barra (rótulo +
  // resumo de uma linha) em volta -- pedido do Victor 02/09/2026: "a
  // gestao de motorista e escala deve ficar ao lado de 'hoje' e só o
  // botão". Usado quando esse componente é passado como `motoristaAction`
  // pra EntregasKanbanHoje.tsx (renderiza ao lado do rótulo "📌 Hoje"),
  // no lugar da barra própria que ficava solta acima do quadro -- só
  // existe no modo não-compact (Everton/Samuel continuam com a barra
  // recolhível de sempre).
  buttonOnly?: boolean;
}) {
  const [overview, setOverview] = useState<RotaDayOverview[]>(initialOverview);
  // Recolhido por padrão, só uma fileira de dias -- achado do Victor
  // 24/08/2026: "deixe apenas uma fileira de rotas aparecendo, o resto
  // deixe recolhido" (as células ficaram maiores pra caber João Pessoa +
  // Campina Grande, então 2 semanas inteiras de uma vez tomava espaço
  // demais de novo). Sem grade fixa de 7 colunas (ver DEFAULT_VISIBLE_DAYS
  // acima do componente) não dá pra saber quantas cabem numa fileira de
  // verdade em cada tela -- 4 é uma aproximação boa pro uso comum
  // (desktop), "Mostrar mais dias" revela as 2 semanas inteiras de uma
  // vez. Não existe em modo compact (só 2 dias, não tem o que recolher).
  const [showAllDays, setShowAllDays] = useState(false);

  function updateDay(updated: RotaDayOverview) {
    setOverview((prev) => prev.map((d) => (d.date === updated.date ? updated : d)));
  }

  // Hoje + futuro primeiro, dias já passados só no final -- achado do
  // Victor 26/08/2026: "as rotas antigas estao aparecenndo primeiro".
  // `overview` vem de getRotaWeekOverview(startOfRotaWeek(today), 14), que
  // sempre começa numa segunda-feira -- no meio da semana, os primeiros
  // itens do array são dias que já passaram (ex.: hoje quarta, o array
  // começa segunda/terça). Isso empurrava justamente os dias já passados
  // pro topo da fileira visível por padrão (DEFAULT_VISIBLE_DAYS corta os
  // 2 primeiros do array, sem saber se são passado ou futuro). Só reordena
  // pra EXIBIÇÃO -- updateDay acima continua batendo por `date`, não por
  // posição, então não precisa reordenar o array guardado no state.
  const sortedOverview = [...overview].sort((a, b) => {
    const aPast = a.date < today;
    const bPast = b.date < today;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });

  const visibleDays = showAllDays ? sortedOverview : sortedOverview.slice(0, DEFAULT_VISIBLE_DAYS);

  // Painel completo (grade de dias + botão "mostrar mais") -- igual pro
  // modo compact e pro recolhível abaixo, só muda o que embrulha em volta.
  const body = compact ? (
    // Empilhado no mobile, lado a lado a partir de sm: -- achado do Victor
    // 27/08/2026: "no acesso do samuel não está responsivo" (grid-cols-2
    // fixo espremia os 2 dias + o grid interno João Pessoa/Campina Grande
    // de cada um, virando 4 colunas de conteúdo na tela de um celular).
    // Samuel/Everton acessam isso do próprio celular, na rua -- é
    // justamente esse modo compact que precisa funcionar bem estreito.
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {sortedOverview.map((day) => (
        <RotaDayCell key={day.date} day={day} today={today} drivers={drivers} onChange={updateDay} actions={actions} defaultDriver={defaultDriver} compact />
      ))}
    </div>
  ) : (
    <>
      {/* Grid flexível (minmax), não mais 7 colunas fixas -- achado do
          Victor 24/08/2026: com João Pessoa + Campina Grande lado a
          lado dentro da mesma célula, precisa de bem mais largura do
          que cabia em 220px (achado seguinte: "preciso de ainda que
          fique maior... lado a lado"). Célula com no mínimo 380px,
          quantas couberem por linha; dia da semana fica dentro da
          própria célula (sem cabeçalho separado, que só fazia
          sentido sincronizado a uma grade de 7 colunas fixa). */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}>
        {visibleDays.map((day) => (
          <RotaDayCell key={day.date} day={day} today={today} drivers={drivers} onChange={updateDay} actions={actions} defaultDriver={defaultDriver} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowAllDays((e) => !e)}
        className="text-xs rounded-lg px-3 py-1.5 border border-gray-200 font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors duration-150 self-start mt-1"
      >
        {showAllDays ? "Mostrar menos dias" : "Mostrar mais dias"}
      </button>
    </>
  );

  const description = <p className="text-xs text-gray-400">A rota segue o padrão da semana -- só escolha o motorista. Clique no lápis pra mudar a rota de um dia específico.</p>;

  // Modo compact (Everton/Samuel, só 2 células) já é enxuto por natureza --
  // continua fixo, sem retrátil. O painel cheio (fila de Entregas/
  // notificações do SAC) é quem consome espaço vertical de sobra -- pedido
  // do Victor 25/08/2026: "o bloco 'Motorista do dia' consome bastante
  // espaço vertical e polui o fluxo operacional... transforme essa área em
  // um painel retrátil". <details> nativo, recolhido por padrão, com
  // resumo de uma linha (daySummaryLabel) sempre visível no cabeçalho
  // mesmo fechado -- não precisa abrir só pra saber quem tá na rota hoje.
  if (compact) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Motorista do dia</h3>
        {description}
        {body}
      </div>
    );
  }

  const todayEntry = overview.find((d) => d.date === today) ?? sortedOverview[0] ?? null;

  return <RotaMotoristaDoDiaModalTrigger todayEntry={todayEntry} description={description} body={body} buttonOnly={buttonOnly} />;
}

// Painel completo vira modal -- pedido do Victor 25/08/2026 (revisão da
// tela de notificações, segunda rodada): "o painel de motoristas virar
// modal separado" (a versão anterior, recolhível inline, ficou pouco
// tempo -- ver git blame -- e foi substituída por essa escolha explícita
// do Victor). Mesmo desenho de modal já usado em ProductsModalButton.tsx
// (backdrop clicável + <dialog> centralizado), só mais largo pra caber a
// grade de dias.
function RotaMotoristaDoDiaModalTrigger({
  todayEntry,
  description,
  body,
  buttonOnly,
}: {
  todayEntry: RotaDayOverview | null;
  description: React.ReactNode;
  body: React.ReactNode;
  buttonOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const triggerButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-xs rounded-lg px-3.5 py-2 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 shrink-0"
      style={{ background: "#1B5E3C" }}
    >
      🚚 Gestão de Motoristas &amp; Escala
    </button>
  );

  return (
    <>
      {/* Modo "só botão" -- pedido do Victor 02/09/2026: "ao lado de
          'hoje' e só o botão" -- some a barra com rótulo + resumo,
          usada quando esse gatilho é passado pra dentro de
          EntregasKanbanHoje.tsx (ao lado do "📌 Hoje"). Modal continua
          o mesmo. */}
      {buttonOnly ? (
        triggerButton
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-800 shrink-0">🚚 Motorista do dia</span>
          {todayEntry ? (
            <span className="text-xs truncate flex-1 min-w-0 text-gray-500">{daySummaryLabel(todayEntry)}</span>
          ) : (
            <span className="flex-1 min-w-0" />
          )}
          {triggerButton}
        </div>
      )}

      {open ? (
        <>
          <button
            aria-label="Fechar gestão de motoristas"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-w-4xl max-h-[88vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-gray-800">🚚 Gestão de Motoristas &amp; Escala</h3>
              <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded text-gray-400 hover:text-gray-600">
                Fechar
              </button>
            </div>
            {description}
            {body}
          </div>
        </>
      ) : null}
    </>
  );
}

function RotaDayCell({
  day,
  today,
  drivers,
  onChange,
  actions,
  compact,
  defaultDriver,
}: {
  day: RotaDayOverview;
  today: string;
  drivers: string[];
  onChange: (day: RotaDayOverview) => void;
  actions: RotaActions;
  compact?: boolean;
  defaultDriver?: string;
}) {
  const { pending, run, showToast } = useQuickAction();
  const savedRota = day.assignments.primary?.rota ?? day.expectedRota;
  const savedDriver = day.assignments.primary?.driverName ?? "";

  const [rotaEditOpen, setRotaEditOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [rotaValue, setRotaValue] = useState<Rota | "">(savedRota ?? "");
  const [driverValue, setDriverValue] = useState(savedDriver || defaultDriver || "");
  const [extraDriver, setExtraDriver] = useState("");
  // Motorista de uma das 2 rotas fixas de Campina Grande -- qual delas
  // está sendo editada agora (null = nenhuma). Pedido do Victor
  // 24/08/2026: "campina nao tem rota extra", as 2 rotas de CG entram
  // como linhas is_extra:true por baixo dos panos (ver Achados no plano),
  // mas na tela nunca aparecem chamadas de "extra" -- seção própria,
  // sempre as mesmas 2, cada uma com seu motorista.
  const [cgPickingRota, setCgPickingRota] = useState<Rota | null>(null);
  const [cgDriverValue, setCgDriverValue] = useState("");

  const isToday = day.date === today;
  // Dia já passado -- pedido do Victor 20/08/2026: "todas as datas que já
  // passaram fiquem bem apagadas, continuem lá, mas quase transparentes
  // para que não sejam confundidas" (com hoje/os próximos dias). Comparação
  // de string funciona direto pra datas ISO (YYYY-MM-DD). Só visual --
  // continua editável normalmente, não trava nada.
  const isPast = day.date < today;
  const dateLabel = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  const weekdayLabel = WEEKDAY_SHORT[day.weekday];
  const dirty = rotaValue !== (savedRota ?? "") || driverValue.trim() !== savedDriver;
  // Extras genéricas de João Pessoa (rota extra) -- as de Campina Grande
  // (CG_ROTAS) têm seção própria fixa, não entram aqui.
  const jpExtras = day.assignments.extras.filter((e) => e.rota === JP_EXTRA_ROTA);

  function cancelRotaEdit() {
    setRotaValue(savedRota ?? "");
    setRotaEditOpen(false);
  }

  function save() {
    if (!rotaValue) {
      showToast("Escolha a rota do dia.", "error");
      return;
    }
    const name = driverValue.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    const rota = rotaValue;
    run(async () => {
      const result = await actions.setRotaDriverAssignment(day.date, rota, name);
      onChange({ ...day, assignments: { ...day.assignments, primary: { id: day.assignments.primary?.id ?? "", rota, driverName: name } } });
      setRotaEditOpen(false);
      showToast(
        `${weekdayLabel} ${dateLabel}: ${ROTA_LABELS[rota]} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  // Rota extra genérica de João Pessoa -- pedido do Victor 24/08/2026:
  // "fica por padrão o nome 'rota extra' sem precisar escolher entre
  // sul, centro e praia, só precisando escolher o nome do motorista".
  // Sempre JP_EXTRA_ROTA, sem escolher região -- o ordinal (Rota extra
  // 1, 2...) é calculado na hora de exibir por labelAvailableRota.
  function addExtra() {
    const name = extraDriver.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    run(async () => {
      const result = await actions.addRotaExtra(day.date, JP_EXTRA_ROTA, name);
      const assignments = await actions.getRotaDriverAssignments(day.date);
      onChange({ ...day, assignments });
      setExtraDriver("");
      setExtraOpen(false);
      showToast(
        `Rota extra em ${dateLabel} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  function removeExtra(id: string) {
    run(async () => {
      await actions.removeRotaExtra(id);
      onChange({ ...day, assignments: { ...day.assignments, extras: day.assignments.extras.filter((e) => e.id !== id) } });
    }, "Rota extra removida.");
  }

  // Motorista de uma das 2 rotas fixas de Campina Grande -- mesma
  // action de sempre (addRotaExtra), só que a rota já vem fixa (cgRota),
  // sem escolher.
  function addCgDriver(cgRota: Rota) {
    const name = cgDriverValue.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    run(async () => {
      const result = await actions.addRotaExtra(day.date, cgRota, name);
      const assignments = await actions.getRotaDriverAssignments(day.date);
      onChange({ ...day, assignments });
      setCgPickingRota(null);
      setCgDriverValue("");
      showToast(
        `${ROTA_LABELS[cgRota]} (Campina Grande) em ${dateLabel} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  // Modo compact (Everton/Samuel, ver RotaMotoristaDoDia acima): só 2
  // células na tela em vez de 7/14, então dá pra deixar tudo maior -- era
  // justamente o pedido do Victor 19/08/2026 ("deixar os botões de edição e
  // rota extra maiores"). Tamanhos aumentados de modo geral em 24/08/2026
  // -- achado do Victor: célula pequena demais pra caber João Pessoa +
  // Campina Grande juntas, e os botões não pareciam clicáveis (cor quase
  // igual ao fundo do card).
  const cellPadding = compact ? "p-3" : "p-3";
  const headerTextClass = compact ? "text-sm font-semibold" : "text-sm font-semibold";
  // Título de cada cartão de cidade (João Pessoa / Campina Grande) --
  // acima do peso do texto normal, mas ainda menor que os dados de
  // verdade (badge da rota, nome do motorista), que continuam sendo o
  // que mais chama atenção dentro do cartão.
  const cityLabelClass = compact ? "text-xs font-bold uppercase tracking-wide" : "text-[11px] font-bold uppercase tracking-wide";
  const editButtonClass = compact
    ? "text-lg leading-none shrink-0 rounded-md px-2 py-1.5 border"
    : "text-sm leading-none shrink-0 rounded-md px-2 py-1 border";
  const selectClass = compact ? "rounded-md border px-3 py-2 text-sm w-full" : "rounded-md border px-2 py-1.5 text-xs w-full";
  const saveButtonClass = compact
    ? "text-sm rounded-md px-4 py-2.5 font-semibold disabled:opacity-60 shadow-sm"
    : "text-xs rounded-md px-3 py-1.5 font-semibold disabled:opacity-60 shadow-sm";
  const rotaBadgeClass = compact
    ? "text-sm font-semibold rounded-full px-3 py-1.5 self-start truncate max-w-full shadow-sm"
    : "text-xs font-semibold rounded-full px-2.5 py-1 self-start truncate max-w-full shadow-sm";
  const driverTextClass = compact ? "text-sm truncate font-medium" : "text-xs truncate font-medium";
  const extraChipClass = compact ? "text-xs rounded-full px-2.5 py-1 shrink-0 font-medium" : "text-[11px] rounded-full px-2 py-1 shrink-0 font-medium";
  const extraDriverTextClass = compact ? "text-sm truncate flex-1 min-w-0" : "text-xs truncate flex-1 min-w-0";
  const extraRemoveClass = compact
    ? "text-sm shrink-0 rounded-md border px-2 py-1.5"
    : "text-xs shrink-0 rounded-md border px-1.5 py-1";
  const extraActionButtonClass = compact
    ? "text-sm rounded-md px-4 py-2.5 font-semibold disabled:opacity-60 flex-1 shadow-sm"
    : "text-xs rounded-md px-3 py-1.5 font-semibold disabled:opacity-60 flex-1 shadow-sm";
  const extraCancelButtonClass = compact
    ? "text-sm rounded-md px-4 py-2.5 border font-medium"
    : "text-xs rounded-md px-3 py-1.5 border font-medium";
  const addExtraButtonClass = compact
    ? "text-sm rounded-md px-3 py-2 border font-semibold self-start shadow-sm"
    : "text-xs rounded-md px-2.5 py-1.5 border font-semibold self-start shadow-sm";
  // Cores dos botões "de ação" (salvar/+extra/+motorista) -- fundo com um
  // toque da cor da marca, não mais cinza quase igual ao fundo do card,
  // pra realmente parecer clicável.
  // Achado do Victor 24/08/2026: "as letras de dentro dos botoes estão
  // sem contraste" -- --brand-green-ink é branco (pensado pra texto em
  // cima de --brand-green sólido, escuro), não pra cima de um fundo
  // clarinho como esse. --brand-green-soft + --text-primary é o par
  // certo pra fundo claro (mesmo usado em DriverRouteGroup.tsx,
  // MobileNav.tsx etc.).
  const actionButtonStyle = { background: "var(--brand-green-soft)", borderColor: "var(--brand-green)", color: "var(--text-primary)" };
  const neutralButtonStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" };

  return (
    <div
      className={`rounded-lg ${cellPadding} flex flex-col gap-1.5 min-w-0 transition-opacity shadow-sm`}
      style={{
        // "Hoje" precisa se destacar de verdade no calendário -- pedido do
        // Victor 19/08/2026 ("cor um pouco mais forte na rota do dia"),
        // var(--surface-2) sozinho era sutil demais pra bater o olho.
        border: isToday ? "2px solid var(--brand-green)" : "1px solid #E5E7EB",
        background: isToday ? "color-mix(in srgb, var(--brand-green) 8%, white)" : "#ffffff",
        opacity: isPast ? 0.3 : 1,
      }}
    >
      {/* Dia da semana sempre visível na própria célula -- antes só
          aparecia no mobile, sincronizado com um cabeçalho de 7 colunas
          fixas que não existe mais (ver grid flexível acima). */}
      <span className={`${headerTextClass} truncate text-gray-800`}>
        {weekdayLabel} {dateLabel}
        {isToday ? " · hoje" : ""}
      </span>

      {/* João Pessoa e Campina Grande lado a lado, mesma hierarquia visual
          -- achado do Victor 24/08/2026: "parece que a rota de joao
          pessoa ta acima em hierarquia... fique dentro da data, mas lado
          a lado, joão pessoa e campina e com as rotas e motoristas de
          cada um". Antes João Pessoa vinha solta no topo da célula (com o
          lápis de editar junto do cabeçalho da data) e só Campina Grande
          tinha um bloco/rótulo próprio -- agora as duas são a mesma coisa
          duas vezes: um cartão com título da cidade + conteúdo, um do
          lado do outro. O lápis (só edita a rota principal, que é sempre
          de João Pessoa) muda de lugar junto, pro cabeçalho do cartão de
          João Pessoa -- deixa mais claro o que ele edita.

          Empilhado no mobile, lado a lado a partir de sm: -- achado do
          Victor 27/08/2026 ("no acesso do samuel não está responsivo").
          No modo compact (motorista, celular estreito) as duas cidades
          lado a lado ficavam pequenas demais pra caber os botões maiores
          desse modo; no painel cheio (desktop, célula com no mínimo
          380px) isso não muda nada na prática -- sm: (640px) quase
          sempre já está satisfeito. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
        <div className="flex flex-col gap-1.5 rounded-md p-2 min-w-0" style={{ border: "1px solid var(--gridline)" }}>
          <div className="flex items-center justify-between gap-1">
            <span className={cityLabelClass} style={{ color: "var(--text-secondary)" }}>
              João Pessoa
            </span>
            <button
              type="button"
              onClick={rotaEditOpen ? cancelRotaEdit : () => setRotaEditOpen(true)}
              aria-label={rotaEditOpen ? "Cancelar edição da rota" : "Editar rota do dia"}
              className={editButtonClass}
              style={neutralButtonStyle}
            >
              {rotaEditOpen ? "✕" : "✏️"}
            </button>
          </div>

          {rotaEditOpen ? (
            <div className="flex flex-col gap-1">
              <select
                value={rotaValue}
                onChange={(e) => setRotaValue(e.target.value as Rota)}
                className={selectClass}
                style={{ borderColor: "var(--border)" }}
                disabled={pending}
              >
                <option value="">Sem rota</option>
                {/* Só João Pessoa "de verdade" -- a rota principal do dia
                    nunca é Campina Grande nem a extra genérica (ver
                    JP_PRIMARY_ROTAS em rotas.ts). */}
                {JP_PRIMARY_ROTAS.map((r) => (
                  <option key={r} value={r}>
                    {ROTA_LABELS[r]}
                  </option>
                ))}
              </select>
              <DriverPicker value={driverValue} onChange={setDriverValue} drivers={drivers} disabled={pending} compact={compact} />
              {dirty ? (
                <button type="button" disabled={pending} onClick={save} className={saveButtonClass} style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
                  Salvar
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <span
                className={rotaBadgeClass}
                style={{ background: rotaValue ? ROTA_COLORS[rotaValue] : "var(--surface-2)", color: rotaValue ? "#fff" : "var(--text-muted)" }}
              >
                {rotaValue ? ROTA_LABELS[rotaValue] : "Sem rota"}
              </span>
              {/* driverValue já vem preenchido com JP_DEFAULT_DRIVER
                  (Junior, ver defaultDriver acima) quando o dia ainda não
                  tem atribuição salva -- pedido do Victor 27/08/2026: "o
                  motorista padrão das rotas de joao pessoa é o junior".
                  Não é mais só uma sugestão visual (ver
                  getAvailableRotasForDate, rotas.ts) -- agendar pra essa
                  rota já resolve Junior de verdade, então mostra igual a
                  uma atribuição normal, sem aviso de "não confirmado". */}
              <span className={driverTextClass} style={{ color: driverValue ? "var(--text-primary)" : "var(--text-muted)" }}>
                {driverValue || "Sem motorista"}
              </span>
            </>
          )}

          {/* Rotas extras genéricas de João Pessoa -- pedido do Victor
              24/08/2026: sem escolher região, só o motorista; rótulo com
              ordinal (Rota extra 1, 2...) via labelAvailableRota. */}
          {jpExtras.length > 0 ? (
            <div className="flex flex-col gap-1">
              {jpExtras.map((extra) => (
                <div key={extra.id} className="flex items-center gap-1.5 min-w-0 rounded-md px-1.5 py-1" style={{ background: "var(--surface-2)" }}>
                  <span className={extraChipClass} style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>
                    {labelAvailableRota(jpExtras, extra)}
                  </span>
                  <span className={extraDriverTextClass} style={{ color: "var(--text-primary)" }}>
                    {extra.driverName}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeExtra(extra.id)}
                    aria-label="Remover rota extra"
                    className={extraRemoveClass}
                    style={{ background: "var(--surface-1)", borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {extraOpen ? (
            <div className="flex flex-col gap-1">
              <DriverPicker value={extraDriver} onChange={setExtraDriver} drivers={drivers} disabled={pending} compact={compact} />
              <div className="flex items-center gap-1">
                <button type="button" disabled={pending} onClick={addExtra} className={extraActionButtonClass} style={actionButtonStyle}>
                  salvar
                </button>
                <button type="button" onClick={() => setExtraOpen(false)} className={extraCancelButtonClass} style={neutralButtonStyle}>
                  cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setExtraOpen(true)} className={addExtraButtonClass} style={actionButtonStyle}>
              + rota extra
            </button>
          )}
        </div>

        {/* Campina Grande -- pedido do Victor 24/08/2026: painel único
            com João Pessoa, mesma hierarquia visual (cartão idêntico ao
            lado). Sempre as 2 rotas fixas (CG_ROTAS), sem "+ adicionar"
            -- "campina nao tem rota extra". Por baixo dos panos são
            linhas is_extra:true igual a rota extra de JP (ver Achados no
            plano), só que nunca aparecem rotuladas como "extra" aqui.
            Cada rota em seu próprio mini-card, empilhado (nome numa
            linha, motorista/botão na seguinte) -- nomes longos como
            "Centro/Norte/Leste" não cabiam numa pílula ao lado do
            motorista sem colidir (achado do Victor 24/08/2026). */}
        <div className="flex flex-col gap-1.5 rounded-md p-2 min-w-0" style={{ border: "1px solid var(--gridline)" }}>
          <span className={cityLabelClass} style={{ color: "var(--text-secondary)" }}>
            Campina Grande
          </span>
          {CG_ROTAS.map((cgRota) => {
            const assignment = day.assignments.extras.find((e) => e.rota === cgRota);
            return (
              <div key={cgRota} className="flex flex-col gap-1 rounded-md p-1.5 min-w-0" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: ROTA_COLORS[cgRota] }} aria-hidden="true" />
                  <span className={`${driverTextClass} font-semibold`} style={{ color: "var(--text-secondary)" }}>
                    {ROTA_LABELS[cgRota]}
                  </span>
                </div>
                {cgPickingRota === cgRota ? (
                  <div className="flex flex-col gap-1">
                    <DriverPicker value={cgDriverValue} onChange={setCgDriverValue} drivers={drivers} disabled={pending} compact={compact} />
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={pending} onClick={() => addCgDriver(cgRota)} className={extraActionButtonClass} style={actionButtonStyle}>
                        salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCgPickingRota(null);
                          setCgDriverValue("");
                        }}
                        className={extraCancelButtonClass}
                        style={neutralButtonStyle}
                      >
                        cancelar
                      </button>
                    </div>
                  </div>
                ) : assignment ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={extraDriverTextClass} style={{ color: "var(--text-primary)" }}>
                      {assignment.driverName}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeExtra(assignment.id)}
                      aria-label="Remover motorista"
                      className={extraRemoveClass}
                      style={{ background: "var(--surface-1)", borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCgPickingRota(cgRota);
                      setCgDriverValue("");
                    }}
                    className={addExtraButtonClass}
                    style={actionButtonStyle}
                  >
                    + motorista
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Era um <input list="..."> + <datalist> -- funciona bem no desktop, mas
// datalist não abre sugestão nenhuma ao tocar em boa parte dos navegadores
// mobile (achado 19/08/2026: Everton reportou "não aparece a lista de
// motoristas" ao tocar no campo, pelo celular). Um <select> nativo sempre
// abre a lista completa ao tocar, em qualquer navegador -- perde a busca por
// texto que o datalist dava no desktop, mas ganha em confiabilidade, que é o
// que importa pra quem usa isso na rua. "+ novo motorista" cai pro campo de
// texto de sempre, pra continuar dando pra cadastrar alguém que ainda não
// está na lista.
function DriverPicker({
  value,
  onChange,
  drivers,
  disabled,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  drivers: string[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const [customMode, setCustomMode] = useState(value !== "" && !drivers.includes(value));
  const fieldClass = compact ? "rounded border px-3 py-2 text-sm w-full" : "rounded border px-1.5 py-1 text-xs w-full";

  if (customMode) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome do motorista…"
          autoFocus
          className={fieldClass}
          style={{ borderColor: "var(--border)" }}
          disabled={disabled}
        />
        {drivers.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              onChange("");
            }}
            className={compact ? "text-xs underline shrink-0" : "text-[10px] underline shrink-0"}
            style={{ color: "var(--text-secondary)" }}
          >
            lista
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__novo__") {
          setCustomMode(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={fieldClass}
      style={{ borderColor: "var(--border)" }}
      disabled={disabled}
    >
      <option value="" disabled>
        Motorista…
      </option>
      {drivers.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
      <option value="__novo__">+ novo motorista</option>
    </select>
  );
}
