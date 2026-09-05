import { unstable_cache, updateTag } from "next/cache";
import { getSupabaseAdmin } from "./supabaseAdmin";

// "cg_centro_norte_leste"/"cg_sul_oeste" -- rotas de Campina Grande,
// pedido do Victor 24/08/2026: "agora, a gente tem as rotas de Campina
// Grande... em campina grande as rotas são: centro/norte/leste e
// sul/oeste, juntas assim, são apenas duas rotas". "extra" -- rota extra
// genérica de João Pessoa, mesmo pedido: "nas rotas extras de joão
// pessoa, fica por padrão o nome 'rota extra' sem precisar escolher
// entre sul, centro e praia" -- ver JP_EXTRA_ROTA/labelAvailableRota
// abaixo pro nome com ordinal (Rota extra 1, Rota extra 2...).
export type Rota = "praia" | "sul" | "centro" | "cg_centro_norte_leste" | "cg_sul_oeste" | "extra";

export const ROTAS: Rota[] = ["praia", "sul", "centro", "cg_centro_norte_leste", "cg_sul_oeste", "extra"];

export const ROTA_LABELS: Record<Rota, string> = {
  praia: "Praia",
  sul: "Sul",
  centro: "Centro",
  cg_centro_norte_leste: "Centro/Norte/Leste",
  cg_sul_oeste: "Sul/Oeste",
  // Fallback genérico -- quem precisa do nome com ordinal (Rota extra
  // 2, 3...) usa labelAvailableRota abaixo, não isso direto.
  extra: "Rota extra",
};

// Cor própria por rota na agenda (ver AgendaQueueGroup) -- bate o olho em
// qual região é sem precisar ler o texto.
export const ROTA_COLORS: Record<Rota, string> = {
  praia: "var(--series-5)",
  sul: "var(--series-1)",
  centro: "var(--series-4)",
  cg_centro_norte_leste: "var(--series-7)",
  cg_sul_oeste: "var(--series-8)",
  // Cinza neutro -- sinaliza "não é uma rota geográfica fixa", diferente
  // das outras.
  extra: "var(--text-muted)",
};

// Cidade de cada rota -- pedido do Victor 24/08/2026: "o atendente
// escolher primeiro a cidade... e depois as rotas". "extra" entra como
// João Pessoa (é lá que existe o conceito de rota extra genérica; ver
// achado "campina nao tem rota extra").
export type RotaCity = "joao_pessoa" | "campina_grande";

export const CITY_LABELS: Record<RotaCity, string> = {
  joao_pessoa: "João Pessoa",
  campina_grande: "Campina Grande",
};

export const ROTA_CITY: Record<Rota, RotaCity> = {
  praia: "joao_pessoa",
  sul: "joao_pessoa",
  centro: "joao_pessoa",
  extra: "joao_pessoa",
  cg_centro_norte_leste: "campina_grande",
  cg_sul_oeste: "campina_grande",
};

export const ROTAS_BY_CITY: Record<RotaCity, Rota[]> = {
  joao_pessoa: ROTAS.filter((r) => ROTA_CITY[r] === "joao_pessoa"),
  campina_grande: ROTAS.filter((r) => ROTA_CITY[r] === "campina_grande"),
};

// Valor de rota da "rota extra" genérica de João Pessoa -- ver comentário
// no topo do arquivo. Nome exportado em vez de espalhar a string mágica
// "extra" pelo código (mesmo padrão de ITEM_DESTINO_NEEDS_NOTE em
// tecnicos.ts).
export const JP_EXTRA_ROTA: Rota = "extra";

