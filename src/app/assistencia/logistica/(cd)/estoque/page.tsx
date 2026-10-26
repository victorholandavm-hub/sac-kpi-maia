import { audCategorias, listarEmpresas } from "@/lib/odoo/logistica";
import { EstoqueBoard } from "@/components/logisticaOdoo/EstoqueBoard";

// Estoque / auditoria (26/10/2026, Pedro via Antônio Costa — rotinas do Flávio): posição (saldo) por loja/CD,
// estoque negativo, controle de reservas, pedidos parados sem nota/entrega e notas da SEFAZ. Só leitura.
export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const [empresas, categorias] = await Promise.all([
    listarEmpresas().then((l) => l.filter((e) => /^2\d\d /.test(e.name))).catch(() => []),
    audCategorias().catch(() => []),
  ]);
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Estoque · auditoria</h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Saldo de cada loja e do CD, o que está negativo, o que está reservado e para quem, pedidos parados sem nota ou sem entrega e as notas que a SEFAZ mostra contra os nossos CNPJs. Só consulta: nada aqui altera o estoque.
      </p>
      <EstoqueBoard empresas={empresas} categorias={categorias} />
    </div>
  );
}
