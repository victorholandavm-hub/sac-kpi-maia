"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createStockMovement, lookupProductNameByCode, type StockMovementFormState } from "@/app/assistencia/estoque-actions";
import { MOVEMENT_TYPE_LABELS } from "@/lib/assistenciaLabels";

const TYPES = ["retirado", "devolvido", "reparado"] as const;

const inputStyle = { borderColor: "var(--border)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--text-primary)" }}>
      {label}
      {children}
    </label>
  );
}

export function NewStockMovementForm({ factories }: { factories: string[] }) {
  const [state, formAction, pending] = useActionState<StockMovementFormState, FormData>(createStockMovement, undefined);
  const [factory, setFactory] = useState("");
  const [typeValue, setTypeValue] = useState<(typeof TYPES)[number]>("retirado");
  // Puxa o nome do produto pelo código -- pedido do Victor 28/08/2026:
  // "puxe o nome do produto pelo código do produto". Busca no catálogo
  // (totvs_stock, mesma fonte de "Prazos de produtos") ao sair do campo
  // Código -- só preenche Produto quando acha, nunca trava o campo (o
  // catálogo é do padrão de fábrica, não cobre 100% do que passa pela
  // assistência -- item sem correspondência continua digitável na mão).
  const [code, setCode] = useState("");
  const [product, setProduct] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  async function handleCodeBlur() {
    const trimmed = code.trim();
    if (!trimmed) {
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    try {
      const name = await lookupProductNameByCode(trimmed);
      if (name) {
        setProduct(name);
        setLookupState("found");
      } else {
        setLookupState("not_found");
      }
    } catch {
      setLookupState("not_found");
    }
  }

  if (state?.success) {
    return (
      <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
          Movimentação registrada!
        </p>
        <Link href="/assistencia/estoque" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <Field label="Tipo de movimentação">
        <select
          name="movement_type"
          value={typeValue}
          onChange={(e) => setTypeValue(e.target.value as (typeof TYPES)[number])}
          className="rounded border px-3 py-2"
          style={inputStyle}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Obrigatório -- pedido do Victor 28/08/2026: "preciso apenas
            que o codigo do porduto e o codigo do cliente sejam
            obrigatrios". */}
        <Field label="Código *">
          <input
            name="code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={handleCodeBlur}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
          {lookupState === "loading" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Buscando produto…
            </span>
          ) : lookupState === "not_found" ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Não achei esse código no catálogo -- digite o produto na mão.
            </span>
          ) : null}
        </Field>
        <Field label="Produto *">
          <input
            name="product"
            required
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="rounded border px-3 py-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Fábrica/Fornecedor">
        <select
          name="factory"
          value={factory}
          onChange={(e) => setFactory(e.target.value)}
          className="rounded border px-3 py-2"
          style={inputStyle}
        >
          <option value="">Selecione…</option>
          {factories.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          <option value="__outro__">Outro…</option>
        </select>
      </Field>
      {factory === "__outro__" ? (
        <Field label="Nome da fábrica/fornecedor">
          <input name="factory_other" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Cliente atendido *">
          <input name="client_name" required className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Volume">
          <input name="volume" placeholder="Ex: 1/2" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Data da movimentação">
          <input name="movement_date" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
        <Field label="Data de lançamento">
          <input name="logged_date" type="date" className="rounded border px-3 py-2" style={inputStyle} />
        </Field>
      </div>
      {/* Pra "Retirado do CD" especificamente, quem confirma a retirada
          física de verdade e lança a data é a equipe técnica, num
          fluxo separado ("Dar baixa", /assistencia/tecnico/estoque) --
          pedido do Victor 28/08/2026: "Assistencia registra e a equipe
          tecnica é que retira do estoque e lança a data que foi
          retirada". Deixar a Data da movimentação em branco aqui é o
          esperado nesse caso (vira "pendente de retirada" até a equipe
          técnica dar baixa). */}
      {typeValue === "retirado" ? (
        <p className="text-xs -mt-2" style={{ color: "var(--text-muted)" }}>
          Pra &quot;Retirado do CD&quot;, deixe a Data da movimentação em branco -- a equipe técnica lança essa data quando retirar
          de verdade e der baixa.
        </p>
      ) : null}

      <Field label="Observações">
        <textarea name="notes" rows={3} className="rounded border px-3 py-2" style={inputStyle} />
      </Field>

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
        {pending ? "Registrando…" : "Registrar movimentação"}
      </button>
    </form>
  );
}
