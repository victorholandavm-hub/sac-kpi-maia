import { ConsultaPedidoView } from "@/components/ConsultaPedidoView";

// Consulta de pedido e de carga (com as fotos da baixa) pro login do CD --
// Victor 27/10/2026: o Jhon não tinha onde ver as fotos das entregas. Mesma
// tela do SAC (ConsultaPedidoView); o acesso é o do layout da Logística.
export const dynamic = "force-dynamic";

export default async function LogisticaConsultaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <ConsultaPedidoView busca={(q ?? "").trim()} acao="/assistencia/logistica/consulta" embutida />;
}
