import { lerCatalogosComMotoristas, lerExpedicao, listarCargas, listarEmpresas, mensagemDeErro } from "@/lib/odoo/logistica";
import { ESTADOS_EDITAVEIS, type CargaOdoo, type ExpedicaoResposta } from "@/lib/odoo/logisticaTipos";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { ExpedicaoBoard } from "./ExpedicaoBoard";
import { EmpresaSelect } from "./EmpresaSelect";
import { ErroOdoo } from "./ui";
import { NotasDeOutros } from "./NotasDeOutros";
import { NaoEntreguesSemReentrega } from "./NaoEntreguesSemReentrega";
import { aplicarDatasProgramadas } from "@/lib/odoo/dataProgramada";

// Fila de expedição = tela "Entregas e Retiradas" do Roteirizador do
// Protheus: saídas sem carga, filtros (região, modo/ABA, pendência,
// retorno), volumes por categoria, seleção → montar carga, e os verbos por
// entrega (pendência, fila, filial, data, anotação, histórico).
// 27/10 (Pedro/John): igual à aba Cargas — sem ?empresa= junta TODAS as empresas 2xx (o John não via as pendências
// de loja que saem do CD); com ?empresa= mostra só aquela. Cada saída leva a empresa da fila de onde veio.
// sac: a mesma fila na Expedição do SAC (Victor 29/10/2026), sem montar carga.
export async function ExpedicaoFila({ sp, sac = false }: { sp: { empresa?: string }; sac?: boolean }) {
  const empresa = empresaDaUrl(sp.empresa);
  const todas = !sp.empresa;
  const empresasRes = await Promise.allSettled([listarEmpresas()]);
  const empresas = empresasRes[0].status === "fulfilled" ? empresasRes[0].value : [];
  const alvo = todas ? empresas.filter((e) => /^2\d\d /.test(e.name)).map((e) => e.id) : [empresa];
  const ids = alvo.length ? alvo : [empresa];
  const nomeDe = (id: number) => empresas.find((e) => e.id === id)?.name ?? String(id);
  const [partes, cat, abertasPartes] = await Promise.all([
    Promise.allSettled(ids.map((id) => lerExpedicao(id))),
    Promise.allSettled([lerCatalogosComMotoristas(empresa)]).then((r) => r[0]),
    sac ? Promise.resolve([]) : Promise.allSettled(ids.map((id) => listarCargas(id, { estados: ESTADOS_EDITAVEIS, dias: 60 }))),
  ]);
  const falhas = partes.filter((r) => r.status === "rejected");
  let exp: PromiseSettledResult<ExpedicaoResposta>;
  if (falhas.length === partes.length) {
    exp = falhas[0] as PromiseRejectedResult;
  } else {
    const vistos = new Set<number>();
    const juntar = (campo: "entregas" | "pendencias") =>
      partes.flatMap((r, i) =>
        r.status === "fulfilled"
          ? r.value[campo]
              .filter((e) => (vistos.has(e.picking_id) ? false : (vistos.add(e.picking_id), true)))
              .map((e) => ({ ...e, empresa_id: ids[i], empresa_nome: nomeDe(ids[i]) }))
          : [],
      );
    const entregas = await aplicarDatasProgramadas(juntar("entregas"));
    const pendencias = await aplicarDatasProgramadas(juntar("pendencias"));
    const por_zona: Record<string, number> = {};
    for (const e of entregas) por_zona[e.zona || "(sem zona)"] = (por_zona[e.zona || "(sem zona)"] ?? 0) + 1;
    exp = { status: "fulfilled", value: { ok: true, company_id: empresa, total: entregas.length, por_zona, entregas, pendencias, total_pendencias: pendencias.length } };
  }
  const abertas: CargaOdoo[] = abertasPartes.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Fila de expedição · saídas sem carga{todas ? " · todas as lojas e o CD" : ""}
        </h2>
        <EmpresaSelect empresas={empresas} atual={empresa} />
      </div>
      {!sac ? <NotasDeOutros /> : null}
      {!sac ? <NaoEntreguesSemReentrega /> : null}
      {falhas.length && falhas.length < partes.length ? (
        <p className="text-sm" style={{ color: "var(--status-serious)" }}>Algumas lojas não responderam agora ({falhas.length}); a lista pode estar incompleta.</p>
      ) : null}
      {exp.status === "rejected" ? (
        <ErroOdoo titulo="Não consegui ler a fila do Odoo" mensagem={mensagemDeErro(exp.reason)} />
      ) : cat.status === "rejected" ? (
        <ErroOdoo titulo="Não consegui ler os cadastros (regiões, motoristas, veículos)" mensagem={mensagemDeErro(cat.reason)} />
      ) : (
        <ExpedicaoBoard companyId={empresa} expedicao={exp.value} catalogos={cat.value} empresas={empresas} cargasAbertas={abertas.filter((c) => !c.cancelada)} sac={sac} />
      )}
    </div>
  );
}