// Motorista padrão da rota principal (praia/sul/centro) de João Pessoa
// quando ainda não existe nenhuma atribuição explícita pro dia -- pedido
// do Victor, reafirmado 27/08/2026: "eu falei que o motorista padrão das
// rotas de joao pessoa é o junior", depois de achar chamados com rota
// definida mas sem motorista mesmo com o painel "Motorista do dia"
// mostrando Junior como sugestão. Antes (21/08 e 26/08/2026) isso só
// existia como sugestão visual no painel (prop `defaultDriver`,
// RotaMotoristaDoDia.tsx) -- não afetava getAvailableRotasForDate, então
// quem agendava sem ninguém ter clicado "confirmar" primeiro ficava com
// driver_name null de verdade. Agora é o valor que getAvailableRotasForDate
// resolve de fato pra rota principal esperada da semana (ver uso abaixo) --
// vira o motorista de qualquer chamado novo agendado pra João Pessoa sem
// atribuição explícita, sem precisar de confirmação manual. Uma atribuição
// de verdade (painel "Motorista do dia", lápis de editar) sempre tem
// prioridade -- esse valor só entra quando `assignments.primary` é null.
export const JP_DEFAULT_DRIVER = "Junior";

// As 2 rotas fixas de Campina Grande -- sem "+ adicionar" no painel
// "Motorista do dia" (achado do Victor 24/08/2026: "campina nao tem rota
// extra"), são sempre essas duas, cada uma com seu próprio motorista.
export const CG_ROTAS: Rota[] = ROTAS_BY_CITY.campina_grande;

// As 3 rotas "de verdade" de João Pessoa (praia/sul/centro) -- sem a
// rota extra genérica. Usado onde só faz sentido escolher uma região
// fixa: rota principal do dia (RotaMotoristaDoDia.tsx), padrão semanal
// (RotaWeekdaySelect.tsx) e o filtro de rota da Agenda (visitas
// técnicas, não usa Campina Grande nem rota extra).
export const JP_PRIMARY_ROTAS: Rota[] = ROTAS_BY_CITY.joao_pessoa.filter((r) => r !== JP_EXTRA_ROTA);

// Rótulo de uma atribuição disponível, considerando o caso especial da
// rota extra genérica de João Pessoa -- pedido do Victor 24/08/2026:
// "caso tenha mais de uma rota extra, fica: rota extra 1, rota extra
// 2...". O ordinal não fica salvo em lugar nenhum, é calculado na hora
// de exibir a partir da posição dentro da lista (mesma ordem que já vem
// do banco, updated_at crescente -- ver getRotaDriverAssignments).
// Único lugar que sabe montar esse rótulo -- evita duplicar a contagem
// em RotaMotoristaDoDia.tsx, ScheduleField.tsx, NotificacoesList.tsx,
// DriverRouteGroup.tsx e nos formulários de criação. Tipo estrutural
// mínimo (não exige `AvailableRota` inteiro) -- RotaMotoristaDoDia.tsx
// chama isso com `RotaDriverAssignmentEntry[]` (sem `isExtra`), que já
// bate com esse formato.
export function labelAvailableRota(all: { id: string; rota: Rota }[], entry: { id: string; rota: Rota }): string {
  if (entry.rota === JP_EXTRA_ROTA) {
    const genericExtras = all.filter((r) => r.rota === JP_EXTRA_ROTA);
    const idx = genericExtras.findIndex((r) => r.id === entry.id);
    return genericExtras.length > 1 ? `Rota extra ${idx + 1}` : "Rota extra";
  }
  return ROTA_LABELS[entry.rota];
}

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function isRota(value: string | null | undefined): value is Rota {
  return !!value && (ROTAS as string[]).includes(value);
}

// weekday: 0=domingo ... 6=sábado (mesmo formato de Date.getDay()). null =
// sem rota nesse dia (hoje, só domingo). Configurável pelo admin — ver
// setRotaWeekday e supabase/migrations/0029_sac_tipos_rotas.sql pro valor
// padrão (Praia seg/qui, Sul ter/sex, Centro qua/sáb).
export type RotaWeekdayConfig = Record<number, Rota | null>;

// Cacheado 60s (+ invalidação imediata via updateTag, ver setRotaWeekday
// abaixo) -- pedido do Victor 02/09/2026: "praticamente todas as
// mudanças de tela estão demorando muito". Config admin, muda
// raríssimas vezes, mas era buscada do zero (2 idas sequenciais ao
// Supabase -- essa aqui, DEPOIS a consulta principal) em getRotaWeekOverview
// e getAvailableRotasForDate toda vez, com a latência real de rede entre a
// VPS e o Supabase (~200ms por ida). updateTag (Next.js 16, chamado só
// dentro de Server Action -- ver setRotaWeekday em admin-actions.ts)
// garante que uma mudança de verdade aparece na hora, sem esperar
// nenhuma janela de cache -- só quem nunca mudou nada é que se
// beneficia do cache puro de 60s.
const ROTA_WEEKDAY_CONFIG_TAG = "rota-weekday-config";

