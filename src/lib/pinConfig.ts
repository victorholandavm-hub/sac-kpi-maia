// Sem imports de propósito (nada de "crypto" nem qualquer coisa server-only)
// -- esse arquivo precisa ser importável tanto por Server Actions quanto por
// componentes "use client" sem quebrar o bundle do navegador. Fonte única do
// tamanho do PIN pra não repetir o número em ~26 arquivos (validação,
// formulários de login, widgets de definir/redefinir PIN).
export const PIN_LENGTH = 6;

// PINs cadastrados antes dessa mudança continuam com 4 dígitos até serem
// redefinidos — verifyPin (pinAuth.ts) não valida tamanho, só compara hash.
const MIN_LEGACY_PIN_LENGTH = 4;

// Usado ao DEFINIR um PIN novo (admin/gerente cadastrando ou redefinindo) —
// exige o tamanho atual, não aceita mais o antigo de 4.
export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

// Usado ao FAZER LOGIN — aceita tanto o tamanho atual quanto PINs antigos
// (4 dígitos) que ainda não foram redefinidos, pra não travar o acesso de
// quem já tinha conta antes dessa mudança.
export function isValidLoginPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${MIN_LEGACY_PIN_LENGTH},${PIN_LENGTH}}$`).test(pin);
}
