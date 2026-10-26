import { ProdutosBoard } from "@/components/logisticaOdoo/ProdutosBoard";

// 26/10/2026 (Pedro): cadastro de produto e preço (tabela 087) pela interface do CD, nunca pelo Odoo.
// O preço salvo aqui chega ao coach e ao site em até 10 minutos.
export const dynamic = "force-dynamic";

export default function ProdutosPage() {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Produtos e preços (tabela)
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Busque pelo código ou pelo nome para mudar o preço, ou cadastre um produto novo. O preço salvo aqui vale para o coach e o site em até 10 minutos.
      </p>
      <ProdutosBoard />
    </div>
  );
}
