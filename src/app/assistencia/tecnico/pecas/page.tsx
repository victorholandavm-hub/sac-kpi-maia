import { redirect } from "next/navigation";
import Link from "next/link";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { listPartOrders, listSuppliers, isPartOrderStatus, type PartOrder } from "@/lib/partOrders";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { PecasTable } from "@/components/assistencia/PecasTable";
import { TecnicoPecasFrame } from "@/components/assistencia/TecnicoPecasFrame";

export const dynamic = "force-dynamic";

function buildHref(params: { status?: string; q?: string; supplier?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.supplier) sp.set("supplier", params.supplier);
  const qs = sp.toString();
  return qs ? `/assistencia/tecnico/pecas?${qs}` : "/assistencia/tecnico/pecas";
}

const FILTERS: { label: string; value: string | null }[] = [
  { label: "Todos", value: null },
  { label: "Aguardando resposta", value: "aguardando_resposta" },
  { label: "Aguardando peça", value: "aguardando_peca" },
  { label: "Peça recebida", value: "peca_recebida" },
  { label: "Enviada ao cliente", value: "enviada_ao_cliente" },
  { label: "Devolvida ao estoque", value: "devolvida_ao_estoque" },
  { label: "Encerrados", value: "encerrado" },
  { label: "Canceladas", value: "cancelada" },
];

// Rota própria da equipe técnica pra Peças -- pedido do Victor 14/09/2026,
// depois de ver a versão anterior (compartilhada com assistência, só o
// cabeçalho mudava): "fica ruim se for compartilhada com a equipe tecnica
// a mesma tela da asisstencia". Mesmos dados/ações de sempre
// (listPartOrders/PecasTable, pecas-actions.ts) -- só a apresentação muda
// (cabeçalho verde + abas em vez do "Controle Assistência"/nav de
// assistência, ver TecnicoPecasFrame.tsx).
export default async function TecnicoPecasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; supplier?: string }>;
}) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const { status, q, supplier } = await searchParams;
  const filterStatus = isPartOrderStatus(status) ? status : undefined;
  const [orders, suppliers]: [PartOrder[], string[]] = await Promise.all([
    listPartOrders({ status: filterStatus, q, supplier }),
    listSuppliers(),
  ]);

  return (
    <TecnicoPecasFrame
      title="Peças"
      subtitle={`Olá, ${tecnicoName} — pedidos de peça de fornecedor: acompanhe status, chegada e envio ao cliente.`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.label}
              label={f.label}
              selected={(f.value ?? undefined) === filterStatus}
              href={buildHref({ status: f.value ?? undefined, q, supplier })}
            />
          ))}
        </div>
        <Link
          href="/assistencia/tecnico/pecas/nova"
          className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
          style={{ background: "#1B5E3C" }}
        >
          + Novo pedido de peça
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="supplier" placeholder="Todos os fornecedores" options={suppliers} />
      </div>

      <form action="/assistencia/tecnico/pecas" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {supplier ? <input type="hidden" name="supplier" value={supplier} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por cliente, produto, peça ou código…"
          className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm flex-1 min-w-[240px]"
        />
        <button type="submit" className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100">
          Buscar
        </button>
        {q ? (
          <Link
            href={buildHref({ status: filterStatus, supplier })}
            className="text-xs underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Limpar busca
          </Link>
        ) : null}
      </form>

      <PecasTable orders={orders} basePath="/assistencia/tecnico/pecas" />
    </TecnicoPecasFrame>
  );
}
