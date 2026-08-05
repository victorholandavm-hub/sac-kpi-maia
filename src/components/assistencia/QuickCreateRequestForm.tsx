"use client";

import { useActionState, useEffect, useState } from "react";
import { createQuickRequest, lookupTotvsClientForTeam, lookupTotvsProductForTeam, type FormState } from "@/app/assistencia/actions";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS, MANOEL_ONLY_TYPES, MANOEL_ONLY_ASSEMBLER } from "@/lib/assistenciaLabels";
import { SHIFTS, type Store } from "@/lib/serviceRequests";
import { FormSection } from "./FormSection";

const ASSISTENCIA_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria"] as const;
const SAC_TYPE = "notificacao_externa" as const;

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}


export function QuickCreateRequestForm({
  stores,
  assemblers,
  includeSacTypes,
}: {
  stores: Store[];
  assemblers: { name: string; storeId: string | null }[];
  includeSacTypes: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createQuickRequest, undefined);
  const TYPES = includeSacTypes ? [...ASSISTENCIA_TYPES, SAC_TYPE] : ASSISTENCIA_TYPES;
  const [type, setType] = useState<string>("vistoria");
  const [storeId, setStoreId] = useState("");
  const isManoelOnly = (MANOEL_ONLY_TYPES as readonly string[]).includes(type);
  const showCombo = type === "montagem" || type === "desmontagem";
  // Montador da loja escolhida + globais/legado (store_id nulo) -- a loja só
  // é escolhida aqui no formulário, então o filtro é no cliente.
  const visibleAssemblers = assemblers.filter((a) => a.storeId === null || a.storeId === storeId);

  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [isApartment, setIsApartment] = useState(false);
  const [addressComplement, setAddressComplement] = useState("");
  const [clientLookupStatus, setClientLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  // Só montagem/desmontagem envolve entrar num prédio de verdade -- ver
  // ADDRESS_NUMBER_REQUIRED_TYPES em serviceRequests.ts.
  const showAddressNumber = type === "montagem" || type === "desmontagem";

  // Mesma ideia de PublicRequestForm.tsx: código é só atalho, não trava nada
  // se não achar -- a pessoa preenche à mão como já era.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!clientCode.trim()) {
        setClientLookupStatus("idle");
        return;
      }
      setClientLookupStatus("loading");
      lookupTotvsClientForTeam(clientCode)
        .then((match) => {
          if (!match) {
            setClientLookupStatus("not_found");
            return;
          }
          setClientName(match.name);
          if (match.phone1) setClientPhone(match.phone1);
          if (match.addressStreet) setClientAddress(match.addressStreet);
          if (match.addressNumber) setAddressNumber(match.addressNumber);
          if (match.addressComplement) {
            setIsApartment(true);
            setAddressComplement(match.addressComplement);
          }
          setClientLookupStatus("found");
        })
        .catch(() => setClientLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [clientCode]);

  const [productCode, setProductCode] = useState("");
  const [product, setProduct] = useState("");
  const [productLookupStatus, setProductLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!productCode.trim()) {
        setProductLookupStatus("idle");
        return;
      }
      setProductLookupStatus("loading");
      lookupTotvsProductForTeam(productCode)
        .then((match) => {
          if (!match || !match.description) {
            setProductLookupStatus("not_found");
            return;
          }
          setProduct(match.description);
          setProductLookupStatus("found");
        })
        .catch(() => setProductLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [productCode]);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <FormSection title="Loja e tipo" number={1}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Loja *">
            <select
              name="store_id"
              required
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo">
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded border px-3 py-2"
              style={inputStyle}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {showCombo ? (
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
            <input type="checkbox" name="combo_montagem_desmontagem" className="rounded" />
            {type === "montagem" ? "Também precisa desmontar o móvel antigo" : "Também precisa montar o móvel novo"}
          </label>
        ) : null}
      </FormSection>

      <FormSection
        title="Dados do cliente"
        number={2}
        hint="Digite o código do cliente pra preencher o resto automaticamente (se souber). Só o nome é obrigatório."
      >
        <Field label="Código do cliente">
          <input
            name="client_protheus_code"
            value={clientCode}
            onChange={(e) => setClientCode(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
          {clientLookupStatus === "loading" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buscando…
            </span>
          ) : clientLookupStatus === "found" ? (
            <span className="text-xs" style={{ color: "var(--status-good)" }}>
              Cliente encontrado — confira os dados abaixo.
            </span>
          ) : clientLookupStatus === "not_found" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Código não encontrado — preencha os dados abaixo à mão.
            </span>
          ) : null}
        </Field>

        <Field label="Nome do cliente *">
          <input
            name="client_name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Telefone *">
            <input
              name="client_phone"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              required
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
          <Field label="Endereço *">
            <input
              name="client_address"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              required
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        </div>

        {showAddressNumber ? (
          <div className="flex flex-col gap-3">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Número *">
                <input
                  name="client_address_number"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                  required
                  className="rounded border px-3 py-2"
                  style={inputStyle}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm self-end pb-2" style={{ color: "var(--text-primary)" }}>
                <input
                  type="checkbox"
                  name="client_is_apartment"
                  checked={isApartment}
                  onChange={(e) => setIsApartment(e.target.checked)}
                  className="rounded"
                />
                É apartamento/prédio?
              </label>
            </div>
            {isApartment ? (
              <Field label="Apto/Bloco *">
                <input
                  name="client_address_complement"
                  value={addressComplement}
                  onChange={(e) => setAddressComplement(e.target.value)}
                  required
                  placeholder="Ex: Apto 302, Bloco B"
                  className="rounded border px-3 py-2"
                  style={inputStyle}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        <Field label="O que precisa ser feito *">
          <textarea name="reason" rows={2} required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </FormSection>

      <FormSection title="Agendamento e responsável" number={3}>
        <div className="grid sm:grid-cols-4 gap-4">
          <Field label="Data agendada">
            <input name="scheduled_date" type="date" className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
          <Field label="Hora">
            <input name="scheduled_time" type="time" className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
          <Field label="Turno">
            <select name="shift" defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
              <option value="">Sem turno</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {SHIFT_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Técnico/montador">
            {isManoelOnly ? (
              <input
                name="assembler_name"
                value={MANOEL_ONLY_ASSEMBLER}
                readOnly
                className="rounded border px-3 py-2"
                style={{ ...inputStyle, background: "var(--gridline)", color: "var(--text-secondary)" }}
              />
            ) : (
              <>
                <input name="assembler_name" list="quick-assemblers" className="rounded border px-3 py-2" style={inputStyle} />
                <datalist id="quick-assemblers">
                  {visibleAssemblers.map((a) => (
                    <option key={a.name} value={a.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>
      </FormSection>

      <FormSection title="Pagamento" number={4} hint="Digite o código do produto pra preencher o nome automaticamente (se souber).">
        <div className="grid sm:grid-cols-4 gap-4">
          <Field label="Código do produto">
            <input
              name="part_code"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="Ex: SB-3050"
              className="rounded border px-3 py-2"
              style={inputStyle}
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
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Código não encontrado.
              </span>
            ) : null}
          </Field>
          <Field label="Produto/serviço (pagamento)">
            <input
              name="product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Ex: Trocar porta"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
          <Field label="Quantidade">
            <input name="quantity" type="number" min={1} defaultValue={1} className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
          <Field label="Valor (R$)">
            <input name="unit_value" type="number" min={0} step="0.01" className="rounded border px-3 py-2" style={inputStyle} />
          </Field>
        </div>
      </FormSection>

      {state?.error ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded px-4 py-2 font-medium self-start disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        {pending ? "Criando…" : "Criar"}
      </button>
    </form>
  );
}
