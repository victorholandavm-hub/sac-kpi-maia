// Agrupa itens com data agendada em baldes (Atrasado/Hoje/Amanhã/Depois/Sem
// data) -- usado nas listas de motorista/montador pra facilitar escanear a
// rota do dia num celular em vez de rolar uma lista plana. Compartilhado
// entre as duas telas (mesmo motivo de RatingScale.tsx: eram idênticas
// duplicadas, aqui evitamos duplicar de novo).

export type DateBucketKey = "atrasado" | "hoje" | "amanha" | "depois" | "sem_data";

export const DATE_BUCKET_ORDER: DateBucketKey[] = ["atrasado", "hoje", "amanha", "depois", "sem_data"];

export const DATE_BUCKET_LABELS: Record<DateBucketKey, string> = {
  atrasado: "Atrasado",
  hoje: "Hoje",
  amanha: "Amanhã",
  depois: "Depois",
  sem_data: "Sem data agendada",
};

// Só "atrasado" e "hoje" abrem sozinhos -- é o que precisa de atenção
// imediata; o resto fica comprimido até a pessoa clicar.
export const DATE_BUCKET_DEFAULT_OPEN: Record<DateBucketKey, boolean> = {
  atrasado: true,
  hoje: true,
  amanha: false,
  depois: false,
  sem_data: false,
};

// América/Fortaleza (João Pessoa), UTC-3, sem horário de verão -- mesmo fuso
// de kpi.ts/formatDateTime.ts. Sem isso, "hoje" era calculado no fuso do
// processo Node (a VPS roda em UTC, ver formatDateTime.ts), adiantando a
// virada do dia em 3h: das 21h às 23h59 em Brasília, chamados de hoje
// apareciam em "Atrasado" porque pro processo já era o dia seguinte.
const BUSINESS_TZ_OFFSET_MS = -3 * 60 * 60 * 1000;

export function bucketByScheduledDate(dateStr: string | null | undefined): DateBucketKey {
  if (!dateStr) return "sem_data";
  const todayStr = new Date(Date.now() + BUSINESS_TZ_OFFSET_MS).toISOString().slice(0, 10);
  const diffDays = Math.round((Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "atrasado";
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "amanha";
  return "depois";
}

export function groupByDateBucket<T>(items: T[], getDate: (item: T) => string | null | undefined): Map<DateBucketKey, T[]> {
  const groups = new Map<DateBucketKey, T[]>();
  for (const item of items) {
    const bucket = bucketByScheduledDate(getDate(item));
    const list = groups.get(bucket) ?? [];
    list.push(item);
    groups.set(bucket, list);
  }
  return groups;
}

const WEEKDAY_LABELS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function formatDDMM(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatWeekdayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAY_LABELS[weekday]}, ${formatDDMM(dateStr)}`;
}

export type DetailedDateGroup<T> = { key: string; label: string; defaultOpen: boolean; items: T[] };

// Variante pro montador: em vez de amontoar tudo que não é hoje/amanhã num
// "Depois" genérico (jeito que a lista do motorista usa, onde faz sentido
// porque ele lida com muitos dias de rota ao mesmo tempo), cada dia depois
// de amanhã vira o próprio grupo com a data de verdade -- montador olha
// dia a dia, não a rota inteira de uma vez.
export function groupByDateDetailed<T>(items: T[], getDate: (item: T) => string | null | undefined): DetailedDateGroup<T>[] {
  const todayStr = new Date(Date.now() + BUSINESS_TZ_OFFSET_MS).toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.parse(`${todayStr}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const dateStr = getDate(item);
    let key: string;
    if (!dateStr) key = "sem_data";
    else {
      const bucket = bucketByScheduledDate(dateStr);
      key = bucket === "depois" ? dateStr : bucket;
    }
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  const result: DetailedDateGroup<T>[] = [];
  if (buckets.has("atrasado")) {
    result.push({ key: "atrasado", label: "Atrasado", defaultOpen: true, items: buckets.get("atrasado")! });
  }
  if (buckets.has("hoje")) {
    result.push({ key: "hoje", label: `Hoje · ${formatDDMM(todayStr)}`, defaultOpen: true, items: buckets.get("hoje")! });
  }
  if (buckets.has("amanha")) {
    result.push({ key: "amanha", label: `Amanhã · ${formatDDMM(tomorrowStr)}`, defaultOpen: false, items: buckets.get("amanha")! });
  }
  const futureDates = [...buckets.keys()]
    .filter((k) => k !== "atrasado" && k !== "hoje" && k !== "amanha" && k !== "sem_data")
    .sort();
  for (const dateStr of futureDates) {
    result.push({ key: dateStr, label: formatWeekdayDate(dateStr), defaultOpen: false, items: buckets.get(dateStr)! });
  }
  if (buckets.has("sem_data")) {
    result.push({ key: "sem_data", label: "Sem data agendada", defaultOpen: false, items: buckets.get("sem_data")! });
  }
  return result;
}
