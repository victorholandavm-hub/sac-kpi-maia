import { getSupabaseAdmin } from "./supabaseAdmin";
import { cargaDoHistorico, notasDeEntregaDaCarga } from "./consultaCarga";

// Notas de entrega (5117) faturadas por outras pessoas -- Victor 29/10/2026:
// "todas as notas que qualquer outra pessoa faturar, que não seja Adonis ou
// John, preciso que apareça para o John". A 5117 sai quando a carga sai em
// rota; quem fez fica em odoo_carga_acoes ("sair": tela de Cargas, retirada
// no CD, "Nota de entrega" do SAC, motorista). Emissão feita direto no Odoo
// não passa por aqui (Victor: "pode tirar").

const DIAS = 7;
const MAX_CARGAS = 20;

const DONOS_DO_FATURAMENTO = /\b(adonis|jhon|john)\b/i;

export const quemFaturou = (operador: string) => operador.replace(/^(CD|Equipe) /, "");
export const ehOutraPessoa = (operador: string) => !DONOS_DO_FATURAMENTO.test(quemFaturou(operador));

export type NotaDeOutro = { pedido: string; cliente: string | null; nf: string | null };
export type FaturamentoDeOutro = {
  acaoId: number;
  cargaId: number;
  romaneio: string | null;
  quem: string;
  em: string;
  notas: NotaDeOutro[];
  ciente: { por: string; em: string } | null;
};

export async function faturamentosDeOutros(): Promise<FaturamentoDeOutro[]> {
  const admin = getSupabaseAdmin();
  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("odoo_carga_acoes")
    .select("id, carga_id, romaneio, operador, em")
    .eq("acao", "sair")
    .gte("em", desde)
    .order("em", { ascending: false })
    .limit(500)
    .returns<{ id: number; carga_id: number; romaneio: string | null; operador: string; em: string }[]>();
  const saidas = (data ?? []).filter((s) => ehOutraPessoa(s.operador)).slice(0, MAX_CARGAS);
  if (saidas.length === 0) return [];

  const { data: cientes } = await admin
    .from("notas_de_outros_ciente")
    .select("acao_id, ciente_por, ciente_em")
    .in("acao_id", saidas.map((s) => s.id))
    .returns<{ acao_id: number; ciente_por: string; ciente_em: string }[]>();
  const cientePor = new Map((cientes ?? []).map((c) => [c.acao_id, { por: c.ciente_por, em: c.ciente_em }]));

  const out: FaturamentoDeOutro[] = [];
  for (let i = 0; i < saidas.length; i += 2) {
    out.push(
      ...(await Promise.all(
        saidas.slice(i, i + 2).map(async (s) => {
          const [carga, nfs] = await Promise.all([
            cargaDoHistorico({ cargaId: s.carga_id }).catch(() => null),
            notasDeEntregaDaCarga(s.carga_id).catch(() => new Map<string, { nf: string | null }>()),
          ]);
          const notas = (carga?.paradas ?? []).flatMap((p) =>
            (p.pickings ?? []).filter((k) => k.pedido).map((k) => ({ pedido: k.pedido, cliente: p.cliente || null, nf: nfs.get(k.pedido)?.nf ?? null }))
          );
          const unicas = [...new Map(notas.map((n) => [n.pedido, n])).values()];
          return { acaoId: s.id, cargaId: s.carga_id, romaneio: s.romaneio ?? carga?.romaneio ?? null, quem: quemFaturou(s.operador), em: s.em, notas: unicas, ciente: cientePor.get(s.id) ?? null };
        })
      ))
    );
  }
  return out;
}
