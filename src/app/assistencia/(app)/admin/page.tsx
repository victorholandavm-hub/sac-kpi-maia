import { getProfile } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listGerentesWithPinStatus } from "@/lib/gerentes";
import { listAssemblersWithPinStatus, listDriversWithPinStatus } from "@/lib/payments";
import { listSuppliers } from "@/lib/partOrders";
import { listProdutosEncomenda } from "@/lib/pedidosEncomenda";
import { listCdOperadoresWithPinStatus, listFabricaOperadoresWithPinStatus } from "@/lib/encomendaAuth";
import { listVendedoresWithPinStatus } from "@/lib/vendedores";
import { listCaixasWithPinStatus } from "@/lib/caixas";
import { PIN_LENGTH } from "@/lib/pinConfig";
import { CreateUserForm } from "@/components/assistencia/CreateUserForm";
import { AddSimpleEntryForm } from "@/components/assistencia/AddSimpleEntryForm";
import { AddGerenteForm } from "@/components/assistencia/AddGerenteForm";
import { AddVendedorForm } from "@/components/assistencia/AddVendedorForm";
import { AddCaixaForm } from "@/components/assistencia/AddCaixaForm";
import { AssemblerPinField } from "@/components/assistencia/AssemblerPinField";
import { DriverPinField } from "@/components/assistencia/DriverPinField";
import { GerentePinField } from "@/components/assistencia/GerentePinField";
import { VendedorPinField } from "@/components/assistencia/VendedorPinField";
import { ProdutoEncomendaAdmin } from "@/components/assistencia/ProdutoEncomendaAdmin";
import { CaixaPinField } from "@/components/assistencia/CaixaPinField";
import { CdOperadorPinField } from "@/components/assistencia/CdOperadorPinField";
import { FabricaOperadorPinField } from "@/components/assistencia/FabricaOperadorPinField";
import { RotaWeekdaySelect } from "@/components/assistencia/RotaWeekdaySelect";
import { getRotaWeekdayConfig } from "@/lib/rotas";

export default async function AdminPage() {
  const profile = await getProfile();

  if (profile.role !== "admin") {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito ao admin.
      </p>
    );
  }

  const [stores, gerentes, assemblers, drivers, suppliers, produtosEncomenda, caixas, vendedores, cdOperadores, fabricaOperadores, rotaConfig] =
    await Promise.all([
      listStores(),
      listGerentesWithPinStatus(),
      listAssemblersWithPinStatus(),
      listDriversWithPinStatus(),
      listSuppliers(),
      listProdutosEncomenda(),
      listCaixasWithPinStatus(),
      listVendedoresWithPinStatus(),
      listCdOperadoresWithPinStatus(),
      listFabricaOperadoresWithPinStatus(),
      getRotaWeekdayConfig(),
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
            Defina um PIN de {PIN_LENGTH} números pra cada um acessar a própria área em{" "}
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
            Motoristas
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Defina um PIN de {PIN_LENGTH} números pra cada um acessar a própria área em{" "}
            <span className="font-mono">/assistencia/motorista</span>.
          </p>
          <ul className="flex flex-col gap-2">
            {drivers.map((d) => (
              <li key={d.name}>
                <DriverPinField name={d.name} hasPin={d.hasPin} />
              </li>
            ))}
          </ul>
          <AddSimpleEntryForm kind="driver" />
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
          Cada gerente entra com o próprio nome + PIN de {PIN_LENGTH} números em <span className="font-mono">/assistencia/loja</span>{" "}
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

      <section
        className="rounded-lg border p-4 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Catálogo de produtos — Encomendas
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Produtos disponíveis pra caixa escolher em <span className="font-mono">/assistencia/encomendas/solicitar</span>.
        </p>
        <ProdutoEncomendaAdmin produtos={produtosEncomenda} />
      </section>

      <section
        className="rounded-lg border p-4 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Caixas — Encomendas
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Cada caixa tem seu próprio PIN e uma loja fixa, e entra com nome + PIN em{" "}
          <span className="font-mono">/assistencia/encomendas/caixa/login</span>.
        </p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2 max-h-64 overflow-y-auto">
          {caixas.map((c) => (
            <li key={c.name}>
              <CaixaPinField name={c.name} storeName={c.storeName} hasPin={c.hasPin} ativo={c.ativo} />
            </li>
          ))}
        </ul>
        <AddCaixaForm stores={stores} />
      </section>

      <section
        className="rounded-lg border p-4 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Vendedores — Encomendas
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Cada vendedor tem seu próprio PIN e uma loja fixa, e entra com nome + PIN em{" "}
          <span className="font-mono">/assistencia/encomendas/vendedor/login</span>.
        </p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2 max-h-64 overflow-y-auto">
          {vendedores.map((v) => (
            <li key={v.name}>
              <VendedorPinField name={v.name} storeName={v.storeName} hasPin={v.hasPin} ativo={v.ativo} />
            </li>
          ))}
        </ul>
        <AddVendedorForm stores={stores} />
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <section
          className="rounded-lg border p-4 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Operadores CD — Encomendas
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Defina um PIN de {PIN_LENGTH} números pra cada um acessar{" "}
            <span className="font-mono">/assistencia/encomendas/cd/login</span>.
          </p>
          <ul className="flex flex-col gap-2">
            {cdOperadores.map((o) => (
              <li key={o.name}>
                <CdOperadorPinField name={o.name} hasPin={o.hasPin} />
              </li>
            ))}
          </ul>
          <AddSimpleEntryForm kind="cd" />
        </section>

        <section
          className="rounded-lg border p-4 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Operadores Fábrica — Encomendas
          </h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Defina um PIN de {PIN_LENGTH} números pra cada um acessar{" "}
            <span className="font-mono">/assistencia/encomendas/fabrica/login</span>.
          </p>
          <ul className="flex flex-col gap-2">
            {fabricaOperadores.map((o) => (
              <li key={o.name}>
                <FabricaOperadorPinField name={o.name} hasPin={o.hasPin} />
              </li>
            ))}
          </ul>
          <AddSimpleEntryForm kind="fabrica" />
        </section>
      </div>

      <section
        className="rounded-lg border p-4 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Rotas de entrega
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Rota fixa por dia da semana (padrão: Praia seg/qui, Sul ter/sex, Centro qua/sáb) — usada
          na agenda pra sugerir as datas certas de cada rota. Domingo não tem rota.
        </p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2 max-w-md">
          {[1, 2, 3, 4, 5, 6].map((weekday) => (
            <li key={weekday}>
              <RotaWeekdaySelect weekday={weekday} rota={rotaConfig[weekday] ?? null} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
