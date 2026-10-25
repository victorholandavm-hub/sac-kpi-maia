import { listarPedidosCompra, mensagemDeErro } from "@/lib/odoo/logistica";
import { ComprasBoard } from "@/components/logisticaOdoo/ComprasBoard";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";

// Compras do CD (antes: pedido de compra SC7 + entrada SF1/SD1 do Protheus).
// O pedido de compra alimenta a pré-venda (previsão de chegada) do coach e do
// site; a previsão só baixa quando a entrada da nota é dada aqui.
export const dynamic = "force-dynamic";

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const sp = await searchParams;
  const estado = sp.estado === "todos" ? "todos" : "abertos";
  let r;
  try {
    r = await listarPedidosCompra(estado, sp.q ?? "");
  } catch (err) {
    return <ErroOdoo titulo="Não consegui ler os pedidos de compra" mensagem={mensagemDeErro(err)} />;
  }
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Compras do CD
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Quando a mercadoria chegar, abra o pedido, digite quanto chegou e o número da nota e clique em Dar entrada. O que não chegou
        continua previsto. A previsão de chegada que você coloca aqui é a que o vendedor vê no coach e o cliente vê no site.
      </p>
      <ComprasBoard pedidos={r.pedidos} hoje={r.hoje} estado={estado} q={sp.q ?? ""} />
    </div>
  );
}
