import { DELIVERY_REQUEST_TYPES } from "./assistenciaLabels";
import type { RequestType } from "./serviceRequests";

// CPF digitado pode vir com ou sem pontuação -- compara só os dígitos.
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Sem CPF de 11 dígitos gravado no pedido (client_cpf), não dá pra confirmar
// identidade -- retorna false mesmo que o campo esteja vazio nos dois lados,
// pra não deixar passar "sem CPF cadastrado" comparado com "campo em branco
// digitado" (ver getRatingAccess em avaliar/actions.ts, que trata isso como
// motivo separado, "no_cpf_on_file", antes mesmo de chegar aqui).
export function cpfMatches(input: string, stored: string | null): boolean {
  const storedDigits = onlyDigits(stored ?? "");
  if (storedDigits.length !== 11) return false;
  return onlyDigits(input) === storedDigits;
}

// Motorista atende os tipos de entrega (DELIVERY_REQUEST_TYPES); todo o
// resto que passa pela tela de avaliação é montador -- mesmo critério que
// separa as duas telas hoje (montador/[id] vs motorista/[id]).
export function ratingKind(type: RequestType): "montagem" | "entrega" {
  return (DELIVERY_REQUEST_TYPES as readonly string[]).includes(type) ? "entrega" : "montagem";
}
