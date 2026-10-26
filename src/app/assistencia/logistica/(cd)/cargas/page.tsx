import Link from "next/link";
import { listarCargas, listarEmpresas, mensagemDeErro } from "@/lib/odoo/logistica";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { ESTADOS_CARGA, ESTADO_CARGA_LABELS, TIPO_CARGA_LABELS, formatarDiaIso, type CargaOdoo } from "@/lib/odoo/logisticaTipos";
import { EmpresaSelect } from "@/components/logisticaOdoo/EmpresaSelect";
import { Chip, ErroOdoo, VolumesChips } from "@/components/logisticaOdoo/ui";

// Aba "Cargas" do Roteirizador: kanban por estado do maia_entrega.
export const dynamic = "force-dynamic";

const JANELAS = [7, 30, 90];

export default async function CargasPage({ searchParams }: { searchParams: Promise<{ empresa?: string; dias?: string }> }) {
  const sp = await searchParams;
  const empresa = empresaDaUrl(sp.empresa);
  const dias = JANELAS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  // 26/10 (Pedro/Jhon: "as cargas de 27/10 não aparecem"): o CD opera as cargas de TODAS as lojas (as migradas do
  // Protheus ficaram na empresa da loja). Sem ?empresa= na URL, junta todas as empresas 2xx; com ?empresa=, só aquela.
  const todasEmpresas = !sp.empresa;
  const empresasRes = await Promise.allSettled([listarEmpresas()]);
  const empresas = empresasRes[0].status === "fulfilled" ? empresasRes[0].value : [];
  const alvo = todasEmpresas ? empresas.filter((e) => /^2\d\d /.test(e.name)).map((e) => e.id) : [empresa];
  const partes = await Promise.allSettled((alvo.length ? alvo : [empresa]).map((id) => listarCargas(id, { dias })));
  const falhas = partes.filter((r) => r.status === "rejected");
  const cargas: PromiseSettledResult<CargaOdoo[]> =
    falhas.length === partes.length ? falhas[0] : { status: "fulfilled", value: partes.flatMap((r) => (r.status === "fulfilled" ? r.value : [])) };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Cargas · últimos {dias} dias{todasEmpresas ? " · todas as lojas e o CD" : ""}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          {JANELAS.map((d) => (
            <Link
              key={d}
              href={`/assistencia/logistica/cargas?empresa=${empresa}&dias=${d}`}
              className="text-xs px-3 py-1.5 rounded-full border"
              style={{ borderColor: "var(--border)", background: d === dias ? "var(--surface-2)" : "transparent", fontWeight: d === dias ? 700 : 400 }}
            >
              {d} dias
            </Link>
          ))}
          <EmpresaSelect empresas={empresas} atual={empresa} />
        </div>
      </div>
      {cargas.status === "rejected" ? (
        <ErroOdoo titulo="Não consegui ler as cargas do Odoo" mensagem={mensagemDeErro(cargas.reason)} />
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {ESTADOS_CARGA.map((estado) => {
            const lista = cargas.value.filter((c) => c.estado === estado);
            return (
              <section key={estado} className="rounded-xl p-2.5 flex flex-col gap-2 min-h-[140px]" style={{ background: "var(--surface-2)" }}>
                <h3 className="text-xs font-bold uppercase tracking-wide px-1" style={{ color: "var(--text-muted)" }}>
                  {ESTADO_CARGA_LABELS[estado]} · {lista.length}
                </h3>
                {lista.map((c) => (
                  <CartaoCarga key={c.carga_id} carga={c} empresa={c.company_id} />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CartaoCarga({ carga: c, empresa }: { carga: CargaOdoo; empresa: number }) {
  return (
    <Link
      href={`/assistencia/logistica/cargas/${c.carga_id}?empresa=${empresa}`}
      className="cartao p-3 flex flex-col gap-1.5 text-sm hover:opacity-90"
      style={{ color: "var(--text-primary)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <b>{c.romaneio}</b>
        <Chip forte>{c.zona || TIPO_CARGA_LABELS[c.tipo] || c.tipo}</Chip>
      </div>
      {c.descricao ? <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.descricao}</div> : null}
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {c.motorista || "sem motorista"}
        {c.veiculo ? ` · ${c.veiculo}` : ""}
      </div>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {c.qtd_paradas} paradas · {c.qtd_pedidos} pedidos{c.data_prevista ? ` · sai ${formatarDiaIso(c.data_prevista)}` : ""}
      </div>
      <VolumesChips volumes={c.volumes_por_categoria} total={c.volumes} />
    </Link>
  );
}
