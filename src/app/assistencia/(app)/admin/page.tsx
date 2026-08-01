import { getProfile } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listGerentesWithPinStatus } from "@/lib/gerentes";
import { listAssemblersWithPinStatus, listDriversWithPinStatus } from "@/lib/payments";
import { listSuppliers } from "@/lib/partOrders";
import { listProdutosEncomenda } from "@/lib/pedidosEncomenda";
import { listCdOperadoresWithPinStatus, listFabricaOperadoresWithPinStatus } from "@/lib/encomendaAuth";
import { findInternalFabrica } from "@/lib/fabricas";
import { listCaixasWithPinStatus } from "@/lib/caixas";
import { listSacProfilesWithPinStatus } from "@/app/assistencia/admin-actions";
import { PIN_LENGTH } from "@/lib/pinConfig";
import { CreateUserForm } from "@/components/assistencia/CreateUserForm";
import { AddSimpleEntryForm } from "@/components/assistencia/AddSimpleEntryForm";
import { AddGerenteForm } from "@/components/assistencia/AddGerenteForm";
import { AddCaixaForm } from "@/components/assistencia/AddCaixaForm";
import { AssemblerPinField } from "@/components/assistencia/AssemblerPinField";
import { DriverPinField } from "@/components/assistencia/DriverPinField";
import { GerentePinField } from "@/components/assistencia/GerentePinField";
import { ProdutoEncomendaAdmin } from "@/components/assistencia/ProdutoEncomendaAdmin";
import { CaixaPinField } from "@/components/assistencia/CaixaPinField";
import { CdOperadorPinField } from "@/components/assistencia/CdOperadorPinField";
import { FabricaOperadorPinField } from "@/components/assistencia/FabricaOperadorPinField";
import { SacPinField } from "@/components/assistencia/SacPinField";
import { RotaWeekdaySelect } from "@/components/assistencia/RotaWeekdaySelect";
import { getRotaWeekdayConfig } from "@/lib/rotas";

function AdminSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <summary className="text-base font-bold cursor-pointer p-4" style={{ color: "var(--brand-green)" }}>
        {title}
        {count !== undefined ? ` (${count})` : ""}
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4">{children}</div>
    </details>
  );
}

export default async function AdminPage() {
  const profile = await getProfile();

  if (profile.role !== "admin") {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito ao admin.
      </p>
    );
  }

  const [stores, gerentes, assemblers, drivers, suppliers, produtosEncomenda, caixas, cdOperadores, fabricaOperadores, sacProfiles, rotaConfig] =
    await Promise.all([
      listStores(),
      listGerentesWithPinStatus(),
      listAssemblersWithPinStatus(),
      listDriversWithPinStatus(),
      listSuppliers(),
      listProdutosEncomenda(),
      listCaixasWithPinStatus(),
      listCdOperadoresWithPinStatus(),
      listFabricaOperadoresWithPinStatus(),
      listSacProfilesWithPinStatus(),
      getRotaWeekdayConfig(),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        Administração
      </h2>

      <AdminSection title="Criar conta de assistência">
        <CreateUserForm />
      </AdminSection>

      <div className="grid sm:grid-cols-2 gap-4">
        <AdminSection title="Montadores" count={assemblers.length}>
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
        </AdminSection>

        <AdminSection title="Motoristas" count={drivers.length}>
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
        </AdminSection>

        <AdminSection title="Fornecedores" count={suppliers.length}>
          <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {suppliers.map((s) => (
              <li key={s} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {s}
              </li>
            ))}
          </ul>
          <AddSimpleEntryForm kind="supplier" />
        </AdminSection>
      </div>

      <AdminSection title="Gerentes de loja" count={gerentes.length}>
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
      </AdminSection>

      <AdminSection title="Catálogo de produtos — Encomendas" count={produtosEncomenda.length}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Produtos disponíveis pra caixa escolher em <span className="font-mono">/assistencia/encomendas/solicitar</span>.
        </p>
        <ProdutoEncomendaAdmin produtos={produtosEncomenda} />
      </AdminSection>

      <AdminSection title="Caixas — Encomendas" count={caixas.length}>
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
      </AdminSection>

      <div className="grid sm:grid-cols-2 gap-4">
        <AdminSection title="Operadores CD — Encomendas" count={cdOperadores.length}>
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
        </AdminSection>

        <AdminSection title="Operadores Fábrica — Encomendas" count={fabricaOperadores.length}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Defina um PIN de {PIN_LENGTH} números pra cada um acessar{" "}
            <span className="font-mono">/assistencia/encomendas/fabrica/login</span>.
          </p>
          <ul className="flex flex-col gap-2">
            {fabricaOperadores.map((o) => (
              <li key={o.name}>
                <FabricaOperadorPinField
                  name={o.name}
                  hasPin={o.hasPin}
                  fabricaNome={o.fabricaId ? (findInternalFabrica(o.fabricaId)?.nome ?? o.fabricaId) : "Todas as fábricas"}
                />
              </li>
            ))}
          </ul>
          <AddSimpleEntryForm kind="fabrica" />
        </AdminSection>
      </div>

      <AdminSection title="Equipe SAC — PIN" count={sacProfiles.length}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Defina um PIN de {PIN_LENGTH} números pra cada um acessar{" "}
          <span className="font-mono">/assistencia/sac/login</span> direto pelo nome (pessoa nova entra
          primeiro pelo cadastro de usuário acima, com papel &ldquo;SAC&rdquo;, e o PIN é definido aqui depois).
        </p>
        <ul className="flex flex-col gap-2">
          {sacProfiles.map((p) => (
            <li key={p.id}>
              <SacPinField id={p.id} fullName={p.fullName} hasPin={p.hasPin} />
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection title="Rotas de entrega">
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
      </AdminSection>
    </div>
  );
}
