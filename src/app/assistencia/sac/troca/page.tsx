import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { consultarPedidosOdoo } from "@/lib/consultaOdooPonte";
import { TrocaSacForm, TrazerVendaProtheus } from "@/components/assistencia/TrocaSacForm";

export const dynamic = "force-dynamic";

// Troca de produto na nota pelo SAC (autorizada pelo Victor) -- 30/10/2026.
// ?pedido=S01234 (pedido do Odoo) ou, para venda do Protheus que ainda não está
// no Odoo, ?filial=&cpf=&chave= (a tela traz a venda antes).
export default async function TrocaSacPage({ searchParams }: { searchParams: Promise<{ pedido?: string; filial?: string; cpf?: string; chave?: string; nf?: string }> }) {
  const profile = await getProfile();
  if (!["sac", "assistencia", "admin"].includes(profile.role)) redirect("/assistencia/inicio");
  const sp = await searchParams;
  const voltar = profile.role === "assistencia" ? "/assistencia/pedidos" : "/assistencia/sac/pedidos";

  let conteudo: React.ReactNode;
  if (sp.pedido) {
    const p = (await consultarPedidosOdoo(sp.pedido).catch(() => [])).find((x) => x.pedido === sp.pedido);
    conteudo = p ? (
      <TrocaSacForm
        pedido={p.pedido}
        pedidoId={p.pedido_id}
        cliente={p.cliente?.nome ?? null}
        loja={p.loja}
        itens={(p.itens ?? []).map((i) => ({ codigo: i.codigo, nome: i.nome, qtd: Number(i.qtd ?? 0), preco: Number(i.preco ?? 0) }))}
      />
    ) : (
      <p className="text-sm" style={{ color: "var(--status-critical)" }}>
        Pedido {sp.pedido} não encontrado no Odoo agora. Tente de novo em instantes.
      </p>
    );
  } else if (sp.filial && sp.cpf && sp.chave) {
    conteudo = <TrazerVendaProtheus filial={sp.filial} cpf={sp.cpf} chave={sp.chave} nf={sp.nf ?? ""} />;
  } else {
    conteudo = (
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Abra a troca pelo botão “Trocar produto” no cartão do pedido, na Consulta de pedido.
      </p>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-6 flex flex-col gap-5 min-w-0">
      <AssistenciaHeader title="Trocar produto" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`}>
        <Link href="/assistencia/sac/trocas" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Trocas pedidas
        </Link>
        <Link href={voltar} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Consulta de pedido
        </Link>
      </AssistenciaHeader>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Monte a troca e peça a autorização. Ela só é feita quando o Victor autorizar: aí sai o crédito (ou a devolução) do que volta e a venda nova do
        produto novo, com o mesmo vendedor da venda original.
      </p>
      {conteudo}
    </div>
  );
}