export const getRotaWeekdayConfig = unstable_cache(
  async (): Promise<RotaWeekdayConfig> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("rota_weekday_config").select("weekday, rota").order("weekday");
    if (error) throw new Error(error.message);

    const config: RotaWeekdayConfig = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    for (const row of data ?? []) {
      config[row.weekday] = isRota(row.rota) ? row.rota : null;
    }
    return config;
  },
  ["rota-weekday-config"],
  { revalidate: 60, tags: [ROTA_WEEKDAY_CONFIG_TAG] }
);

export async function setRotaWeekday(weekday: number, rota: Rota | null): Promise<void> {
  if (weekday < 0 || weekday > 6) throw new Error("Dia da semana inválido.");
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rota_weekday_config").upsert({ weekday, rota }, { onConflict: "weekday" });
  if (error) throw new Error(error.message);
  updateTag(ROTA_WEEKDAY_CONFIG_TAG);
}

// Feriados -- pedido do Victor 05/09/2026: "que eu tenha a opção de
// colocar isso em qualquer dia, só eu, para um feriado". Diferente do
// padrão semanal (rota_weekday_config, um valor por DIA DA SEMANA) --
// aqui é uma DATA específica, independente de qual dia da semana ela
// cai. Trava geral: quando a data está aqui, getAvailableRotasForDate
// devolve vazio direto, ignorando o padrão da semana e qualquer
// atribuição de motorista que já exista pra essa data (o feriado vale
// mais que uma atribuição feita antes de virar feriado).
export type RotaHoliday = { date: string; note: string | null };

const ROTA_HOLIDAYS_TAG = "rota-holidays";

export const listRotaHolidays = unstable_cache(
  async (): Promise<RotaHoliday[]> => {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("rota_holidays").select("date, note").order("date");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ date: r.date as string, note: r.note as string | null }));
  },
  ["rota-holidays"],
  { revalidate: 60, tags: [ROTA_HOLIDAYS_TAG] }
);

async function isRotaHoliday(dateStr: string): Promise<boolean> {
  const holidays = await listRotaHolidays();
  return holidays.some((h) => h.date === dateStr);
}

export async function addRotaHoliday(date: string, note: string | null): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rota_holidays").upsert({ date, note: note?.trim() || null }, { onConflict: "date" });
  if (error) throw new Error(error.message);
  updateTag(ROTA_HOLIDAYS_TAG);
}

export async function removeRotaHoliday(date: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rota_holidays").delete().eq("date", date);
  if (error) throw new Error(error.message);
  updateTag(ROTA_HOLIDAYS_TAG);
}

// Quem dirige cada rota numa data específica -- ver setRotaDriverAssignment
// (actions.ts). Só existe UMA rota "principal" por dia (o carro de sempre,
// pode trocar de região dia a dia) -- carro(s) a mais no mesmo dia entram
// como "extra" (addRotaExtra), sem limite de quantidade. primary null =
// ninguém definido ainda pra essa data.
export type RotaDriverAssignmentEntry = { id: string; rota: Rota; driverName: string };
export type RotaDriverAssignments = { primary: RotaDriverAssignmentEntry | null; extras: RotaDriverAssignmentEntry[] };

export async function getRotaDriverAssignments(date: string): Promise<RotaDriverAssignments> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("rota_driver_assignments")
    .select("id, rota, driver_name, is_extra")
    .eq("assignment_date", date)
    .order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);

  let primary: RotaDriverAssignmentEntry | null = null;
  const extras: RotaDriverAssignmentEntry[] = [];
  for (const row of data ?? []) {
    if (!isRota(row.rota)) continue;
    const entry: RotaDriverAssignmentEntry = { id: row.id as string, rota: row.rota, driverName: row.driver_name as string };
    if (row.is_extra) extras.push(entry);
    else primary = entry; // só deve existir uma linha não-extra por data (índice único parcial no banco)
  }
  return { primary, extras };
}

