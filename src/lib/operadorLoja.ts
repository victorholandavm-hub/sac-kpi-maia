// 27/10/2026 (Pedro/Antônio Costa): conferente/estoquista de LOJA entra com o PIN do CD (cd_operadores), mas fica
// preso à loja dele e só vê Estoque (relatórios de contagem/saldo/rotatividade) e Kardex. Quem é: CD_OPERADOR_LOJA no
// .env.local, "Nome:filial:company_id" separados por ";" (ex.: "Jose Diego:214:14"). Arquivo puro (usado no proxy).
export type OperadorLoja = { filial: string; companyId: number };

export function operadorLoja(nome: string | null | undefined): OperadorLoja | null {
  if (!nome) return null;
  for (const it of (process.env.CD_OPERADOR_LOJA ?? "").split(";")) {
    const [n, f, c] = it.split(":").map((x) => (x ?? "").trim());
    if (n && n.toLowerCase() === nome.trim().toLowerCase() && Number(c) > 0) return { filial: f, companyId: Number(c) };
  }
  return null;
}

export const ROTAS_OPERADOR_LOJA = ["/assistencia/logistica/estoque", "/assistencia/logistica/kardex", "/assistencia/logistica/pedir-transferencia"];
