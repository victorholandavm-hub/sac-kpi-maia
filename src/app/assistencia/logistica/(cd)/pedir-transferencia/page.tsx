import { listarEmpresas, listarSolicitacoesAbast } from "@/lib/odoo/logistica";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { PedirTransferenciaForm } from "@/components/logisticaOdoo/PedirTransferenciaForm";

// 27/10/2026 (Pedro/Antônio Costa): o conferente/estoquista da loja pede transferência (abastecimento) ao CD daqui;
// o CD vê em "Pedidos das lojas" e atende (sai a 5152). Mesmo pedido do caixa (Caixa do dia › Pedir abastecimento).
export const dynamic = "force-dynamic";

export default async function PedirTransferenciaPage() {
  const op = await getOperadorLogistica();
  const empresas = (await listarEmpresas().catch(() => [])).filter((e) => /^2\d\d /.test(e.name) && !e.name.startsWith("213 "));
  const lojas = op?.loja ? empresas.filter((e) => e.id === op.loja!.companyId) : empresas;
  const pedidos = (await listarSolicitacoesAbast(30).catch(() => [])).filter((s) => lojas.some((l) => l.id === s.company_id));
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Pedir transferência ao CD</h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Monte a lista do que a loja precisa e envie. O CD recebe em &quot;Pedidos das lojas&quot;, separa e manda com a nota de transferência; o estoque entra sozinho na loja.
      </p>
      <PedirTransferenciaForm lojas={lojas} />
      <div className="cartao p-4 flex flex-col gap-2">
        <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Pedidos dos últimos 30 dias</h3>
        {pedidos.length === 0 ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum pedido.</p> : null}
        {pedidos.map((p) => (
          <div key={p.id} className="text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
            <b>{p.nome}</b> · {p.loja} · {p.estado} · {p.criado?.slice(0, 16).replace("T", " ")} · {p.solicitante}
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {p.itens.map((i) => `${(i as { qtd?: number }).qtd ?? ""}× ${(i as { codigo?: string }).codigo ?? ""}`).join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
