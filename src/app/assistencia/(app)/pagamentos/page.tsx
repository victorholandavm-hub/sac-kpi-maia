import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listPaymentItems, listAssemblers, paymentStage, type PaymentItem } from "@/lib/payments";
import { PAYMENTS_CONTROLLER_NAME } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { PaymentsExportButton } from "@/components/assistencia/PaymentsExportButton";
import { AssemblerPaymentGroup } from "@/components/assistencia/AssemblerPaymentGroup";

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
          return (
            <AssemblerPaymentGroup
              key={group.assemblerName}
              assemblerName={group.assemblerName}
              items={group.items}
              total={total}
              canEdit={canExport}
              // Aberto de cara só quando esse montador já foi escolhido no
              // filtro, ou quando é o único grupo na tela -- senão fica
              // recolhido, pra não ter que descer passando pelas montagens
              // de todo mundo só pra ver o próximo montador.
              defaultOpen={group.assemblerName === assembler || groups.length === 1}
            />
          );
        })
      )}
    </div>
  );
}
