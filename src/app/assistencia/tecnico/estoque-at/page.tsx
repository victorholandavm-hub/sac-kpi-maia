import { redirect } from "next/navigation";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { TecnicoCabecalho } from "@/components/assistencia/TecnicoCabecalho";
import { TecnicoTabs } from "@/components/assistencia/TecnicoTabs";
import { listarEmpresas, mensagemDeErro, saldoEstoqueTipo, type SaldoEstoqueItem } from "@/lib/odoo/logistica";
import { TransferenciaAtForm } from "@/components/assistencia/TransferenciaAtForm";

export const dynamic = "force-dynamic";

// Estoque AT (o estoque "Assistência" de cada loja/CD no Odoo, criado pelo
// Pedro em 26/10, fora do estoque de venda) pra equipe técnica -- Victor
// 27/10/2026. Só leitura, ponte /inventario/estoque?tipo=assistencia.
// Na virada o saldo do armazém AT do Protheus não foi carregado (MURAL do
// Pedro, 26/10): até ele carregar, só aparece o que entrou depois.

const CD = 13;

export default async function TecnicoEstoqueAtPage({ searchParams }: { searchParams: Promise<{ empresa?: string; q?: string }> }) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) redirect("/assistencia/tecnico/login");
  const sp = await searchParams;
  const empresas = (await listarEmpresas().catch(() => [])).filter((e) => /^2\d\d /.test(e.name));
  const empresaId = Number(sp.empresa) || CD;
  const q = (sp.q ?? "").trim().toLowerCase();

  let itens: SaldoEstoqueItem[] = [];
  let erro = "";
  try {
    itens = (await saldoEstoqueTipo(empresaId, "assistencia")).itens ?? [];
  } catch (e) {
    erro = mensagemDeErro(e);
  }
  const filtrados = q ? itens.filter((i) => i.codigo.toLowerCase().includes(q) || i.produto.toLowerCase().includes(q)) : itens;
  const pecas = filtrados.reduce((t, i) => t + Number(i.qtd || 0), 0);
  const campo = { background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" };

  return (
    <div className="w-full flex flex-col min-w-0 bg-[var(--background)] min-h-screen">
      <TecnicoCabecalho titulo="Estoque AT" subtitulo={`Olá, ${tecnicoName} — o que está no estoque da Assistência de cada loja e do CD, no Odoo.`} />
      <div className="max-w-6xl mx-auto w-full px-6 py-5 flex flex-col gap-5 min-w-0">
        <TecnicoTabs active="estoque-at" />
        <TransferenciaAtForm empresas={empresas.map((e) => ({ id: e.id, name: e.name }))} empresaAtual={empresaId} />
        <form method="GET" action="/assistencia/tecnico/estoque-at" className="flex flex-wrap gap-2 items-end">
          <select name="empresa" defaultValue={String(empresaId)} className="rounded-xl px-3 py-2.5 text-sm" style={campo}>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Código ou nome do produto" className="flex-1 min-w-[220px] rounded-xl px-4 py-2.5 text-sm" style={campo} />
          <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
            Ver
          </button>
        </form>

        {erro ? (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--status-warning) 14%, transparent)", color: "var(--text-primary)" }}>
            O Odoo não respondeu agora ({erro}). Tente de novo em instantes.
          </p>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <b style={{ color: "var(--text-primary)" }}>{pecas.toLocaleString("pt-BR")}</b> peça{pecas === 1 ? "" : "s"} em {filtrados.length} produto
              {filtrados.length === 1 ? "" : "s"}.
            </p>
            {itens.length === 0 ? (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>
                Nada no estoque da Assistência desta loja no Odoo. O saldo do armazém AT do Protheus ainda não foi carregado no Odoo (está com o Pedro); só aparece o que foi transferido depois de 25/10.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl" style={{ background: "var(--surface-1)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-left" style={{ color: "var(--text-muted)" }}>
                      <th className="px-3 py-2 font-medium">Código</th>
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium text-right">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((i) => (
                      <tr key={i.codigo} className="border-t" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                        <td className="px-3 py-2 font-mono tabular-nums select-all">{i.codigo}</td>
                        <td className="px-3 py-2">{i.produto}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{Number(i.qtd).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
