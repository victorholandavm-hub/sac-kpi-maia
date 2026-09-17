import Link from "next/link";
import { listPartOrders, listSuppliers, isPartOrderStatus, isPartOrderAtrasoFilter, type PartOrder } from "@/lib/partOrders";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { FilterPill } from "@/components/assistencia/FilterPill";
import { PecasTable } from "@/components/assistencia/PecasTable";
import { UnderlineTab } from "@/components/UnderlineTab";

function buildHref(params: { status?: string; q?: string; supplier?: string; atraso?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.supplier) sp.set("supplier", params.supplier);
  if (params.atraso) sp.set("atraso", params.atraso);
  const qs = sp.toString();
  return qs ? `/assistencia/pecas?${qs}` : "/assistencia/pecas";
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

// Filtro por IDADE do chamado (created_at), não por status -- pedido do
// Victor 17/09/2026: "filtro com todos os chamados que conste atrasado,
// que são os que passam de 30 dias, e também os de 20 a 30 dias (entrando
// em atraso)". Ver PartOrderAtrasoFilter em partOrders.ts.
const ATRASO_FILTERS: { label: string; value: "atrasado" | "entrando_em_atraso"; color: string }[] = [
  { label: "Entrando em atraso (20-30d)", value: "entrando_em_atraso", color: "var(--status-warning)" },
  { label: "Atrasado (+30d)", value: "atrasado", color: "var(--status-critical)" },
];

export default async function PecasQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; supplier?: string; atraso?: string }>;
}) {
  // O layout (pecas/layout.tsx) já garante acesso (Profile assistência/
  // admin -- equipe técnica tem rota própria, /assistencia/tecnico/pecas,
  // desde 14/09/2026) -- nada a checar aqui.
  const { status, q, supplier, atraso } = await searchParams;
  const filterStatus = isPartOrderStatus(status) ? status : undefined;
  const filterAtraso = isPartOrderAtrasoFilter(atraso) ? atraso : undefined;
  const [orders, suppliers]: [PartOrder[], string[]] = await Promise.all([
    listPartOrders({ status: filterStatus, q, supplier, atraso: filterAtraso }),
    listSuppliers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* "Controle Assistência" -- pedido do Victor 27/08/2026: "coloque
          dessa mesma forma em outra aba peças/fornecedores/estoque e
          nomeie essa aba como controle assistencia". Estilo trocado pra
          aba sublinhada 15/09/2026 (pedido do Victor: "preciso que esse
          fique igual a esse [Visitas/Entregas/Agenda]... com essa borda
          em cinza rodeando a aba selecionada") -- mesmo UnderlineTab.tsx
          já usado lá, em vez das pílulas arredondadas de antes. 3 rotas
          próprias, dado/filtro cada uma o seu -- sem layout compartilhado,
          cada página renderiza sua própria fileira. Rota exclusiva de
          assistência/admin -- equipe técnica tem sua própria desde
          14/09/2026 (/assistencia/tecnico/pecas). */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        <UnderlineTab href="/assistencia/pecas" label="Peças" active />
        <UnderlineTab href="/assistencia/fornecedores" label="Fornecedores" active={false} />
        <UnderlineTab href="/assistencia/estoque" label="Estoque" active={false} />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.label}
              label={f.label}
              selected={(f.value ?? undefined) === filterStatus}
              href={buildHref({ status: f.value ?? undefined, q, supplier, atraso: filterAtraso })}
            />
          ))}
        </div>
        <Link
          href="/assistencia/pecas/nova"
          className="text-sm px-4 py-2.5 rounded-lg font-semibold text-white shadow-sm whitespace-nowrap transition-all duration-200 hover:brightness-110"
          style={{ background: "#1B5E3C" }}
        >
          + Novo pedido de peça
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {ATRASO_FILTERS.map((f) => (
          <FilterPill
            key={f.value}
            label={f.label}
            color={f.color}
            selected={f.value === filterAtraso}
            href={buildHref({ status: filterStatus, q, supplier, atraso: f.value === filterAtraso ? undefined : f.value })}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect name="supplier" placeholder="Todos os fornecedores" options={suppliers} />
      </div>

      <form action="/assistencia/pecas" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterStatus ? <input type="hidden" name="status" value={filterStatus} /> : null}
        {supplier ? <input type="hidden" name="supplier" value={supplier} /> : null}
        {filterAtraso ? <input type="hidden" name="atraso" value={filterAtraso} /> : null}
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
          <Link href={buildHref({ status: filterStatus, supplier, atraso: filterAtraso })} className="text-xs underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Limpar busca
          </Link>
        ) : null}
      </form>

      {/* Tabela Grid Horizontal -- mesmo padrão da aba Entregas (pedido do
          Victor 09/09/2026), ver PecasTable.tsx. */}
      <PecasTable orders={orders} />
    </div>
  );
}
