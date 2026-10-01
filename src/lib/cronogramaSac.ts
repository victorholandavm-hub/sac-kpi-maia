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

// Desloca um "HH:MM" por `minutes` (pode ser negativo) -- usado pelo
// offset por atendente (ver CronogramaAtendenteConfig abaixo). Sem
// wraparound de dia (ex.: 23:30 + 60min não vira "00:30 do dia seguinte")
// -- nenhum item do cronograma chega perto da virada de dia, não vale a
// complexidade de tratar esse caso que não acontece na prática.
function addMinutesToTime(hhmm: string, minutes: number): string {
  if (minutes === 0) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutes));
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
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

export type CronogramaAtendenteConfig = { participa: boolean; offsetMinutos: number };

const DEFAULT_ATENDENTE_CONFIG: CronogramaAtendenteConfig = { participa: true, offsetMinutos: 0 };

// Exceção por atendente -- pedido do Victor 01/10/2026: "joab e luisa nao
// precisam entrar nesse cronograma e alynne só pega a partir da 9h".
// sac_cronograma_atendente_config é ESPARSA (1 linha só pra quem tem
// exceção) -- ausência de linha = DEFAULT_ATENDENTE_CONFIG acima.
export async function listCronogramaAtendenteConfigs(): Promise<Map<string, CronogramaAtendenteConfig>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("sac_cronograma_atendente_config").select("profile_id, participa, offset_minutos");
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((row) => [
      row.profile_id as string,
      { participa: row.participa as boolean, offsetMinutos: row.offset_minutos as number },
    ])
  );
}

export type CronogramaAtendenteComConfig = { profileId: string; fullName: string } & CronogramaAtendenteConfig;

// Todo atendente (role "sac") com a própria config (ou o default, quando
// não tem exceção) -- usado só pela tela de admin (AdminSection
// "Cronograma do SAC", admin/page.tsx) pra listar quem participa/não
// participa e o offset de cada um.
export async function listCronogramaAtendentesComConfig(): Promise<CronogramaAtendenteComConfig[]> {
  const admin = getSupabaseAdmin();
  const [configs, { data: sacProfiles, error }] = await Promise.all([
    listCronogramaAtendenteConfigs(),
    admin.from("profiles").select("id, full_name").eq("role", "sac").order("full_name"),
  ]);
  if (error) throw new Error(error.message);
  return (sacProfiles ?? []).map((p) => ({
    profileId: p.id as string,
    fullName: p.full_name as string,
    ...(configs.get(p.id as string) ?? DEFAULT_ATENDENTE_CONFIG),
  }));
}

export async function setCronogramaAtendenteConfig(
  profileId: string,
  config: CronogramaAtendenteConfig
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("sac_cronograma_atendente_config")
    .upsert({ profile_id: profileId, participa: config.participa, offset_minutos: config.offsetMinutos }, { onConflict: "profile_id" });
  if (error) throw new Error(error.message);
}

export type CronogramaDiaItem = CronogramaItem & { completedAt: string | null; atrasado: boolean };

// Config (participa/offset) de UM atendente -- usado pela tela pessoal
// (getCronogramaDia) e pelas ações (cronograma-actions.ts), sem precisar
// buscar o Map inteiro de todo mundo só pra 1 pessoa.
export async function getCronogramaAtendenteConfig(profileId: string): Promise<CronogramaAtendenteConfig> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("sac_cronograma_atendente_config")
    .select("participa, offset_minutos")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_ATENDENTE_CONFIG;
  return { participa: data.participa, offsetMinutos: data.offset_minutos };
}

// Checklist pessoal de UM atendente, pra UM dia -- tela do atendente
// (/assistencia/sac/cronograma). `atrasado` só é calculado pra hoje (dia
// passado não tem "atraso" nenhum pra marcar, só ficou concluído ou não).
// `item.horario` de volta já vem AJUSTADO pelo offset desse atendente (ver
// CronogramaAtendenteConfig) -- quem vê não precisa fazer conta de cabeça.
export async function getCronogramaDia(profileId: string, data: string): Promise<CronogramaDiaItem[]> {
  const admin = getSupabaseAdmin();
  const [itens, config, { data: completions, error }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    getCronogramaAtendenteConfig(profileId),
    admin.from("sac_cronograma_completions").select("item_id, completed_at").eq("profile_id", profileId).eq("data", data),
  ]);
  if (error) throw new Error(error.message);

  const completedByItem = new Map((completions ?? []).map((c) => [c.item_id as string, c.completed_at as string]));
  const isToday = data === todayFortaleza();
  const nowHHMM = currentHHMM();
  return itens.map((item) => {
    const horarioAjustado = addMinutesToTime(item.horario, config.offsetMinutos);
    const completedAt = completedByItem.get(item.id) ?? null;
    const atrasado = !completedAt && isToday && nowHHMM >= horarioAjustado;
    return { ...item, horario: horarioAjustado, completedAt, atrasado };
  });
}

