// Sanitiza um termo de busca livre antes de colar dentro de uma string
// `.or("col.ilike.%valor%,...")` do PostgREST -- vírgula e parênteses são
// delimitadores estruturais desse formato (separam condições e agrupam),
// então um valor digitado pela pessoa usuária que contenha esses
// caracteres quebra o filtro pretendido e permite anexar condições extras
// (qualquer coluna/operador) à consulta. Ilike já é substring match, então
// perder esses três caracteres do termo buscado não tira utilidade real da
// busca -- CPF, telefone, nome e código de pedido nunca os usam de verdade.
export function sanitizeOrFilterValue(value: string): string {
  return value.replace(/[,()]/g, "");
}
