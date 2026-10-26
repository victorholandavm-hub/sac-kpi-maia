import { audGrupos, listarEmpresas } from "@/lib/odoo/logistica";
import { EstoqueBoard } from "@/components/logisticaOdoo/EstoqueBoard";

// Estoque / auditoria (26/10/2026, Pedro via Antônio Costa — rotinas do Flávio): posição, geral (com e sem saldo), por
// fornecedor, por grupo, saldo negativo, rotatividade (dias sem/com saída), reservas, pedidos parados e SEFAZ. Só leitura.
export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const [empresas, grupos] = await Promise.all([
    listarEmpresas().then((l) => l.filter((e) => /^2\d\d /.test(e.name))).catch(() => []),
    audGrupos().catch(() => []),
  ]);
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Estoque · auditoria</h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Os relatórios de estoque de cada loja e do CD: posição, geral com e sem saldo, por fornecedor, por grupo, negativos, rotatividade, reservas, pedidos parados e notas da SEFAZ. Avaria e Assistência ficam fora do saldo de venda (colunas próprias na Posição). Só consulta: nada aqui altera o estoque.
      </p>
      <EstoqueBoard empresas={empresas} grupos={grupos} />
    </div>
  );
}