// Nome do motorista de uma rota específica num dia, a partir do overview
// que RotaMotoristaDoDia já busca (RotaDayOverview) -- usado pelo Kanban
// de "Hoje" (EntregasKanbanHoje.tsx) pra mostrar quem tá em cada coluna,
// sem duplicar a lógica de "primary vs extras" que já existia espalhada.
//
// Mesmo fallback pro motorista padrão (JP_DEFAULT_DRIVER) que
// getAvailableRotasForDate já aplica -- achado do Victor 01/09/2026: o
// card de resumo da rota Praia aparecia "Sem motorista" quando na
// verdade é o Junior por padrão. Faltava replicar aqui a mesma regra:
// sem NENHUMA atribuição explícita pro dia, a rota ESPERADA da semana
// (day.expectedRota) cai no motorista padrão -- só quando não existe
// `assignments.primary` nenhum (uma atribuição explícita, mesmo que pra
// outra rota, sempre tem prioridade e não aciona esse fallback).
export function driverNameForRota(day: RotaDayOverview, rota: Rota): string | null {
  if (day.assignments.primary) {
    if (day.assignments.primary.rota === rota) return day.assignments.primary.driverName;
  } else if (rota === day.expectedRota) {
    return JP_DEFAULT_DRIVER;
  }
  return day.assignments.extras.find((e) => e.rota === rota)?.driverName ?? null;
}

// Função pura — recebe a data já como string YYYY-MM-DD pra não depender de
// timezone do servidor (new Date("YYYY-MM-DD") é sempre UTC meia-noite).
export function getRotaForDate(dateStr: string, config: RotaWeekdayConfig): Rota | null {
  const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return config[weekday] ?? null;
}

// `id` é o id da linha em rota_driver_assignments (ou um id sintético
// quando ainda não existe atribuição nenhuma) -- pedido do Victor
// 21/08/2026: "quando eu preciso mudar uma notificação de um motorista
// para outro... coloquei a mesma rota do dia, não apareceu a rota extra".
// Antes essa lista era deduplicada por ROTA (um Set<Rota>), então uma
// extra com a mesma rota da principal virava invisível (a principal
// sempre "ganhava" em findDriverForRota) -- agora é uma entrada por
// atribuição de verdade, id é o que diferencia duas entradas com a mesma
// rota mas motoristas diferentes.
export type AvailableRota = { id: string; rota: Rota; driverName: string | null; isExtra: boolean };

