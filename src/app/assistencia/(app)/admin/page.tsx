import { getProfile } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listGerentesWithPinStatus } from "@/lib/gerentes";
import { listAssemblersWithPinStatus } from "@/lib/payments";
import { listSuppliers } from "@/lib/partOrders";
import { CreateUserForm } from "@/components/assistencia/CreateUserForm";
import { AddSimpleEntryForm } from "@/components/assistencia/AddSimpleEntryForm";
import { AddGerenteForm } from "@/components/assistencia/AddGerenteForm";
import { AssemblerPinField } from "@/components/assistencia/AssemblerPinField";
import { GerentePinField } from "@/components/assistencia/GerentePinField";

export default async function AdminPage() {
  const profile = await getProfile();

  if (profile.role !== "admin") {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito ao admin.
      </p>
    );
  }

  const [stores, gerentes, assemblers, suppliers] = await Promise.all([
    listStores(),
    listGerentesWithPinStatus(),
    listAssemblersWithPinStatus(),
    listSuppliers(),
  ]);

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
          Gerentes de loja ({gerentes.length})
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Cada gerente entra com o próprio nome + PIN de 4 números em <span className="font-mono">/assistencia/loja</span>{" "}
          e só consegue solicitar/negociar prazo para as lojas vinculadas abaixo (pode ser mais de uma).
          Pra mudar as lojas de um gerente já cadastrado, adicione ele de novo marcando o novo conjunto de lojas.
        </p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2 max-h-64 overflow-y-auto">
          {gerentes.map((g) => (
            <li key={g.name}>
              <GerentePinField name={g.name} storeNames={g.storeNames} hasPin={g.hasPin} />
            </li>
          ))}
        </ul>
        <AddGerenteForm stores={stores} />
      </section>
    </div>
  );
}
