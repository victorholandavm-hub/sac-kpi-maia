import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest, isPlaceholderPhone, firstPhone } from "./serviceRequests";
import { upsertGhlContact, addContactTag, findGhlConversationId, fetchGhlMessages, sendGhlMessage, type GhlConta } from "./ghlClient";
import { SUBCONTAS } from "./ghlSubcontas";
import { NPS_GHL_TAG, NPS_1_5_PATTERN } from "./npsDetratores";
import { clientePeloTelefone, ehPedidoDeTroca, encaminharPelaNota } from "./npsEncaminhar";
import type { ResultadoEnvioNps } from "./npsEnvio";

// Pós-entrega e pós 20 dias das entregas do Odoo -- Victor 27/10/2026. Os de
// sempre (entregaNps.ts / nps2Meses.ts) só veem as entregas do Protheus. Aqui a
// fonte são as baixas "entregue" das cargas do Odoo (odoo_expedicao, leitura a
// cada 30 min; o dia da entrega é o fim da rota da carga). Mesmas contas, tags
// e prazos dos de sempre:
// - entrega: dia seguinte à entrega, pela conta do SAC; agradece e, nota 4-5,
//   pede avaliação no Google (igual entregaNps.ts);
// - compra (pós 20 dias): 20 dias depois (janela de 7), pela Lojas Maia quando
//   COMPRA_NPS_SUBCONTA=lojas_maia; uma por telefone a cada 90 dias.
// Tabela nps_entrega_odoo (0214), uma linha por fase e pedido.

export type FaseOdoo = "entrega" | "compra";

const REGRAS: Record<FaseOdoo, { diasDepois: number; janela: number; umPorTelefoneDias: number }> = {
  entrega: { diasDepois: 1, janela: 1, umPorTelefoneDias: 7 },
  compra: { diasDepois: 20, janela: 7, umPorTelefoneDias: 90 },
};
const MAX_POR_RODADA = 150;
const RESPOSTA_JANELA_DIAS = 7;
const TAG_LOJAS_MAIA_COMPRA = "nps-pós-20dias";

function contaLojasMaia(): GhlConta {
  return { token: process.env[SUBCONTAS.lojas_maia.tokenEnv], locationId: SUBCONTAS.lojas_maia.locationId };
}

function disparo(fase: FaseOdoo): { conta?: GhlConta; tag: string } {
  if (fase === "compra" && process.env.COMPRA_NPS_SUBCONTA === "lojas_maia") return { conta: contaLojasMaia(), tag: TAG_LOJAS_MAIA_COMPRA };
  return { tag: fase === "compra" ? NPS_GHL_TAG.compra! : NPS_GHL_TAG.entrega! };
}