// Rotas que uma solicitação pode escolher pra uma data -- pedido do Victor
// 18/08/2026: "a escolha tem que ser baseada nas rotas disponiveis", não
// mais livre entre praia/sul/centro com aviso de exceção depois. Uma
// entrada por atribuição registrada como "motorista do dia" (principal +
// cada extra) pra essa data; sem nada registrado ainda, cai no padrão da
// semana (só domingo fica vazio de verdade, sem motorista). Já vem com o
// motorista de cada rota (ou null, se ainda não tem motorista definido) --
// rota e motorista são a mesma coisa vista de dois jeitos (pedido do
// Victor 18/08/2026), então quem escolhe a rota já sabe/recebe o
// motorista junto, sem digitar nada à parte.
export async function getAvailableRotasForDate(dateStr: string): Promise<AvailableRota[]> {
  // Feriado trava geral -- nem olha pro padrão da semana nem pra
  // atribuição de motorista que já exista (ver addRotaHoliday acima).
  if (await isRotaHoliday(dateStr)) return [];

  const [config, assignments] = await Promise.all([getRotaWeekdayConfig(), getRotaDriverAssignments(dateStr)]);

  const entries: AvailableRota[] = [];
  if (assignments.primary) {
    entries.push({ id: assignments.primary.id, rota: assignments.primary.rota, driverName: assignments.primary.driverName, isExtra: false });
  } else {
    // Sem atribuição explícita da rota principal (João Pessoa) pra essa
    // data ainda -- cai no padrão da semana, mesmo que já exista alguma
    // rota EXTRA registrada pra essa data (ex.: só uma das rotas de
    // Campina Grande atribuída até agora). Achado do Victor 26/08/2026:
    // "só ta aparecendo a rota de campina grande e nao aparece as outras
    // rotas do dia" -- bug estava aqui: antes, a função só caía nesse
    // padrão da semana quando NENHUMA atribuição existia pra data
    // (`entries.length > 0` já bastava pra pular o fallback inteiro, e
    // Campina Grande sozinha já deixava `entries` não-vazio). Extra nunca
    // substitui a rota principal no dropdown -- as duas sempre convivem
    // juntas na lista final.
    // Sem atribuição real ainda -- motorista padrão (JP_DEFAULT_DRIVER,
    // ver comentário lá) entra direto aqui, não mais null. Pedido do
    // Victor 27/08/2026: agendar sem ninguém ter "confirmado" antes não
    // pode mais deixar o chamado sem motorista.
    const expected = getRotaForDate(dateStr, config);
    if (expected) entries.push({ id: `expected-${expected}`, rota: expected, driverName: JP_DEFAULT_DRIVER, isExtra: false });
  }
  for (const extra of assignments.extras) {
    entries.push({ id: extra.id, rota: extra.rota, driverName: extra.driverName, isExtra: true });
  }
  return entries;
}

// Segunda-feira da semana de `dateStr` (formato YYYY-MM-DD) -- ponto de
// partida da visão de 2 semanas do painel "Motorista do dia" (pedido do
// Victor 18/08/2026: rotas da semana atual + semana seguinte sempre
// visíveis, não só o dia escolhido).
export function startOfRotaWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

export type RotaDayOverview = {
  date: string;
  weekday: number;
  // Rota esperada pelo padrão da semana (rota_weekday_config) -- null só no
  // domingo, por padrão. Quem edita "rota do dia" pode fugir disso pra um
  // dia específico (exceção), sem mexer no padrão da semana toda.
  expectedRota: Rota | null;
  assignments: RotaDriverAssignments;
  // Feriado marcado pelo admin (ver addRotaHoliday) -- quando true, o
  // painel "Motorista do dia" mostra "Feriado" em vez de "Sem rota"
  // genérico, e getAvailableRotasForDate já bloqueou agendamento nessa
  // data (mesma fonte, ver lá).
  isHoliday: boolean;
  holidayNote: string | null;
};

// Visão de várias datas seguidas (painel "Motorista do dia") -- uma query só
// pro intervalo inteiro em vez de uma por dia. `days` normalmente é 14 (semana
// atual + semana seguinte).
export async function getRotaWeekOverview(fromDate: string, days: number): Promise<RotaDayOverview[]> {
  const [config, holidays] = await Promise.all([getRotaWeekdayConfig(), listRotaHolidays()]);
  const admin = getSupabaseAdmin();

  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const { data, error } = await admin
    .from("rota_driver_assignments")
    .select("id, assignment_date, rota, driver_name, is_extra")
    .in("assignment_date", dates)
    .order("updated_at", { ascending: true });
  if (error) throw new Error(error.message);

  const byDate = new Map<string, RotaDriverAssignments>();
  for (const date of dates) byDate.set(date, { primary: null, extras: [] });
  for (const row of data ?? []) {
    if (!isRota(row.rota)) continue;
    const bucket = byDate.get(row.assignment_date as string);
    if (!bucket) continue;
    const entry: RotaDriverAssignmentEntry = { id: row.id as string, rota: row.rota, driverName: row.driver_name as string };
    if (row.is_extra) bucket.extras.push(entry);
    else bucket.primary = entry;
  }
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.note]));

  return dates.map((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const holidayNote = holidayByDate.get(date) ?? null;
    return {
      date,
      weekday,
      expectedRota: config[weekday] ?? null,
      assignments: byDate.get(date)!,
      isHoliday: holidayByDate.has(date),
      holidayNote,
    };
  });
}
