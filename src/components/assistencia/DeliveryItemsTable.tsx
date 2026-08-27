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
function ItemRow({ item, requestId, canEditItems }: { item: RequestItem; requestId: string; canEditItems: boolean }) {
  const { pending, run } = useQuickAction();

  function remove() {
    if (!window.confirm(`Remover "${item.product}" desse chamado?`)) return;
    run(() => removeRequestItemByStaff(requestId, item.id), "Produto removido.");
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {item.quantity > 1 ? `${item.quantity}x ` : ""}
        {item.product}
        {item.partCode ? <span style={{ color: "var(--text-muted)" }}> · cód. {item.partCode}</span> : null}
      </span>
      {canEditItems ? (
        <button onClick={remove} disabled={pending} className="text-xs underline disabled:opacity-60" style={{ color: "var(--status-critical)" }}>
          remover
        </button>
      ) : null}
    </div>
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
    <div className="flex items-center gap-2 flex-wrap pt-2" style={{ borderTop: "1px solid var(--gridline)" }}>
      <div className="flex flex-col gap-0.5">
        <input
          value={partCode}
          onChange={(e) => setPartCode(e.target.value)}
          placeholder="Código (opcional)"
          className="rounded border px-2 py-1 text-sm w-32"
          style={{ borderColor: "var(--border)" }}
        />
        {productLookupStatus === "loading" ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Buscando…
          </span>
        ) : productLookupStatus === "found" ? (
          <span className="text-xs" style={{ color: "var(--status-good)" }}>
            Produto encontrado.
          </span>
        ) : productLookupStatus === "not_found" ? (
          <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            Código não encontrado.
            <button type="button" onClick={() => runProductLookup(partCode)} className="underline" style={{ color: "var(--text-secondary)" }}>
              🔄 Tentar de novo
            </button>
          </span>
        ) : null}
      </div>
      <input
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        placeholder="Produto"
        className="rounded border px-2 py-1 text-sm flex-1 min-w-[140px]"
        style={{ borderColor: "var(--border)" }}
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        type="number"
        min={1}
        className="rounded border px-2 py-1 text-sm w-16"
        style={{ borderColor: "var(--border)" }}
      />
      <button
        onClick={add}
        disabled={pending}
        className="text-xs rounded px-2 py-1.5 font-medium disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
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
  // "Troca com recolhimento" (troca_produto) é o único tipo com
  // recolhimento de verdade -- pedido do Victor 26/08/2026: separa a
  // lista em "A entregar"/"A recolher" só pra esse tipo, cada uma com seu
  // próprio formulário de adicionar (já marcando isPickup certo, sem
  // seletor visível pra não dar pra escolher errado). Pros outros tipos,
  // sem mudança nenhuma -- lista única, igual sempre foi.
  requestType: RequestType;
}) {
  if (items.length === 0 && !canEditItems) return null;

  if (requestType !== "troca_produto") {
    return (
      <div className="rounded-lg p-4 flex flex-col gap-1" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Produtos
        </span>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} requestId={requestId} canEditItems={canEditItems} />
        ))}
        {canEditItems ? <AddItemForm requestId={requestId} /> : null}
      </div>
    );
  }

  const deliveryItems = items.filter((item) => !item.isPickup);
  const pickupItems = items.filter((item) => item.isPickup);

  return (
    <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Produtos a entregar
        </span>
        {deliveryItems.map((item) => (
          <ItemRow key={item.id} item={item} requestId={requestId} canEditItems={canEditItems} />
        ))}
        {canEditItems ? <AddItemForm requestId={requestId} isPickup={false} /> : null}
      </div>
      <div className="flex flex-col gap-1 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Produtos a recolher
        </span>
        {pickupItems.map((item) => (
          <ItemRow key={item.id} item={item} requestId={requestId} canEditItems={canEditItems} />
        ))}
        {canEditItems ? <AddItemForm requestId={requestId} isPickup /> : null}
      </div>
    </div>
  );
}
