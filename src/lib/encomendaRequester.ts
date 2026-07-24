import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { getVendedorSession } from "@/app/assistencia/vendedor-actions";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getCaixaStoreId } from "./caixas";
import { getVendedorStoreId } from "./vendedores";
import { getGerenteStoreIds } from "./gerentes";

export type EncomendaRequester =
  | { kind: "caixa"; storeId: string; name: string }
  | { kind: "vendedor"; storeId: string; name: string }
  | { kind: "gerente"; storeIds: string[]; name: string };

// Quem pode lançar/ver encomenda de uma loja: caixa (PIN por pessoa, 1 loja),
// vendedor (idem) ou gerente (login que ele já usa em /assistencia/loja,
// cookie com path /assistencia então já chega aqui sem logar de novo). Tenta
// cada sessão em sequência, mesmo padrão de requireEncomendaActor
// (src/lib/encomendaAuth.ts) só que pro lado de quem solicita, não de quem
// processa (CD/fábrica/admin/assistência).
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

  return null;
}
