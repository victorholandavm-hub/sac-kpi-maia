import { getSupabaseAdmin } from "./supabaseAdmin";

// Fuso fixo de João Pessoa (America/Fortaleza, UTC-3, sem horário de
// verão) -- mesmo valor/motivo de BUSINESS_TZ_OFFSET_MS em kpi.ts: datas e
// horas "de hoje" calculadas no fuso do processo Node da VPS (normalmente
// UTC) ficariam até 3h adiantadas do dia/horário real pra quem preenche o
// cronograma. Repetido aqui (em vez de importado de kpi.ts) porque é um
// arquivo pequeno e autocontido, sem outra dependência de kpi.ts.
const FORTALEZA_OFFSET_MS = -3 * 60 * 60 * 1000;

function fortalezaNow(): Date {
  return new Date(Date.now() + FORTALEZA_OFFSET_MS);
}

// "Hoje" no fuso de João Pessoa, formato YYYY-MM-DD -- usado como `data`
// em sac_cronograma_completions/sac_cronograma_atraso_alertas.
export function todayFortaleza(): string {
  return fortalezaNow().toISOString().slice(0, 10);
}

// "HH:MM" agora, no mesmo fuso -- comparável direto (string) contra a
// coluna `horario` (time, lida como "HH:MM:SS" pelo supabase-js, por isso
// toItem corta pra "HH:MM" também).
function currentHHMM(): string {
  return fortalezaNow().toISOString().slice(11, 16);
}

export type CronogramaItem = { id: string; horario: string; descricao: string; ordem: number; ativo: boolean };

type ItemRow = { id: string; horario: string; descricao: string; ordem: number; ativo: boolean };

function toItem(row: ItemRow): CronogramaItem {
  return { id: row.id, horario: row.horario.slice(0, 5), descricao: row.descricao, ordem: row.ordem, ativo: row.ativo };
}

export async function listCronogramaItens(opts: { onlyAtivo?: boolean } = {}): Promise<CronogramaItem[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("sac_cronograma_itens").select("id, horario, descricao, ordem, ativo");
  if (opts.onlyAtivo) query = query.eq("ativo", true);
  const { data, error } = await query.order("horario").order("ordem");
  if (error) throw new Error(error.message);
  return ((data ?? []) as ItemRow[]).map(toItem);
}

// Próximo `ordem` -- só pra manter itens novos no fim da lista de admin por
// padrão (a ordem de EXIBIÇÃO de verdade, em toda tela, é sempre por
// horário primeiro -- ver listCronogramaItens acima. `ordem` só desempata
// 2 itens com o MESMO horário).
export async function addCronogramaItem(horario: string, descricao: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: maxOrdemRow } = await admin
    .from("sac_cronograma_itens")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin
    .from("sac_cronograma_itens")
    .insert({ horario, descricao, ordem: (maxOrdemRow?.ordem ?? 0) + 1 });
  if (error) throw new Error(error.message);
}

export async function setCronogramaItemAtivo(id: string, ativo: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("sac_cronograma_itens").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
}

export type CronogramaDiaItem = CronogramaItem & { completedAt: string | null; atrasado: boolean };

// Checklist pessoal de UM atendente, pra UM dia -- tela do atendente
// (/assistencia/sac/cronograma). `atrasado` só é calculado pra hoje (dia
// passado não tem "atraso" nenhum pra marcar, só ficou concluído ou não).
export async function getCronogramaDia(profileId: string, data: string): Promise<CronogramaDiaItem[]> {
  const admin = getSupabaseAdmin();
  const [itens, { data: completions, error }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    admin.from("sac_cronograma_completions").select("item_id, completed_at").eq("profile_id", profileId).eq("data", data),
  ]);
  if (error) throw new Error(error.message);

  const completedByItem = new Map((completions ?? []).map((c) => [c.item_id as string, c.completed_at as string]));
  const isToday = data === todayFortaleza();
  const nowHHMM = currentHHMM();
  return itens.map((item) => {
    const completedAt = completedByItem.get(item.id) ?? null;
    const atrasado = !completedAt && isToday && nowHHMM >= item.horario;
    return { ...item, completedAt, atrasado };
  });
}

export type CronogramaMatrizCelula = { itemId: string; completedAt: string | null; atrasado: boolean };
export type CronogramaMatrizAtendente = { profileId: string; fullName: string; celulas: CronogramaMatrizCelula[] };

