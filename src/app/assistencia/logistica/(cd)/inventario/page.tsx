import Link from "next/link";
import { listarEmpresas } from "@/lib/odoo/logistica";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { InventarioBoard } from "@/components/logisticaOdoo/InventarioBoard";
import { TransferenciaEstoques } from "@/components/logisticaOdoo/TransferenciaEstoques";
import { DevolucaoFornecedor } from "@/components/logisticaOdoo/DevolucaoFornecedor";
import { TransferenciasRecebidas } from "@/components/logisticaOdoo/TransferenciasRecebidas";

// Inventário / contagem (25/10/2026 noite). Antes: contagem do SIGAEST no Protheus. O operador escolhe a loja/CD,
// digita código e quantidade contada; a tela mostra o saldo do sistema e a diferença; "Aplicar" grava o ajuste no Odoo.
// 26/10 (Pedro/Flávio): sub-aba "Transferência entre estoques" (venda <-> avaria <-> assistência).
export const dynamic = "force-dynamic";

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ empresa?: string; aba?: string }> }) {
  const sp = await searchParams;
  const empresa = empresaDaUrl(sp.empresa);
  const aba = sp.aba === "transferencia" ? "transferencia" : sp.aba === "devolucao" ? "devolucao" : sp.aba === "recebidas" ? "recebidas" : sp.aba === "enviadas" ? "enviadas" : "contagem";
  const empresas = (await listarEmpresas().catch(() => [])).filter((e) => /^2\d\d /.test(e.name));
  const pill = (a: string, rotulo: string) => (
    <Link href={`/assistencia/logistica/inventario?aba=${a}&empresa=${empresa}`} className="text-sm px-4 py-1.5 rounded-full border font-semibold"
      style={{ borderColor: aba === a ? "var(--brand-green)" : "var(--border)", background: aba === a ? "var(--surface-2)" : "transparent", color: "var(--text-primary)" }}>
      {rotulo}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex gap-2 flex-wrap">{pill("contagem", "Contagem")}{pill("transferencia", "Transferência entre estoques")}{pill("devolucao", "Devolução ao fornecedor")}{pill("recebidas", "Transferências recebidas")}{pill("enviadas", "Transferências enviadas")}</div>
      {aba === "contagem" ? (
        <>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Inventário · contagem de estoque</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Digite o código e quanto contou. A tela mostra o que o sistema tem e a diferença. Confira e clique em Aplicar: o estoque do Odoo passa a ser o contado, com histórico no Kardex.
          </p>
          <InventarioBoard empresas={empresas} empresaAtual={empresa} />
        </>
      ) : aba === "recebidas" || aba === "enviadas" ? (
        <>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{aba === "recebidas" ? "Transferências recebidas" : "Transferências enviadas"} · últimos 30 dias</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {aba === "recebidas" ? "Notas de transferência (5152) que as lojas mandaram para cá, com a observação que a loja escreveu (avaria, cliente, mostruário…)." : "Notas de transferência (5152) que saíram daqui para as lojas."}
          </p>
          <TransferenciasRecebidas empresaAtual={empresa} sentido={aba === "recebidas" ? "recebida" : "enviada"} />
        </>
      ) : aba === "devolucao" ? (
        <>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Devolução ao fornecedor</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Bipe a chave da nota de ENTRADA, marque o que volta e emita a NF-e de devolução (5202/6202). Sai com os mesmos preços e ICMS da entrada e a referência de cada nota. O financeiro (Gabriel) é avisado sozinho.
          </p>
          <DevolucaoFornecedor empresas={empresas} empresaAtual={empresa} />
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Transferência entre estoques</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Mande produto do estoque de venda para Avaria ou Assistência (e a volta), em qualquer loja ou no CD. Fica registrado quem fez e o motivo.
          </p>
          <TransferenciaEstoques empresas={empresas} empresaAtual={empresa} />
        </>
      )}
    </div>
  );
}
