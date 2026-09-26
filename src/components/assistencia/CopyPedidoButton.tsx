"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Botão discreto pra copiar o nº do pedido -- pedido do Victor 26/09/2026
// (redesign do "Minhas encomendas" do SAC): o atendente lê o número na
// tela e digita/cola no chat com o cliente; um botão de copiar ao lado
// evita erro de digitação numa ligação. `stopPropagation` porque o botão
// fica dentro do <summary> do accordion -- sem isso, clicar copiar também
// abre/fecha o card.
export function CopyPedidoButton({ pedidoNumber }: { pedidoNumber: number }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`#${pedidoNumber}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard indisponível (contexto não seguro, permissão negada) --
      // sem alternativa melhor aqui, o número já está visível na tela pra
      // copiar manualmente.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar número do pedido"
      className="inline-flex items-center justify-center rounded p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >
      {copied ? <Check size={12} style={{ color: "var(--status-good)" }} /> : <Copy size={12} />}
    </button>
  );
}
