import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest, isPlaceholderPhone, firstPhone } from "./serviceRequests";
import { upsertGhlContact, addContactTag, findGhlConversationId, fetchGhlMessages, type GhlConta } from "./ghlClient";
import { SUBCONTAS } from "./ghlSubcontas";
import { NPS_GHL_TAG, NPS_1_5_PATTERN } from "./npsDetratores";
import type { ResultadoEnvioNps } from "./npsEnvio";
import { clientePeloTelefone, encaminharPelaNota } from "./npsEncaminhar";

// NPS de atendimento em loja das vendas do Odoo -- Victor 27/10/2026. O de
// sempre (vendaNps.ts) parte de totvs_orders e parou na virada (25/10). Até a
// ponte listar as vendas do dia, a fonte é a expedição do Odoo
// (odoo_expedicao, legado = false): telefone, loja e vendedor vêm de lá; a
// data da venda é quando o pedido apareceu na expedição (leitura a cada 30
// min). Venda levada na hora no balcão não passa pela expedição e fica de fora.
// Mesma conta/tag do vendaNps.ts; uma pesquisa por telefone a cada 7 dias.

const JANELA_DIAS = 3;
const MAX_POR_RODADA = 150;
const UM_POR_TELEFONE_DIAS = 7;
const RESPOSTA_JANELA_DIAS = 7;
const RESPOSTA_MAX_POR_RODADA = 200;
const TAG_LOJAS_MAIA = "nps-pos-atendimento-loja";

function contaLojasMaia(): GhlConta {
  return { token: process.env[SUBCONTAS.lojas_maia.tokenEnv], locationId: SUBCONTAS.lojas_maia.locationId };
}

function disparo(): { conta?: GhlConta; tag: string } {
  return process.env.VENDA_NPS_SUBCONTA === "lojas_maia" ? { conta: contaLojasMaia(), tag: TAG_LOJAS_MAIA } : { tag: NPS_GHL_TAG.venda! };
}

// O Odoo grava o vendedor como "L17 · Joao Paulo" (código do vendedor no
// Odoo + nome); o Protheus só o nome. Separa pros dois casarem no ranking.
export function separarVendedorOdoo(v: string | null | undefined): { codigo: string | null; nome: string | null } {
  const t = (v ?? "").trim();
  if (!t) return { codigo: null, nome: null };
  const m = t.match(/^([A-Za-z]\d+)\s*[·•\-–]\s*(.+)$/);
  return m ? { codigo: m[1].toUpperCase(), nome: m[2].trim() } : { codigo: null, nome: t };
}

type Linha = { pedido: string; cliente: string | null; telefone: string | null; empresa: string | null; vendedor: string | null; primeiro_visto: string };

export type CandidatoOdoo = { pedido: string; cliente: string | null; telefone: string; loja: string | null; vendedor: string | null; dataVenda: string };

const diaRecife = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date(iso));
const soDigitos = (t: string) => t.replace(/\D/g, "");

// Um candidato por pedido (o pedido pode ter mais de uma saída), com o primeiro
// telefone válido; fora teste, mostruário e telefone falso.
export function candidatosDasLinhas(linhas: Linha[]): CandidatoOdoo[] {
  const porPedido = new Map<string, Linha[]>();
  for (const l of linhas) porPedido.set(l.pedido, [...(porPedido.get(l.pedido) ?? []), l]);
  const out: CandidatoOdoo[] = [];
  for (const [pedido, ls] of porPedido) {
    const cliente = ls.find((l) => l.cliente)?.cliente ?? null;
    if (/teste/i.test(cliente ?? "") || isMostruarioRequest(null, cliente)) continue;
    const tel = ls.map((l) => l.telefone).find((t) => t && !isPlaceholderPhone(t));
    if (!tel) continue;
    const primeiro = ls.map((l) => l.primeiro_visto).sort()[0];
    out.push({
      pedido,
      cliente,
      telefone: firstPhone(tel),
      loja: ls.find((l) => l.empresa)?.empresa?.match(/^\d{3}/)?.[0] ?? null,
      vendedor: ls.find((l) => l.vendedor)?.vendedor ?? null,
      dataVenda: diaRecife(primeiro),
    });
  }
  // A mais nova primeiro (a promessa é "logo depois da venda").
  return out.sort((a, b) => b.dataVenda.localeCompare(a.dataVenda) || b.pedido.localeCompare(a.pedido));
}

