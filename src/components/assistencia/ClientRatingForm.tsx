"use client";

import { useState, useTransition } from "react";
import type { ClientRatingAccess } from "@/app/assistencia/avaliar/actions";
import { RatingScale } from "./RatingScale";

const REASON_MESSAGES: Record<string, string> = {
  not_found: "Não encontramos esse chamado.",
  not_completed: "Esse atendimento ainda não foi concluído.",
  already_rated: "Esse atendimento já foi avaliado, obrigado!",
  no_cpf_on_file: "Não conseguimos confirmar automaticamente esse pedido. Fale com a loja se quiser avaliar mesmo assim.",
  wrong_cpf: "CPF não confere com o pedido. Confira os números e tente de novo.",
  rate_limited: "Muitas tentativas. Tente de novo em alguns minutos.",
};

type Step = { kind: "cpf" } | { kind: "rating"; label: "montagem" | "entrega" } | { kind: "done" };

// POST comum (fetch pra /api/avaliar/*) em vez de Server Action chamada
// direto -- o cliente abre esse link quase sempre escaneando o QR de
// dentro de um navegador embutido (câmera do celular, WhatsApp), com o
// mesmo bug já documentado pro upload de foto de montador/motorista: Server
// Actions dependem de resposta RSC em stream, que esses navegadores
// restritos não suportam bem -- o clique simplesmente não fazia nada, sem
// erro nenhum visível (17/08/2026).
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Lê como texto primeiro -- se não vier JSON válido é sinal de que a
  // resposta nem chegou na nossa rota (proxy/erro genérico), não um erro
  // de negócio -- mesmo cuidado de MontadorPhotoUpload.tsx.
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : ({} as T);
  } catch {
    throw new Error(`Não foi possível conectar (erro ${res.status}). Tente de novo.`);
  }
}

export function ClientRatingForm({ requestId }: { requestId: string }) {
  const [step, setStep] = useState<Step>({ kind: "cpf" });
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deliveryRating, setDeliveryRating] = useState<number | null>(null);
  const [resolutionRating, setResolutionRating] = useState<number | null>(null);

  function confirmCpf() {
    setError(null);
    startTransition(async () => {
      try {
        const access = await postJson<ClientRatingAccess>("/api/avaliar/verify", { requestId, cpf });
        if (!access.ok) {
          setError(REASON_MESSAGES[access.reason] ?? "Não foi possível confirmar. Tente de novo.");
          return;
        }
        setStep({ kind: "rating", label: access.kind });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado. Tente de novo.");
      }
    });
  }

  function confirmRating() {
    if (deliveryRating === null || resolutionRating === null) {
      setError("Escolha as duas notas antes de enviar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await postJson<{ ok?: boolean; error?: string }>("/api/avaliar/submit", {
          requestId,
          cpf,
          deliveryRating,
          resolutionRating,
        });
        if (!result.ok) {
          setError(result.error || "Não foi possível enviar. Tente de novo.");
          return;
        }
        setStep({ kind: "done" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado. Tente de novo.");
      }
    });
  }

  if (step.kind === "done") {
    return (
      <div className="flex flex-col items-center gap-2 text-center rounded-lg p-6" style={{ background: "var(--surface-1)" }}>
        <span className="text-3xl">✅</span>
        <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Avaliação enviada, obrigado!
        </p>
      </div>
    );
  }

  if (step.kind === "rating") {
    return (
      <div className="flex flex-col gap-4 rounded-lg p-4" style={{ background: "var(--surface-1)" }}>
        <RatingScale
          label={step.label === "montagem" ? "Nota pra montagem" : "Nota pra entrega"}
          value={deliveryRating}
          onChange={setDeliveryRating}
        />
        <RatingScale label="Nota pra resolução do problema" value={resolutionRating} onChange={setResolutionRating} />
        {error ? (
          <p className="text-sm font-medium" style={{ color: "var(--status-critical)" }}>
            {error}
          </p>
        ) : null}
        <button
          disabled={pending || deliveryRating === null || resolutionRating === null}
          onClick={confirmRating}
          className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60"
          style={{ background: "var(--status-good)", color: "#fff" }}
        >
          Enviar avaliação
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg p-4" style={{ background: "var(--surface-1)" }}>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Digite seu CPF pra confirmar
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="000.000.000-00"
          className="rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      {error ? (
        <p className="text-sm font-medium" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}
      <button
        disabled={pending || !cpf.trim()}
        onClick={confirmCpf}
        className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Continuar
      </button>
    </div>
  );
}
