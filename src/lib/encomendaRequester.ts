import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getCdSession } from "@/app/assistencia/cd-actions";
import { getFabricaSession } from "@/app/assistencia/fabrica-actions";
import { getCaixaStoreId } from "./caixas";
import { getGerenteStoreIds } from "./gerentes";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getSupabaseServer } from "./supabaseServer";

export type EncomendaRequester =
  | { kind: "caixa"; storeId: string; name: string }
  | { kind: "gerente"; storeIds: string[]; name: string }
  | { kind: "cd"; name: string }
  | { kind: "fabrica"; name: string; fabricaId: string | null }
  | { kind: "sac"; name: string };

// Quem pode lançar/ver encomenda de uma loja: caixa (PIN por pessoa, 1 loja),
// gerente (login que ele já usa em /assistencia/loja, cookie com path
// /assistencia então já chega aqui sem logar de novo), CD/fábrica (que não
// têm loja fixa — escolhem a loja na hora de lançar o pedido, ver
// createPedidoEncomendaAction), ou SAC (sessão Supabase Auth de verdade,
// mesmo login por PIN de src/app/assistencia/actions.ts -- também sem loja
// fixa, escolhe na hora igual CD/fábrica). Vendedor não tem acesso nenhum a
// esse sistema — só é citado como texto livre no campo "Vendedor
// responsável" pelo requester real. Tenta cada sessão em sequência, mesmo
// padrão de requireEncomendaActor (src/lib/encomendaAuth.ts) só que pro lado
// de quem solicita, não de quem processa.
//
// Gerente vem antes de caixa: os cookies têm paths diferentes (gerente em
// /assistencia, caixa só em /assistencia/encomendas) e podem coexistir no
// mesmo navegador -- por exemplo, se essa pessoa também testou/usou o login
// de caixa antes. Nesse caso a identidade de gerente (mais ampla) deve
// prevalecer, senão a loja errada (a do caixa antigo) aparece pro gerente.
export async function resolveEncomendaRequester(): Promise<EncomendaRequester | null> {
  const gerenteName = await getLojaGerenteSession();
  if (gerenteName) {
    const storeIds = await getGerenteStoreIds(gerenteName);
    if (storeIds.length > 0) return { kind: "gerente", storeIds, name: gerenteName };
  }

  const caixaName = await getCaixaSession();
  if (caixaName) {
    const storeId = await getCaixaStoreId(caixaName);
    if (storeId) return { kind: "caixa", storeId, name: caixaName };
  }

  const cdName = await getCdSession();
  if (cdName) return { kind: "cd", name: cdName };

  const fabricaName = await getFabricaSession();
  if (fabricaName) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("fabrica_operadores").select("fabrica_id").eq("name", fabricaName).maybeSingle();
    return { kind: "fabrica", name: fabricaName, fabricaId: data?.fabrica_id ?? null };
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
    if (data && data.role === "sac") {
      return { kind: "sac", name: data.full_name };
    }
  }

  return null;
}

// Solicitante só edita o próprio pedido, e só enquanto ninguém do outro
// lado (fábrica/CD) tiver feito nada ainda -- depois que sai de
// "solicitado" a correção passa a ser assunto de quem está processando, não
// mais de quem pediu. Caixa/gerente têm acesso por loja (igual já enxergam
// juntos os pedidos da própria loja); CD/fábrica/SAC não têm loja fixa, só
// editam o que o próprio nome lançou (mesmo escopo que já usam pra
// acompanhar, ver encomendas/sac/page.tsx).
export function canEditPedido(
  requester: EncomendaRequester,
  pedido: { status: string; storeId: string; requestedByName: string }
): boolean {
  if (pedido.status !== "solicitado") return false;
  if (requester.kind === "gerente") return requester.storeIds.includes(pedido.storeId);
  if (requester.kind === "caixa") return requester.storeId === pedido.storeId;
  return requester.name === pedido.requestedByName;
}
