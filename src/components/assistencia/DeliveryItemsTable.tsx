"use client";

import { useEffect, useState } from "react";
import { addRequestItemByStaff, removeRequestItemByStaff, lookupTotvsProductForTeam } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { withRetry } from "@/lib/retryLookup";
import type { RequestItem, RequestType } from "@/lib/serviceRequests";

// Produtos de troca/entrega/envio de peça -- sem NADA do controle de
// pagamento de montador (valor unitário, "autorizado por gerente",
// liberar pagamento, "a montar") que RequestItemsTable carrega. Esse
// controle é especificamente sobre pagar montador por peça montada -- não
// existe equivalente pra motorista nesse sistema, então mostrar aquilo
// aqui era só confundir (pedido do Victor 17/08/2026, depois de ver "a
// montar"/"definir valor" numa troca de produto). Só produto, código e
// quantidade -- adicionar/remover pra quem gerencia o chamado.
// Tabela compacta -- Guia de Componentes Maia (Design System, 01/09/2026):
// "Código, Descrição do Produto, Quantidade... botão discreto". Substitui
// a lista de linhas soltas de antes por colunas de verdade.
function ItemRow({ item, requestId, canEditItems }: { item: RequestItem; requestId: string; canEditItems: boolean }) {
  const { pending, run } = useQuickAction();

  function remove() {
    if (!window.confirm(`Remover "${item.product}" desse chamado?`)) return;
    run(() => removeRequestItemByStaff(requestId, item.id), "Produto removido.");
  }

  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className="py-2 pr-3 text-xs font-mono text-gray-400 dark:text-gray-500 whitespace-nowrap">{item.partCode ?? "—"}</td>
      <td className="py-2 pr-3 text-sm text-gray-800 dark:text-gray-100">{item.product}</td>
      <td className="py-2 pr-3 text-sm text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">{item.quantity}</td>
      <td className="py-2 text-right whitespace-nowrap">
        {canEditItems ? (
          <button onClick={remove} disabled={pending} className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150 disabled:opacity-60">
            remover
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function AddItemForm({ requestId, isPickup }: { requestId: string; isPickup?: boolean }) {
  const { pending, run, showToast } = useQuickAction();
  const [product, setProduct] = useState("");
  const [partCode, setPartCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productLookupStatus, setProductLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  function runProductLookup(code: string) {
    if (!code.trim()) {
      setProductLookupStatus("idle");
      return;
    }
    setProductLookupStatus("loading");
    withRetry(() => lookupTotvsProductForTeam(code))
      .then((match) => {
        if (!match || !match.description) {
          setProductLookupStatus("not_found");
          return;
        }
        setProduct(match.description);
        setProductLookupStatus("found");
      })
      .catch(() => setProductLookupStatus("not_found"));
  }

  useEffect(() => {
    const timer = setTimeout(() => runProductLookup(partCode), 400);
    return () => clearTimeout(timer);
  }, [partCode]);

  function add() {
    if (!product.trim()) {
      showToast("Informe o produto.", "error");
      return;
    }
    run(async () => {
      await addRequestItemByStaff(requestId, {
        product,
        partCode: partCode || undefined,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        isPickup,
      });
      setProduct("");
      setPartCode("");
      setQuantity("1");
      setProductLookupStatus("idle");
    }, "Produto adicionado.");
  }

  return (
    <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex flex-col gap-0.5">
        <input
          value={partCode}
          onChange={(e) => setPartCode(e.target.value)}
          placeholder="Código (opcional)"
          className="rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 text-sm w-32 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
        />
        {productLookupStatus === "loading" ? (
          <span className="text-xs text-gray-400 dark:text-gray-500">Buscando…</span>
        ) : productLookupStatus === "found" ? (
          <span className="text-xs" style={{ color: "var(--status-good)" }}>
            Produto encontrado.
          </span>
        ) : productLookupStatus === "not_found" ? (
          <span className="text-xs flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            Código não encontrado.
            <button type="button" onClick={() => runProductLookup(partCode)} className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150">
              🔄 Tentar de novo
            </button>
          </span>
        ) : null}
      </div>
      <input
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        placeholder="Produto"
        className="rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 text-sm flex-1 min-w-[140px] text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        type="number"
        min={1}
        className="rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 text-sm w-16 text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
      />
      {/* Botão discreto -- Guia de Componentes Maia: outline neutro, não
          sólido (a única ação sólida da tela é "Editar e salvar
          alterações", no cabeçalho). */}
      <button
        onClick={add}
        disabled={pending}
        className="text-xs rounded-lg px-3 py-1.5 font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150 disabled:opacity-60"
      >
        + Adicionar produto
      </button>
    </div>
  );
}

export function DeliveryItemsTable({
  items,
  requestId,
  canEditItems,
  requestType,
}: {
  items: RequestItem[];
  requestId: string;
  canEditItems: boolean;
  // "Troca com recolhimento" (troca_produto) e "Envio de peça com
  // recolhimento de peça" (envio_recolhimento_peca, pedido do Victor
  // 02/09/2026) são os únicos tipos com recolhimento de verdade -- separa a
  // lista em "A entregar"/"A recolher" só pra esses dois, cada uma com seu
  // próprio formulário de adicionar (já marcando isPickup certo, sem
  // seletor visível pra não dar pra escolher errado). Pros outros tipos,
  // sem mudança nenhuma -- lista única, igual sempre foi.
  requestType: RequestType;
}) {
  if (items.length === 0 && !canEditItems) return null;

  const hasPickupSplit = requestType === "troca_produto" || requestType === "envio_recolhimento_peca";

  const thead = (
    <thead>
      <tr>
        {["Código", "Produto", "Qtd.", ""].map((h) => (
          <th key={h} className={`pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 ${h === "Qtd." || h === "" ? "text-right" : "text-left"}`}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );

  if (!hasPickupSplit) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Produtos</h3>
        <table className="w-full">
          {thead}
          <tbody>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} requestId={requestId} canEditItems={canEditItems} />
            ))}
          </tbody>
        </table>
        {canEditItems ? <AddItemForm requestId={requestId} /> : null}
      </div>
    );
  }

  const deliveryItems = items.filter((item) => !item.isPickup);
  const pickupItems = items.filter((item) => item.isPickup);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Produtos a entregar</h3>
        <table className="w-full">
          {thead}
          <tbody>
            {deliveryItems.map((item) => (
              <ItemRow key={item.id} item={item} requestId={requestId} canEditItems={canEditItems} />
            ))}
          </tbody>
        </table>
        {canEditItems ? <AddItemForm requestId={requestId} isPickup={false} /> : null}
      </div>
      <div className="flex flex-col gap-1 pt-3 border-t border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Produtos a recolher</h3>
        <table className="w-full">
          {thead}
          <tbody>
            {pickupItems.map((item) => (
              <ItemRow key={item.id} item={item} requestId={requestId} canEditItems={canEditItems} />
            ))}
          </tbody>
        </table>
        {canEditItems ? <AddItemForm requestId={requestId} isPickup /> : null}
      </div>
    </div>
  );
}
