"use client";

export function PrintButton() {
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
