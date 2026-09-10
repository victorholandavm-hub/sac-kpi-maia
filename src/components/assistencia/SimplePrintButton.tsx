"use client";

// Botão de imprimir simples -- sem o controle de "já impressa" do
// PrintButton.tsx (isso é específico de chamado de assistência, registrado
// em service_request_events; pedido de peça não tem esse mesmo controle,
// nem foi pedido aqui).
export function SimplePrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden text-sm px-4 py-2 rounded font-medium self-start"
      style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
    >
      Imprimir
    </button>
  );
}
