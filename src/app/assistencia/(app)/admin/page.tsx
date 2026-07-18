import { getProfile } from "@/lib/dal";
import { listStoresWithPinStatus } from "@/lib/serviceRequests";
import { listAssemblersWithPinStatus } from "@/lib/payments";
import { listSuppliers } from "@/lib/partOrders";
import { CreateUserForm } from "@/components/assistencia/CreateUserForm";
import { AddSimpleEntryForm } from "@/components/assistencia/AddSimpleEntryForm";
import { AssemblerPinField } from "@/components/assistencia/AssemblerPinField";
import { StorePinField } from "@/components/assistencia/StorePinField";

export default async function AdminPage() {
  const profile = await getProfile();

  if (profile.role !== "admin") {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito ao admin.
      </p>
    );
  }

  const [stores, assemblers, suppliers] = await Promise.all([listStoresWithPinStatus(), listAssemblersWithPinStatus(), listSuppliers()]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Administração
      </h2>

      <section
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Criar conta de assistência
        </h3>
        <CreateUserForm />
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <section
          className="rounded-lg border p-4 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Montadores
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Defina um PIN de 4 números pra cada um acessar a própria área em{" "}
            <span className="font-mono">/assistencia/montador</span>.
          </p>
          <ul className="flex flex-col gap-2">
            {assemblers.map((a) => (
              <li key={a.name}>
                <AssemblerPinField name={a.name} hasPin={a.hasPin} />
              </li>
            ))}
          </ul>
          <AddSimpleEntryForm kind="assembler" />
        </section>

        <section
          className="rounded-lg border p-4 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Fornecedores
          </h3>
          <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {suppliers.map((s) => (
              <li key={s} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {s}
              </li>
            ))}
          </ul>
          <AddSimpleEntryForm kind="supplier" />
        </section>
      </div>

      <section
        className="rounded-lg border p-4 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Lojas cadastradas ({stores.length})
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Renomear/fundir lojas ainda não tem tela própria — fala comigo se precisar corrigir alguma.
          Defina um PIN de 4 números pra cada loja acessar <span className="font-mono">/assistencia/loja</span>.
        </p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2 max-h-64 overflow-y-auto">
          {stores.map((s) => (
            <li key={s.id}>
              <StorePinField storeId={s.id} storeName={s.name} hasPin={s.hasPin} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