// Visão de controle pro admin -- todo atendente (role "sac") x todo item
// ativo, pra UM dia. Usada na tela de Cronograma quando quem acessa é
// admin (ver /assistencia/sac/cronograma/page.tsx).
export async function getCronogramaMatrizDia(
  data: string
): Promise<{ itens: CronogramaItem[]; atendentes: CronogramaMatrizAtendente[] }> {
  const admin = getSupabaseAdmin();
  const [itens, { data: sacProfiles, error: profilesError }, { data: completions, error: compError }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    admin.from("profiles").select("id, full_name").eq("role", "sac").order("full_name"),
    admin.from("sac_cronograma_completions").select("item_id, profile_id, completed_at").eq("data", data),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (compError) throw new Error(compError.message);

  const isToday = data === todayFortaleza();
  const nowHHMM = currentHHMM();
  const completedMap = new Map((completions ?? []).map((c) => [`${c.item_id}_${c.profile_id}`, c.completed_at as string]));

  const atendentes: CronogramaMatrizAtendente[] = (sacProfiles ?? []).map((p) => ({
    profileId: p.id as string,
    fullName: p.full_name as string,
    celulas: itens.map((item) => {
      const completedAt = completedMap.get(`${item.id}_${p.id}`) ?? null;
      const atrasado = !completedAt && isToday && nowHHMM >= item.horario;
      return { itemId: item.id, completedAt, atrasado };
    }),
  }));

  return { itens, atendentes };
}

export type CronogramaTaxa = { profileId: string; fullName: string; esperados: number; concluidos: number; pct: number };

// Taxa de cumprimento por atendente nos últimos `days` dias -- pedido do
// Victor 01/10/2026: "Jaluska cumpriu 92% dos itens nos últimos 30 dias".
// Simplificação assumida: usa a lista de itens ATIVOS HOJE como "esperado
// por dia" em TODO o período -- não reconstrói o cronograma de dias em
// que um item específico ainda não existia ou já tinha sido desativado.
// Pra um cronograma que muda pouco (o normal), a distorção é mínima; se um
// item for adicionado/removido no meio do período, o % de dias ANTES da
// mudança fica levemente impreciso pra mais ou pra menos -- aceitável pra
// uma métrica de acompanhamento, não uma auditoria formal.
export async function getCronogramaTaxaCumprimento(days: number): Promise<CronogramaTaxa[]> {
  const admin = getSupabaseAdmin();
  const today = todayFortaleza();
  const fromDate = new Date(`${today}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  const fromStr = fromDate.toISOString().slice(0, 10);

  const [itensAtivos, { data: sacProfiles, error: pErr }, { data: completions, error: cErr }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    admin.from("profiles").select("id, full_name").eq("role", "sac").order("full_name"),
    admin.from("sac_cronograma_completions").select("profile_id").gte("data", fromStr).lte("data", today),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (cErr) throw new Error(cErr.message);

  const countByProfile = new Map<string, number>();
  for (const c of completions ?? []) {
    const id = c.profile_id as string;
    countByProfile.set(id, (countByProfile.get(id) ?? 0) + 1);
  }

  const esperadosPorDia = itensAtivos.length;
  const esperados = esperadosPorDia * days;
  return (sacProfiles ?? []).map((p) => {
    const concluidos = countByProfile.get(p.id as string) ?? 0;
    return {
      profileId: p.id as string,
      fullName: p.full_name as string,
      esperados,
      concluidos,
      pct: esperados > 0 ? Math.round((concluidos / esperados) * 100) : 0,
    };
  });
}

export type CronogramaAtrasoPendente = { itemId: string; profileId: string; fullName: string; horario: string; descricao: string };

// Pendências de HOJE que já passaram da hora, ninguém marcou como feito e
// ainda não geraram alerta -- usado só pelo cron (/api/sac-cronograma-check,
// ver .github/workflows/sac-cronograma-cron.yml). `horario > nowHHMM` corta
// fora quem nem chegou a vez ainda, antes de cruzar com os atendentes (uma
// query por item, não uma por atendente x item).
export async function listCronogramaAtrasosNaoAlertados(): Promise<CronogramaAtrasoPendente[]> {
  const admin = getSupabaseAdmin();
  const data = todayFortaleza();
  const nowHHMM = currentHHMM();

  const [itens, { data: sacProfiles, error: pErr }, { data: completions, error: cErr }, { data: alertas, error: aErr }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    admin.from("profiles").select("id, full_name").eq("role", "sac"),
    admin.from("sac_cronograma_completions").select("item_id, profile_id").eq("data", data),
    admin.from("sac_cronograma_atraso_alertas").select("item_id, profile_id").eq("data", data),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (cErr) throw new Error(cErr.message);
  if (aErr) throw new Error(aErr.message);

  const doneSet = new Set((completions ?? []).map((c) => `${c.item_id}_${c.profile_id}`));
  const alertedSet = new Set((alertas ?? []).map((a) => `${a.item_id}_${a.profile_id}`));

  const pendentes: CronogramaAtrasoPendente[] = [];
  for (const item of itens) {
    if (item.horario > nowHHMM) continue;
    for (const profile of sacProfiles ?? []) {
      const key = `${item.id}_${profile.id}`;
      if (doneSet.has(key) || alertedSet.has(key)) continue;
      pendentes.push({ itemId: item.id, profileId: profile.id as string, fullName: profile.full_name as string, horario: item.horario, descricao: item.descricao });
    }
  }
  return pendentes;
}

export async function recordCronogramaAlertaEnviado(itemId: string, profileId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("sac_cronograma_atraso_alertas")
    .insert({ item_id: itemId, profile_id: profileId, data: todayFortaleza() });
  if (error) throw new Error(error.message);
}
