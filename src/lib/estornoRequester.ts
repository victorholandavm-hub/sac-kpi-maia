import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getCaixaStoreId } from "./caixas";
import { getGerenteStoreIds } from "./gerentes";

// Quem pode solicitar estorno: caixa (PIN por pessoa, 1 loja fixa) ou
// gerente (login que ele já usa em /assistencia/loja, pode ter mais de uma
// loja). Mesmo espírito de resolveEncomendaRequester (encomendaRequester.ts),
// reduzido só a esses 2 papéis -- CD/fábrica/SAC não têm acesso a estorno.
export type EstornoRequester = { kind: "caixa"; storeId: string; name: string } | { kind: "gerente"; storeIds: string[]; name: string };

// Gerente vem antes de caixa -- mesmo motivo de resolveEncomendaRequester:
// os cookies têm paths diferentes e podem coexistir no mesmo navegador, e a
// identidade de gerente (mais ampla) deve prevalecer.
export async function resolveEstornoRequester(): Promise<EstornoRequester | null> {
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

  return null;
}
