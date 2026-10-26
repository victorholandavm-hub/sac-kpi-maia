import Link from "next/link";
import { notFound } from "next/navigation";
import { lerCarga, lerCatalogosComMotoristas, listarCargas, listarEmpresas, mensagemDeErro } from "@/lib/odoo/logistica";
import { ESTADOS_EDITAVEIS } from "@/lib/odoo/logisticaTipos";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { CargaDetalheView } from "@/components/logisticaOdoo/CargaDetalheView";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";

// Carga aberta: cabeçalho com volumes por categoria, transições
// (separação → conferida → liberar → sair/faturar → fim de rota), ordem
// das paradas, remover pedido, baixa manual, romaneio, DANFEs, histórico.
export const dynamic = "force-dynamic";

export default async function CargaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ empresa?: string }> }) {
  const { id } = await params;
  const cargaId = Number(id);
  if (!Number.isInteger(cargaId) || cargaId <= 0) notFound();
  const empresa = empresaDaUrl((await searchParams).empresa);
  const [carga, cat, emps, abertas] = await Promise.allSettled([lerCarga(cargaId), lerCatalogosComMotoristas(empresa), listarEmpresas(), listarCargas(empresa, { estados: ESTADOS_EDITAVEIS, dias: 60 })]);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <Link href={`/assistencia/logistica/cargas?empresa=${empresa}`} className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Todas as cargas
      </Link>
      {carga.status === "rejected" ? (
        <ErroOdoo titulo={`Não consegui abrir a carga ${cargaId}`} mensagem={mensagemDeErro(carga.reason)} />
      ) : (
        <CargaDetalheView
          carga={carga.value}
          catalogos={cat.status === "fulfilled" ? cat.value : null}
          erroCatalogos={cat.status === "rejected" ? mensagemDeErro(cat.reason) : null}
          empresas={emps.status === "fulfilled" ? emps.value : []}
          cargasAbertas={abertas.status === "fulfilled" ? abertas.value.filter((c) => c.carga_id !== cargaId && !c.cancelada) : []}
        />
      )}
    </div>
  );
}
