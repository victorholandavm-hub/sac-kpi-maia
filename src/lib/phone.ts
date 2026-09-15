// wa.me exige o número completo com DDI -- número brasileiro sem DDI tem 10
// ou 11 dígitos (DDD + telefone); com DDI (55 + DDD + telefone) tem 12 ou 13.
// Checar o tamanho em vez de "já começa com 55" evita tratar errado um
// número de DDD 55 (Santa Maria/RS) como se já tivesse DDI.
//
// `message` opcional -- pedido do Victor 15/09/2026 (motorista avisar os
// clientes da rota ao sair do CD): vai pro parâmetro `?text=` do wa.me, que
// abre o WhatsApp já com a mensagem escrita na caixa de texto -- ainda
// precisa a pessoa apertar enviar (wa.me não manda sozinho, é só um link).
export function whatsappHref(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  const base = `https://wa.me/${withCountryCode}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}