export async function enrollPendingVendaNpsOdoo(): Promise<ResultadoEnvioNps> {
  const admin = getSupabaseAdmin();
  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("odoo_expedicao")
    .select("pedido, cliente, telefone, empresa, vendedor, primeiro_visto")
    .eq("legado", false)
    .gte("primeiro_visto", desde)
    .returns<Linha[]>();
  if (error) return { enrolled: 0, semTelefone: 0, errors: [`venda-nps-odoo pedidos: ${error.message}`], avisos: [] };
  const todos = new Set((data ?? []).map((l) => l.pedido));
  const candidatos = candidatosDasLinhas(data ?? []);
  const semTelefone = todos.size - candidatos.length;
  if (candidatos.length === 0) return { enrolled: 0, semTelefone, errors: [], avisos: [] };

  const { data: enviados, error: enviadosError } = await admin
    .from("venda_nps_odoo")
    .select("pedido, telefone, enviado_em")
    .or(`pedido.in.(${candidatos.map((c) => `"${c.pedido}"`).join(",")}),enviado_em.gte.${new Date(Date.now() - UM_POR_TELEFONE_DIAS * 24 * 60 * 60 * 1000).toISOString()}`)
    .returns<{ pedido: string; telefone: string | null; enviado_em: string }[]>();
  if (enviadosError) return { enrolled: 0, semTelefone, errors: [`venda-nps-odoo já enviados: ${enviadosError.message}`], avisos: [] };
  const pedidosFeitos = new Set((enviados ?? []).map((e) => e.pedido));
  const telefonesRecentes = new Set((enviados ?? []).map((e) => soDigitos(e.telefone ?? "")).filter(Boolean));

  const { conta, tag } = disparo();
  const errors: string[] = [];
  const avisos: string[] = [];
  let enrolled = 0;
  for (const c of candidatos) {
    if (enrolled >= MAX_POR_RODADA) break;
    if (pedidosFeitos.has(c.pedido) || telefonesRecentes.has(soDigitos(c.telefone))) continue;
    const contactId = await upsertGhlContact(c.telefone, c.cliente, conta);
    if (!contactId) {
      avisos.push(`venda-nps-odoo ${c.pedido}: não achou/criou contato no GHL`);
      continue;
    }
    // Reserva antes da tag (mesmo motivo do npsEnvio.ts: duas rodadas juntas).
    const { data: reservada, error: reservaError } = await admin
      .from("venda_nps_odoo")
      .upsert(
        { pedido: c.pedido, cliente: c.cliente, telefone: c.telefone, loja: c.loja, vendedor: c.vendedor, data_venda: c.dataVenda, ghl_contact_id: contactId, ghl_location_id: conta?.locationId ?? null },
        { onConflict: "pedido", ignoreDuplicates: true }
      )
      .select("pedido");
    if (reservaError) {
      errors.push(`venda-nps-odoo ${c.pedido}: ${reservaError.message}`);
      continue;
    }
    if (!reservada || reservada.length === 0) continue;
    if (!(await addContactTag(contactId, tag, conta))) {
      avisos.push(`venda-nps-odoo ${c.pedido}: falha ao aplicar a tag no GHL`);
      await admin.from("venda_nps_odoo").delete().eq("pedido", c.pedido);
      continue;
    }
    telefonesRecentes.add(soDigitos(c.telefone));
    enrolled++;
  }
  return { enrolled, semTelefone, errors, avisos };
}

// Respostas: mesma leitura do vendaNps.ts (1 a 5 depois do envio, na subconta
// em que saiu), só que por pedido do Odoo.
export async function detectPendingVendaNpsOdooResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pendentes } = await admin
    .from("venda_nps_odoo")
    .select("pedido, telefone, loja, ghl_contact_id, enviado_em, ghl_location_id")
    .is("respondido_em", null)
    .gte("enviado_em", new Date(Date.now() - RESPOSTA_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString())
    .order("enviado_em", { ascending: false })
    .limit(RESPOSTA_MAX_POR_RODADA);
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
    await admin.from("venda_nps_odoo").update({ score, respondido_em: resposta.dateAdded }).eq("pedido", row.pedido);
    await encaminharPelaNota(admin, {
      score,
      ghlContactId: row.ghl_contact_id,
      conta,
      avaliacao: { origem: "venda", origemId: `odoo:${row.pedido}`, clientId: clientePeloTelefone(row.telefone), storeId: row.loja },
    });
    respondidas++;
  }
  return respondidas;
}