export type CronogramaMatrizCelula = { itemId: string; completedAt: string | null; atrasado: boolean };
export type CronogramaMatrizAtendente = {
  profileId: string;
  fullName: string;
  offsetMinutos: number;
  celulas: CronogramaMatrizCelula[];
};

// Visão de controle pro admin -- todo atendente (role "sac") x todo item
// ativo, pra UM dia. Usada na tela de Cronograma quando quem acessa é
// admin (ver /assistencia/sac/cronograma/page.tsx). Atendente com
// participa=false (ver CronogramaAtendenteConfig) nem aparece como linha
// -- pedido do Victor 01/10/2026: "joab e luisa nao precisam entrar nesse
// cronograma", não faz sentido o admin ver uma linha de quem não é
// cobrado por isso.
export async function getCronogramaMatrizDia(
  data: string
): Promise<{ itens: CronogramaItem[]; atendentes: CronogramaMatrizAtendente[] }> {
  const admin = getSupabaseAdmin();
  const [itens, configs, { data: sacProfiles, error: profilesError }, { data: completions, error: compError }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    listCronogramaAtendenteConfigs(),
    admin.from("profiles").select("id, full_name").eq("role", "sac").order("full_name"),
    admin.from("sac_cronograma_completions").select("item_id, profile_id, completed_at").eq("data", data),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (compError) throw new Error(compError.message);

  const isToday = data === todayFortaleza();
  const nowHHMM = currentHHMM();
  const completedMap = new Map((completions ?? []).map((c) => [`${c.item_id}_${c.profile_id}`, c.completed_at as string]));

  const atendentes: CronogramaMatrizAtendente[] = (sacProfiles ?? [])
    .filter((p) => (configs.get(p.id as string) ?? DEFAULT_ATENDENTE_CONFIG).participa)
    .map((p) => {
      const offsetMinutos = (configs.get(p.id as string) ?? DEFAULT_ATENDENTE_CONFIG).offsetMinutos;
      return {
        profileId: p.id as string,
        fullName: p.full_name as string,
        offsetMinutos,
        celulas: itens.map((item) => {
          const horarioAjustado = addMinutesToTime(item.horario, offsetMinutos);
          const completedAt = completedMap.get(`${item.id}_${p.id}`) ?? null;
          const atrasado = !completedAt && isToday && nowHHMM >= horarioAjustado;
          return { itemId: item.id, completedAt, atrasado };
        }),
      };
    });

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

  const [itensAtivos, configs, { data: sacProfiles, error: pErr }, { data: completions, error: cErr }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    listCronogramaAtendenteConfigs(),
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
  // Quem não participa (ver CronogramaAtendenteConfig) fica de fora da
  // taxa inteira -- não é justo mostrar "0%" pra quem nunca precisou
  // cumprir nada disso.
  return (sacProfiles ?? [])
    .filter((p) => (configs.get(p.id as string) ?? DEFAULT_ATENDENTE_CONFIG).participa)
    .map((p) => {
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

  const [itens, configs, { data: sacProfiles, error: pErr }, { data: completions, error: cErr }, { data: alertas, error: aErr }] = await Promise.all([
    listCronogramaItens({ onlyAtivo: true }),
    listCronogramaAtendenteConfigs(),
    admin.from("profiles").select("id, full_name").eq("role", "sac"),
    admin.from("sac_cronograma_completions").select("item_id, profile_id").eq("data", data),
    admin.from("sac_cronograma_atraso_alertas").select("item_id, profile_id").eq("data", data),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (cErr) throw new Error(cErr.message);
  if (aErr) throw new Error(aErr.message);

  const doneSet = new Set((completions ?? []).map((c) => `${c.item_id}_${c.profile_id}`));
  const alertedSet = new Set((alertas ?? []).map((a) => `${a.item_id}_${a.profile_id}`));
  // Quem não participa nunca gera alerta -- mesmo motivo de
  // getCronogramaMatrizDia/getCronogramaTaxaCumprimento acima.
  const participantes = (sacProfiles ?? []).filter((p) => (configs.get(p.id as string) ?? DEFAULT_ATENDENTE_CONFIG).participa);

  const pendentes: CronogramaAtrasoPendente[] = [];
  for (const item of itens) {
    for (const profile of participantes) {
      const offsetMinutos = (configs.get(profile.id as string) ?? DEFAULT_ATENDENTE_CONFIG).offsetMinutos;
      const horarioAjustado = addMinutesToTime(item.horario, offsetMinutos);
      if (horarioAjustado > nowHHMM) continue;
      const key = `${item.id}_${profile.id}`;
      if (doneSet.has(key) || alertedSet.has(key)) continue;
      pendentes.push({
        itemId: item.id,
        profileId: profile.id as string,
        fullName: profile.full_name as string,
        horario: horarioAjustado,
        descricao: item.descricao,
      });
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
