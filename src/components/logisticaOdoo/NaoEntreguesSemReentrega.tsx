import { naoEntreguesSemReentrega } from "@/lib/naoEntregues";

// Conferência dos "não entregue" que ficaram sem reentrega -- Victor 30/10/2026
// (22 pedidos sumiram da fila depois que o motorista deu "não entregue").
// Fechado como os outros quadros; some quando não há nenhum.
export async function NaoEntreguesSemReentrega() {
  const lista = await naoEntreguesSemReentrega().catch(() => []);
  if (lista.length === 0) return null;
  return (
    <details className="cartao px-4 py-2 group" style={{ border: "2px solid var(--status-critical)" }}>
      <summary className="cursor-pointer list-none flex items-center gap-2 py-1 text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
        Voltaram “não entregue” e estão sem reentrega
        <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--status-critical)", color: "#fff" }}>
          {lista.length}
        </span>
      </summary>
      <div className="flex flex-col gap-1 pb-2">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Últimos 30 dias. O motorista deu “não entregue”, mas o pedido não tem saída aberta na fila nem foi para outra carga — o Odoo pode estar achando
          que foi entregue. Peça ao TI para reabrir.
        </p>
        <ul>
          {lista.map((f) => (
            <li key={f.pedido} className="py-1.5 text-sm" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <b>{f.pedido}</b> · {f.cliente ?? "—"}
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {" "}
                · voltou da {f.carga}
                {f.dia ? ` em ${f.dia.split("-").reverse().join("/")}` : ""}
                {f.motivo ? ` (${f.motivo})` : ""}
                {f.motorista ? ` · ${f.motorista}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
