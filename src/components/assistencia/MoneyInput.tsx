"use client";

import { useState } from "react";

const inputStyle = { borderColor: "var(--border)" };

// Máscara de centavos -- pedido do Victor 23/09/2026: "deixe os 00 depois
// da vírgula à mostra, para que cada número que digitarem esteja mostrando
// o valor certo". Cada dígito digitado entra pela direita (centavos
// primeiro), mesmo comportamento de caixa de loja/maquininha -- evita o erro
// clássico de digitar "200" pensando em R$200,00 e o campo ler R$2,00 (ou
// vice-versa) por causa do separador decimal.
export function MoneyInput({ name, required, defaultValueCents = 0 }: { name: string; required?: boolean; defaultValueCents?: number }) {
  const [cents, setCents] = useState(defaultValueCents);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setCents(digits ? Math.min(parseInt(digits, 10), 999_999_999) : 0);
  }

  const display = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const decimalValue = (cents / 100).toFixed(2);

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={`R$ ${display}`}
        onChange={handleChange}
        required={required}
        className="rounded border px-3 py-2 text-right tabular-nums"
        style={inputStyle}
      />
      <input type="hidden" name={name} value={decimalValue} />
    </>
  );
}
