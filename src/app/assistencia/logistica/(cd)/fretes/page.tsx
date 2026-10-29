import { listarCtes } from "@/lib/odoo/cte";
import { mensagemDeErro } from "@/lib/odoo/logistica";
import { FretesCteBoard } from "@/components/logisticaOdoo/FretesCteBoard";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";

// Fretes (CT-e) do CD — 29/10/2026 (Pedro → Eduardo). Os conhecimentos de frete das compras chegam sozinhos (robô da
// SEFAZ, a cada 4 h) e o frete é dividido entre as notas e os itens de hora em hora. Esta tela mostra cada CT-e com a
// situação e deixa o Eduardo resolver o que travou: vincular a NF-e (quando o CT-e veio sem a chave) e subir o XML de um
// CT-e que o robô não pegou. Não mexe em custo nem em estoque.
export const dynamic = "force-dynamic";

export default async function FretesPage({ searchParams }: { searchParams: Promise<{ dias?: string; q?: string }> }) {
  const sp = await searchParams;
  const dias = [30, 60, 90, 180, 400].includes(Number(sp.dias)) ? Number(sp.dias) : 60;
  const q = (sp.q ?? "").trim();
  let lista;
  try {
    lista = await listarCtes(dias, q);
  } catch (err) {
    return <ErroOdoo titulo="Não consegui ler os fretes (CT-e)" mensagem={mensagemDeErro(err)} />;
  }
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Fretes (CT-e) das compras
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Cada linha é um conhecimento de frete emitido contra o nosso CNPJ. Clique na linha para ver as notas e o rateio. Só precisa agir no que estiver
        <b> Sem nota</b> (informe a chave da NF-e) ou quando um CT-e não apareceu aqui (<b>Subir XML do CT-e</b>).
      </p>
      <FretesCteBoard lista={lista} dias={dias} q={q} />
    </div>
  );
}
