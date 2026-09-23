"use client";

const inputStyle = { borderColor: "var(--border)" };

// Máscara de centavos -- pedido do Victor 23/09/2026: "deixe os 00 depois
// da vírgula à mostra, para que cada número que digitarem esteja mostrando
// o valor certo". Cada dígito digitado entra pela direita (centavos
// primeiro), mesmo comportamento de caixa de loja/maquininha -- evita o erro
// clássico de digitar "200" pensando em R$200,00 e o campo ler R$2,00 (ou
// vice-versa) por causa do separador decimal.
//
// Versão "crua" (sem hidden input/name) -- controlada de fora, usada onde o
// valor precisa entrar num cálculo/combinação antes de virar um único campo
// de formulário (ver split de forma de pagamento em NovoEstornoRequestForm.tsx).
export function MoneyFieldRaw({ cents, onChange, required }: { cents: number; onChange: (cents: number) => void; required?: boolean }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    onChange(digits ? Math.min(parseInt(digits, 10), 999_999_999) : 0);
  }

  const display = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <input
      type="text"
      inputMode="numeric"
      value={`R$ ${display}`}
      onChange={handleChange}
      required={required}
      className="rounded border px-3 py-2 text-right tabular-nums"
      style={inputStyle}
    />
  );
}
