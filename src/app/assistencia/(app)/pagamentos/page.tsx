import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listPaymentItems, listAssemblers, paymentStage, type PaymentItem } from "@/lib/payments";
import { PAYMENTS_CONTROLLER_NAME } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { PaymentsExportButton } from "@/components/assistencia/PaymentsExportButton";
import { PaymentItemEditor } from "@/components/assistencia/PaymentItemEditor";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function groupByAssembler(items: PaymentItem[]) {
  const groups: { assemblerName: string; items: PaymentItem[] }[] = [];
  for (const item of items) {
    const name = item.assemblerName ?? "Sem montador definido";
    let group = groups.find((g) => g.assemblerName === name);
    if (!group) {
      group = { assemblerName: name, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups.sort((a, b) => a.assemblerName.localeCompare(b.assemblerName));
}

// Sub-agrupamento por loja dentro de um montador -- só faz diferença
// visualmente quando um montador específico é escolhido (o Antonio pediu
// pra dividir por loja, mesmo que ainda fique tudo na mesma tela, sem sair
// clicando solicitação por solicitação).
function groupByStore(items: PaymentItem[]) {
  const groups: { storeName: string; items: PaymentItem[] }[] = [];
  for (const item of items) {
    const name = item.storeName || "Sem loja";
    let group = groups.find((g) => g.storeName === name);
    if (!group) {
      group = { storeName: name, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups.sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ pendentes?: string; assembler?: string }>;
}) {
  const profile = await getProfile();
  redirectIfSac(profile);
  // Mesma checagem de requirePaymentsController (pagamentos-actions.ts) --
  // controla tanto o botão de exportar quanto a edição inline de valor/
  // aprovação/autorização aqui na tela.
  const canExport = profile.fullName === PAYMENTS_CONTROLLER_NAME;
  const { pendentes, assembler } = await searchParams;
  // Sempre inclui item sem valor -- antes só entrava com um montador
  // escolhido, e isso escondia o próprio caso que "Só pendentes de
  // liberação" deveria mostrar primeiro: montagem concluída que o Antonio
  // ainda nem começou a precificar (ver includeNoValue em payments.ts e
  // paymentStage abaixo, que já classifica concluída+sem valor como
  // "pendente" -- só faltava a consulta trazer essas linhas).
  const [rawItems, assemblers] = await Promise.all([
    listPaymentItems({ assemblerName: assembler, includeNoValue: true }),
    listAssemblers(),
  ]);
  // Esconde "ainda em andamento e sem valor" -- isso não é acionável (a
  // montagem nem terminou) e seria só ruído. O que precisa de atenção do
  // Antonio é quem já tem valor (qualquer status) ou quem já concluiu mas
  // ainda não tem valor -- essa segunda parte é justamente o que estava
  // faltando aparecer.
  const allItems = rawItems.filter((i) => i.unitValue !== null || i.requestStatus === "concluida");
  const items = pendentes ? allItems.filter((i) => paymentStage(i.requestStatus, i.paymentReleased) === "pendente") : allItems;
  const groups = groupByAssembler(items);
  const grandTotal = items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);
  const pendingTotal = items
    .filter((i) => paymentStage(i.requestStatus, i.paymentReleased) === "pendente")
    .reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={assembler ? `/assistencia/pagamentos?assembler=${assembler}` : "/assistencia/pagamentos"}
            className="text-xs px-3 py-1 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: !pendentes ? "var(--surface-1)" : "transparent",
              color: !pendentes ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: !pendentes ? 600 : 400,
            }}
          >
            Todos
          </Link>
          <Link
            href={`/assistencia/pagamentos?pendentes=1${assembler ? `&assembler=${assembler}` : ""}`}
            className="text-xs px-3 py-1 rounded-full border"
            style={{
              borderColor: "var(--border)",
              background: pendentes ? "var(--surface-1)" : "transparent",
              color: pendentes ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: pendentes ? 600 : 400,
            }}
          >
            Só pendentes de liberação
          </Link>
          <FilterSelect name="assembler" placeholder="Todos os montadores" options={assemblers} />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Total: <strong>{formatBRL(grandTotal)}</strong> · Pendente:{" "}
            <strong style={{ color: "var(--status-warning)" }}>{formatBRL(pendingTotal)}</strong>
          </div>
          {canExport ? <PaymentsExportButton items={items} /> : null}
          <Link
            href="/assistencia/nova-rapida"
            className="text-sm px-3 py-2 rounded font-medium whitespace-nowrap"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            + Nova
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {assembler
              ? "Nenhuma montagem desse montador encontrada."
              : pendentes
                ? "Nada pendente de valor ou liberação no momento."
                : "Nenhuma montagem encontrada."}
          </p>
        </div>
      ) : (
        groups.map((group) => {
          const total = group.items.reduce((sum, i) => sum + (i.unitValue ?? 0) * i.quantity, 0);
          // Sub-divisão por loja só quando um montador específico está
          // selecionado (senão cada grupo já é o próprio montador, e
          // dividir de novo por loja não ajuda em nada na visão geral).
          const storeGroups = assembler ? groupByStore(group.items) : [{ storeName: "", items: group.items }];
          return (
            <div
              key={group.assemblerName}
              className="rounded-lg overflow-hidden"
              style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--gridline)" }}
              >
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {group.assemblerName}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {formatBRL(total)}
                </span>
              </div>
              {storeGroups.map((storeGroup) => (
                <div key={storeGroup.storeName || "unica"}>
                  {storeGroup.storeName ? (
                    <div className="px-4 py-1.5" style={{ background: "var(--surface-2, var(--gridline))" }}>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        {storeGroup.storeName}
                      </span>
                    </div>
                  ) : null}
                  <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                    {storeGroup.items.map((item) => (
                      <PaymentItemEditor key={item.itemId} item={item} canEdit={canExport} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
