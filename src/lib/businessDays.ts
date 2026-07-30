// "Dia útil" = segunda a sexta. Sem tabela de feriados no projeto (limitação
// conhecida, aceita pra essa feature) -- só pula sábado/domingo. Conta em UTC
// pra evitar o servidor interpretar a data com o timezone local, mesmo
// raciocínio do truque `${value}T00:00:00` já usado no resto do projeto.

export function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

// Retorna a data ISO (YYYY-MM-DD) do `count`-ésimo dia útil estritamente
// após `fromIso` -- `fromIso` não conta, mesmo se for dia útil. Ex.: sexta +
// 1 dia útil = segunda seguinte.
export function addBusinessDays(fromIso: string, count: number): string {
  const date = new Date(`${fromIso}T00:00:00Z`);
  let remaining = count;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isBusinessDay(date)) remaining--;
  }
  return date.toISOString().slice(0, 10);
}
