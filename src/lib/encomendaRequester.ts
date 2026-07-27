import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { getVendedorSession } from "@/app/assistencia/vendedor-actions";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getCdSession } from "@/app/assistencia/cd-actions";
import { getFabricaSession } from "@/app/assistencia/fabrica-actions";
import { getCaixaStoreId } from "./caixas";
import { getVendedorStoreId } from "./vendedores";
import { getGerenteStoreIds } from "./gerentes";

export type EncomendaRequester =
  | { kind: "caixa"; storeId: string; name: string }
  | { kind: "vendedor"; storeId: string; name: string }
  | { kind: "gerente"; storeIds: string[]; name: string }
  | { kind: "cd"; name: string }
  | { kind: "fabrica"; name: string };

// Quem pode lançar/ver encomenda de uma loja: caixa (PIN por pessoa, 1 loja),
// vendedor (idem), gerente (login que ele já usa em /assistencia/loja,
// cookie com path /assistencia então já chega aqui sem logar de novo), ou
// CD/fábrica (que não têm loja fixa — escolhem a loja na hora de lançar o
// pedido, ver createPedidoEncomendaAction). Tenta cada sessão em sequência,
// mesmo padrão de requireEncomendaActor (src/lib/encomendaAuth.ts) só que pro
// lado de quem solicita, não de quem processa.
export async function resolveEncomendaRequester(): Promise<EncomendaRequester | null> {
  const caixaName = await getCaixaSession();
  if (caixaName) {
    const storeId = await getCaixaStoreId(caixaName);
    if (storeId) return { kind: "caixa", storeId, name: caixaName };
  }

  const vendedorName = await getVendedorSession();
  if (vendedorName) {
    const storeId = await getVendedorStoreId(vendedorName);
    if (storeId) return { kind: "vendedor", storeId, name: vendedorName };
  }

  const gerenteName = await getLojaGerenteSession();
  if (gerenteName) {
    const storeIds = await getGerenteStoreIds(gerenteName);
    if (storeIds.length > 0) return { kind: "gerente", storeIds, name: gerenteName };
  }

  const cdName = await getCdSession();
  if (cdName) return { kind: "cd", name: cdName };

  const fabricaName = await getFabricaSession();
  if (fabricaName) return { kind: "fabrica", name: fabricaName };

  return null;
}
