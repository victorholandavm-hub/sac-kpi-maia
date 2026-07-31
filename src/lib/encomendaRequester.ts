import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getCdSession } from "@/app/assistencia/cd-actions";
import { getFabricaSession } from "@/app/assistencia/fabrica-actions";
import { getCaixaStoreId } from "./caixas";
import { getGerenteStoreIds } from "./gerentes";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type EncomendaRequester =
  | { kind: "caixa"; storeId: string; name: string }
  | { kind: "gerente"; storeIds: string[]; name: string }
  | { kind: "cd"; name: string }
  | { kind: "fabrica"; name: string; fabricaId: string | null };

// Quem pode lançar/ver encomenda de uma loja: caixa (PIN por pessoa, 1 loja),
// gerente (login que ele já usa em /assistencia/loja, cookie com path
// /assistencia então já chega aqui sem logar de novo), ou CD/fábrica (que não
// têm loja fixa — escolhem a loja na hora de lançar o pedido, ver
// createPedidoEncomendaAction). Vendedor não tem acesso nenhum a esse
// sistema — só é citado como texto livre no campo "Vendedor responsável"
// pelo requester real. Tenta cada sessão em sequência, mesmo padrão de
// requireEncomendaActor (src/lib/encomendaAuth.ts) só que pro lado de quem
// solicita, não de quem processa.
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

  return null;
}
