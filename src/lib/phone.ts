// wa.me exige o número completo com DDI -- número brasileiro sem DDI tem 10
// ou 11 dígitos (DDD + telefone); com DDI (55 + DDD + telefone) tem 12 ou 13.
// Checar o tamanho em vez de "já começa com 55" evita tratar errado um
// número de DDD 55 (Santa Maria/RS) como se já tivesse DDI.
export function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountryCode}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}
