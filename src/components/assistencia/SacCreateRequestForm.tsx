"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { createSacRequest, lookupTotvsClientForTeam, lookupTotvsProductForTeam, type FormState } from "@/app/assistencia/actions";
import { SAC_CATEGORIES, SAC_CATEGORY_LABELS, REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import type { Store } from "@/lib/serviceRequests";
import { FormSection } from "./FormSection";

const inputStyle = { borderColor: "var(--border)" };

type SacType = "troca_produto" | "entrega_produto" | "envio_peca" | "notificacao_externa" | "montagem";

// Tipos que envolvem entrega pelo motorista (produto/peça + quem vai levar).
// "O que recolher" só se aplica a troca_produto — os outros dois não têm
// recolhimento nenhum.
const DELIVERY_TYPES: SacType[] = ["troca_produto", "entrega_produto", "envio_peca"];

// Montagem também tem produto (o móvel a montar), mas sem motorista -- quem
// vai até o cliente é um montador, atribuído depois por assistência/admin
// (o SAC só faz o intake, ver createSacRequest).
const PRODUCT_TYPES: SacType[] = [...DELIVERY_TYPES, "montagem"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}


export function SacCreateRequestForm({ stores, drivers }: { stores: Store[]; drivers: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSacRequest, undefined);
  const [type, setType] = useState<SacType>("troca_produto");
  const isDelivery = DELIVERY_TYPES.includes(type);
  const showProduct = PRODUCT_TYPES.includes(type);

  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientNeighborhood, setClientNeighborhood] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [isApartment, setIsApartment] = useState(false);
  const [addressComplement, setAddressComplement] = useState("");
  const [clientLookupStatus, setClientLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  // Só montagem envolve entrar num prédio de verdade -- SAC nem oferece
  // desmontagem isolada (ver SacType acima).
  const showAddressNumber = type === "montagem";

  const [productCode, setProductCode] = useState("");
  const [product, setProduct] = useState("");
  const [productLookupStatus, setProductLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

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
          if (match.addressNeighborhood) setClientNeighborhood(match.addressNeighborhood);
          setClientLookupStatus("found");
        })
        .catch(() => setClientLookupStatus("not_found"));
    }, 400);
    return () => clearTimeout(timer);
  }, [clientCode]);

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
      <FormSection title="Tipo e loja" number={1}>
        <Field label="Tipo">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as SacType)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          >
            <option value="troca_produto">{REQUEST_TYPE_LABELS.troca_produto} (recolher + entregar)</option>
            <option value="entrega_produto">{REQUEST_TYPE_LABELS.entrega_produto} (sem recolhimento)</option>
            <option value="envio_peca">{REQUEST_TYPE_LABELS.envio_peca}</option>
            <option value="notificacao_externa">Notificação externa (sem troca de produto)</option>
            <option value="montagem">{REQUEST_TYPE_LABELS.montagem}</option>
          </select>
        </Field>

        <Field label="Loja *">
          <select name="store_id" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
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

        {type === "notificacao_externa" ? (
          <Field label="Categoria *">
            <select name="sac_category" required defaultValue="" className="rounded border px-3 py-2" style={inputStyle}>
              <option value="" disabled>
                Selecione…
              </option>
              {SAC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {SAC_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          <input type="checkbox" name="urgent" className="rounded" />
          Urgente
        </label>
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

        <Field label="Bairro *">
          <input
            name="client_neighborhood"
            value={clientNeighborhood}
            onChange={(e) => setClientNeighborhood(e.target.value)}
            required
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>

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
      </FormSection>

      {showProduct ? (
        <FormSection
          title={type === "montagem" ? "Móvel a montar" : "Produto e entrega"}
          number={3}
          hint="Digite o código do produto pra preencher o nome automaticamente (se souber)."
        >
          <div className="grid sm:grid-cols-3 gap-4">
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
            <Field label={type === "montagem" ? "Móvel a montar" : "Produto a entregar"}>
              <input
                name="product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Ex: Super Box Confort Mola Ensacada"
                className="rounded border px-3 py-2"
                style={inputStyle}
              />
            </Field>
            <Field label="Quantidade">
              <input name="quantity" type="number" min={1} defaultValue={1} className="rounded border px-3 py-2" style={inputStyle} />
            </Field>
          </div>

          {type === "montagem" ? (
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
              <input type="checkbox" name="combo_montagem_desmontagem" className="rounded" />
              Também precisa desmontar o móvel antigo
            </label>
          ) : null}

          {isDelivery ? (
            <Field label="Motorista">
              <input name="driver_name" list="sac-drivers" className="rounded border px-3 py-2" style={inputStyle} />
              <datalist id="sac-drivers">
                {drivers.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection title="Detalhes" number={4} hint="Conte o que aconteceu, com o máximo de detalhe que puder.">
        <Field label="Motivo *">
          <textarea name="reason" rows={2} required placeholder="Ex: produto entregue com avaria" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>

        {type === "troca_produto" ? (
          <Field label="O que recolher / instrução pro motorista">
            <textarea
              name="restriction_note"
              rows={2}
              placeholder="Ex: recolher Super Box avariada e entregar a nova"
              className="rounded border px-3 py-2"
              style={inputStyle}
            />
          </Field>
        ) : null}

        <Field label="Foto ou PDF da notificação *">
          <input
            name="photo"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="rounded border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </Field>
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
        {pending ? "Criando…" : "Criar solicitação"}
      </button>
    </form>
  );
}
