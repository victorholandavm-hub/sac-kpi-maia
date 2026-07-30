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

export function bucketByScheduledDate(dateStr: string | null | undefined): DateBucketKey {
  if (!dateStr) return "sem_data";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
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
