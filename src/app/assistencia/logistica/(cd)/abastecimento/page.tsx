import { listarEmpresas, listarSolicitacoesAbast, listarTransferencias, mensagemDeErro, type TransferenciaEmitida } from "@/lib/odoo/logistica";
import { AbastecimentoBoard } from "@/components/logisticaOdoo/AbastecimentoBoard";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";

// Pedidos de abastecimento das lojas (antes: solicitação de transferência
// NNS/NNT do Protheus). A loja pede no caixa (Caixa do dia › Pedir
// abastecimento); aqui o CD ajusta o que vai no caminhão e atende: sai a
// NF-e 5152 do CD para a loja e o estoque entra na loja (1152).
export const dynamic = "force-dynamic";

export default async function AbastecimentoPage() {
  let lista;
  let notas: TransferenciaEmitida[] = [];
  const empresas = await listarEmpresas().catch(() => []);
  try {
    notas = await listarTransferencias(7);
  } catch {
    notas = [];
  }
  try {
    lista = await listarSolicitacoesAbast();
  } catch (err) {
    return <ErroOdoo titulo="Não consegui ler os pedidos das lojas" mensagem={mensagemDeErro(err)} />;
  }
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Pedidos de abastecimento das lojas
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        A loja pede pelo caixa. Ajuste o que vai no caminhão e clique em Atender: sai a nota de transferência do CD para a loja.
      </p>
      <AbastecimentoBoard solicitacoes={lista} empresas={empresas} />
      <div className="cartao p-4 flex flex-col gap-2">
        <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>
          Notas de transferência emitidas (últimos 7 dias)
        </h3>
        {notas.length === 0 ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhuma nota de transferência nos últimos 7 dias.</p> : null}
        {notas.map((n) => (
          <div key={n.chave || n.numero} className="flex items-center justify-between gap-2 text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
            <span>
              <b>NF 5152 nº {n.numero}</b> · {n.loja} · {new Date(n.data.replace(" ", "T") + "Z").toLocaleString("pt-BR", { timeZone: "America/Recife" })} ·{" "}
              {n.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {n.estado}
            </span>
            {n.chave ? (
              <a href={`/assistencia/logistica/pdf/nota/${n.chave}`} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                🖨 DANFE
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