const diaRecife = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(d);
const diasAtras = (n: number) => diaRecife(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
const soDigitos = (t: string) => t.replace(/\D/g, "");

type Linha = { pedido: string; cliente: string | null; telefone: string | null; empresa: string | null; carga_fim_em: string | null; carga_saiu_em: string | null; carga_id?: number | null; ultima_carga_id?: number | null; obs?: string | null };

// Victor 29/10/2026: entrega faturada pelo SAC ou pela assistência ("Nota de
// entrega", retirada com a equipe) não dispara template nenhum -- só o NPS de
// assistência técnica, quando o motorista dá baixa no chamado. Quem faturou
// fica no "sair" de odoo_carga_acoes ("SAC Fulano" / "Equipe Fulano").
export const faturouPeloSacOuAssistencia = (operador: string) => /^(SAC|Equipe) /.test(operador);

export function pedidosFaturadosPeloSac(linhas: Linha[], cargasDoSac: Set<number>): Set<string> {
  return new Set(linhas.filter((l) => [l.carga_id, l.ultima_carga_id].some((c) => c && cargasDoSac.has(c))).map((l) => l.pedido));
}
export type CandidatoEntregaOdoo = { pedido: string; cliente: string | null; telefone: string; loja: string | null; entregueEm: string };

// Um por pedido, com o dia da entrega (fim da rota; sem ele, a saída) dentro
// da janela [de, ate]; fora teste, mostruário e telefone falso.
export function candidatosEntregues(linhas: Linha[], de: string, ate: string): CandidatoEntregaOdoo[] {
  const porPedido = new Map<string, Linha[]>();
  for (const l of linhas) porPedido.set(l.pedido, [...(porPedido.get(l.pedido) ?? []), l]);
  const out: CandidatoEntregaOdoo[] = [];
  for (const [pedido, ls] of porPedido) {
    const cliente = ls.find((l) => l.cliente)?.cliente ?? null;
    if (/teste/i.test(cliente ?? "") || isMostruarioRequest(null, cliente)) continue;
    if (ls.some((l) => ehPedidoDeTroca(l.obs))) continue;
    const tel = ls.map((l) => l.telefone).find((t) => t && !isPlaceholderPhone(t));
    const quando = ls.map((l) => l.carga_fim_em ?? l.carga_saiu_em).filter((x): x is string => !!x).sort().at(-1);
    if (!tel || !quando) continue;
    const entregueEm = diaRecife(new Date(quando));
    if (entregueEm < de || entregueEm > ate) continue;
    out.push({ pedido, cliente, telefone: firstPhone(tel), loja: ls.find((l) => l.empresa)?.empresa?.match(/^\d{3}/)?.[0] ?? null, entregueEm });
  }
  return out.sort((a, b) => b.entregueEm.localeCompare(a.entregueEm) || b.pedido.localeCompare(a.pedido));
}

export async function enrollNpsEntregaOdoo(fase: FaseOdoo): Promise<ResultadoEnvioNps> {
  const admin = getSupabaseAdmin();
  const r = REGRAS[fase];
  const de = diasAtras(r.diasDepois + r.janela);
  const ate = diasAtras(r.diasDepois);
  const rotulo = `${fase}-nps-odoo`;
  const { data, error } = await admin
    .from("odoo_expedicao")
    .select("pedido, cliente, telefone, empresa, carga_fim_em, carga_saiu_em, carga_id, ultima_carga_id, obs")
    .in("resultado", ["entregue", "entrega_parcial"])
    .gte("carga_saiu_em", new Date(Date.now() - (r.diasDepois + r.janela + 3) * 24 * 60 * 60 * 1000).toISOString())
    .returns<Linha[]>();
  if (error) return { enrolled: 0, semTelefone: 0, errors: [`${rotulo} pedidos: ${error.message}`], avisos: [] };
  const todosCandidatos = candidatosEntregues(data ?? [], de, ate);
  if (todosCandidatos.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };
  const cargas = [...new Set((data ?? []).flatMap((l) => [l.carga_id, l.ultima_carga_id]).filter((c): c is number => !!c))];
  const { data: saidas, error: saidasError } = cargas.length
    ? await admin.from("odoo_carga_acoes").select("carga_id, operador").eq("acao", "sair").in("carga_id", cargas).returns<{ carga_id: number; operador: string }[]>()
    : { data: [], error: null };
  // Sem saber quem faturou, não manda (melhor perder uma pesquisa que mandar a errada).
  if (saidasError) return { enrolled: 0, semTelefone: 0, errors: [`${rotulo} quem faturou: ${saidasError.message}`], avisos: [] };
  const doSac = pedidosFaturadosPeloSac(data ?? [], new Set((saidas ?? []).filter((s) => faturouPeloSacOuAssistencia(s.operador)).map((s) => s.carga_id)));
  const candidatos = todosCandidatos.filter((c) => !doSac.has(c.pedido));
  if (candidatos.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  const desdeTel = new Date(Date.now() - r.umPorTelefoneDias * 24 * 60 * 60 * 1000).toISOString();
  const { data: enviados, error: enviadosError } = await admin
    .from("nps_entrega_odoo")
    .select("pedido, telefone")
    .eq("fase", fase)
    .or(`pedido.in.(${candidatos.map((c) => `"${c.pedido}"`).join(",")}),enviado_em.gte.${desdeTel}`)
    .returns<{ pedido: string; telefone: string | null }[]>();
  if (enviadosError) return { enrolled: 0, semTelefone: 0, errors: [`${rotulo} já enviados: ${enviadosError.message}`], avisos: [] };
  const feitos = new Set((enviados ?? []).map((e) => e.pedido));
  const telefones = new Set((enviados ?? []).map((e) => soDigitos(e.telefone ?? "")).filter(Boolean));

  const { conta, tag } = disparo(fase);
  const errors: string[] = [];
  const avisos: string[] = [];
  let enrolled = 0;
  for (const c of candidatos) {
    if (enrolled >= MAX_POR_RODADA) break;
    if (feitos.has(c.pedido) || telefones.has(soDigitos(c.telefone))) continue;
    const contactId = await upsertGhlContact(c.telefone, c.cliente, conta);
    if (!contactId) {
      avisos.push(`${rotulo} ${c.pedido}: não achou/criou contato no GHL`);
      continue;
    }
    const { data: reservada, error: reservaError } = await admin
      .from("nps_entrega_odoo")
      .upsert(
        { fase, pedido: c.pedido, cliente: c.cliente, telefone: c.telefone, loja: c.loja, entregue_em: c.entregueEm, ghl_contact_id: contactId, ghl_location_id: conta?.locationId ?? null },
        { onConflict: "fase,pedido", ignoreDuplicates: true }
      )
      .select("pedido");
    if (reservaError) {
      errors.push(`${rotulo} ${c.pedido}: ${reservaError.message}`);
      continue;
    }
    if (!reservada || reservada.length === 0) continue;
    if (!(await addContactTag(contactId, tag, conta))) {
      avisos.push(`${rotulo} ${c.pedido}: falha ao aplicar a tag no GHL`);
      await admin.from("nps_entrega_odoo").delete().eq("fase", fase).eq("pedido", c.pedido);
      continue;
    }
    telefones.add(soDigitos(c.telefone));
    enrolled++;
  }
  return { enrolled, semTelefone: 0, errors, avisos };
}

// Respostas: nota 1-5 depois do envio, na conta em que saiu. Pós-entrega:
// agradece e pede avaliação no Google (nota 4-5), igual entregaNps.ts;
// pós 20 dias: a resposta automática de sempre.
export async function detectNpsEntregaOdooResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pendentes } = await admin
    .from("nps_entrega_odoo")
    .select("fase, pedido, telefone, loja, ghl_contact_id, enviado_em, ghl_location_id")
    .is("respondido_em", null)
    .is("descartada_em", null)
    .gte("enviado_em", new Date(Date.now() - RESPOSTA_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString())
    .order("enviado_em", { ascending: false })
    .limit(200);
  let respondidas = 0;
  for (const row of pendentes ?? []) {
    const conta = row.ghl_location_id === SUBCONTAS.lojas_maia.locationId ? contaLojasMaia() : undefined;
    const conversa = await findGhlConversationId(row.ghl_contact_id, conta);
    if (!conversa) continue;
    const msgs = await fetchGhlMessages(conversa, conta?.token);
    if (!msgs) continue;
    const enviadoMs = new Date(row.enviado_em).getTime();
    const resposta = msgs.find((m) => m.direction === "inbound" && new Date(m.dateAdded).getTime() > enviadoMs && NPS_1_5_PATTERN.test((m.body ?? "").trim()));
    if (!resposta) continue;
    const score = Number(NPS_1_5_PATTERN.exec(resposta.body!.trim())![1]);
    await admin.from("nps_entrega_odoo").update({ score, respondido_em: resposta.dateAdded }).eq("fase", row.fase).eq("pedido", row.pedido);
    respondidas++;
    const avaliacao = { origem: row.fase === "compra" ? ("compra" as const) : ("entrega" as const), origemId: `odoo:${row.pedido}`, clientId: clientePeloTelefone(row.telefone), storeId: row.loja };
    if (row.fase === "compra") {
      await encaminharPelaNota(admin, { score, ghlContactId: row.ghl_contact_id, conta, avaliacao });
      continue;
    }
    try {
      await sendGhlMessage(row.ghl_contact_id, "Muito obrigado! 🙏 Se tiver alguma sugestão pra melhorarmos, pode escrever aqui 👇");
    } catch {
      // sem a mensagem de agradecimento a nota já está gravada
    }
    await encaminharPelaNota(admin, { score, ghlContactId: row.ghl_contact_id, conta, avaliacao });
  }
  return respondidas;
}
