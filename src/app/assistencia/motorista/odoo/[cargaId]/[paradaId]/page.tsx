import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { lerCarga, lerCatalogos, mensagemDeErro } from "@/lib/odoo/logistica";
import { empresasDoMotorista, getMotoristaSessao } from "@/lib/odoo/logisticaAuth";
import { resolverEmQualquerEmpresa } from "@/lib/odoo/rotaMotorista";
import { RESULTADO_LABELS } from "@/lib/odoo/logisticaTipos";
import { telHref, whatsappHref } from "@/lib/phone";
import { ParadaOdooBaixa } from "@/components/logisticaOdoo/ParadaOdooBaixa";
import { Chip, ErroOdoo } from "@/components/logisticaOdoo/ui";

export const dynamic = "force-dynamic";

export default async function ParadaOdooPage({ params }: { params: Promise<{ cargaId: string; paradaId: string }> }) {
  const sessao = await getMotoristaSessao();
  if (!sessao) redirect("/assistencia/motorista/login");
  const p = await params;
  const cargaId = Number(p.cargaId);
  const paradaId = Number(p.paradaId);
  if (!Number.isInteger(cargaId) || !Number.isInteger(paradaId)) notFound();

  const [lida, casamento, cat] = await Promise.all([
    lerCarga(cargaId, "motorista").then(
      (c) => ({ carga: c, erro: null as string | null }),
      (e: unknown) => ({ carga: null, erro: mensagemDeErro(e) }),
    ),
    resolverEmQualquerEmpresa(sessao.nome).catch((e) => ({ ok: false as const, motivo: mensagemDeErro(e) })),
    lerCatalogos(empresasDoMotorista()[0], "motorista").catch(() => null),
  ]);
  const carga = lida.carga;
  let erro = lida.erro;
  const dono = !!carga && casamento.ok && carga.motorista_id === casamento.employeeId;
  if (carga && !dono && !sessao.supervisor) erro = "Essa carga não é sua.";
  const idx = carga ? carga.paradas.findIndex((x) => x.parada_id === paradaId) : -1;
  const parada = carga && idx >= 0 ? carga.paradas[idx] : null;
  if (carga && !parada && !erro) notFound();

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-5 w-full min-w-0">
        <AssistenciaHeader title={parada ? `Parada ${idx + 1} de ${carga!.paradas.length}` : "Parada"} subtitle={carga ? carga.romaneio : undefined}>
          <Link href="/assistencia/motorista/odoo" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            ← Voltar
          </Link>
        </AssistenciaHeader>
        {erro ? <ErroOdoo titulo="Não dá para abrir esta parada" mensagem={erro} /> : null}
        {parada && carga && !erro ? (
          <>
            <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
              <div className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                {parada.cliente}
              </div>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {parada.endereco}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parada.pickings.map((pk) => (
                  <Chip key={pk.picking_id}>
                    {pk.nome}
                    {pk.pedido ? ` · ${pk.pedido}` : ""}
                  </Chip>
                ))}
              </div>
              {parada.resultado ? (
                <p className="text-sm font-bold" style={{ color: "var(--brand-green)" }}>
                  Já registrado: {RESULTADO_LABELS[parada.resultado]}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {parada.telefone ? (
                <a href={telHref(parada.telefone)} className="text-sm font-medium rounded-lg px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}>
                  📞 {parada.telefone}
                </a>
              ) : null}
              {parada.telefone ? (
                <a href={whatsappHref(parada.telefone)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium rounded-lg px-3 py-2.5" style={{ background: "color-mix(in srgb, #25d366 18%, transparent)", color: "#1da851" }}>
                  💬 WhatsApp
                </a>
              ) : null}
              {parada.endereco ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parada.endereco)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium rounded-lg px-3 py-2.5"
                  style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)", color: "var(--brand-green)" }}
                >
                  🗺️ Ver no mapa
                </a>
              ) : null}
            </div>
            {dono && !parada.resultado ? (
              carga.estado === "em_rota" ? (
                <ParadaOdooBaixa cargaId={carga.carga_id} paradaId={parada.parada_id} rotulo={parada.cliente} motivos={cat?.motivos ?? []} itens={parada.pickings.flatMap((pk) => pk.itens ?? [])} />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  A baixa abre depois de “Saí para a rota”.
                </p>
              )
            ) : null}
          </>
        ) : null}
      </div>
    </ToastProvider>
  );
}
