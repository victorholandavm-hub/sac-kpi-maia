"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";
import { uploadPhotoRequest } from "@/lib/uploadPhotoClient";

export function MotoristaPhotoUpload({
  requestId,
  proof,
}: {
  requestId: string;
  // Modo comprovante assinado (obrigatório antes de concluir, ver
  // driverCompleteRequest) -- some a legenda livre, fixa a legenda e marca
  // is_proof pro servidor conseguir checar a exigência sem depender de texto.
  proof?: boolean;
}) {
  const { pending, run } = useQuickAction();
  const [caption, setCaption] = useState("");
  const [inputKey, setInputKey] = useState(0);

  function upload(file: File) {
    const formData = new FormData();
    formData.set("photo", file);
    formData.set("caption", proof ? "Comprovante assinado pelo cliente" : caption);
    formData.set("requestId", requestId);
    if (proof) formData.set("isProof", "1");
    run(async () => {
      // POST comum em vez de Server Action -- mesmo motivo do
      // MontadorPhotoUpload.tsx (navegador embutido do WhatsApp).
      // uploadPhotoRequest (uploadPhotoClient.ts) cuida do fetch/timeout/
      // leitura da resposta, compartilhado com MontadorPhotoUpload.tsx/
      // RequestPhotoUpload.tsx.
      await uploadPhotoRequest("/api/motorista/upload-photo", formData);
      setCaption("");
      setInputKey((k) => k + 1);
    }, "Foto enviada.");
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3"
      style={{ borderColor: proof ? "var(--status-warning)" : "var(--border)" }}
    >
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {proof ? "Comprovante assinado" : "Foto"}
      </span>
      {proof ? null : (
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Legenda (opcional)"
          className="rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      )}
      {/* Dois botões separados (câmera / galeria), não um seletor único
          "livre" (sem `capture`) -- pedido do Victor 26/08/2026: "o
          motorista ainda nao consegue abrir a camera... só consegue
          adicionar a foto vinda da galeria". A teoria era que, sem
          `capture`, o seletor nativo do celular abriria com as duas
          opções (câmera OU galeria) -- na prática, em pelo menos um
          navegador/aparelho de motorista isso não acontece, o seletor cai
          direto pra galeria/arquivos, sem oferecer câmera nenhuma.
          Garantia de verdade só existe com DOIS inputs -- um com
          `capture="environment"` (força câmera, sempre abre a câmera de
          verdade) e outro sem `capture` nenhum (força o seletor de
          arquivo, sempre oferece a galeria). Cada um no seu <label> --
          mesmo motivo de sempre: clique disparado por JS num input
          escondido é bloqueado em navegador embutido (WhatsApp), o label
          é a forma nativa de abrir o seletor sem depender de JS. */}
      <div className="grid grid-cols-2 gap-2">
        <label
          className="text-sm rounded-xl px-3 py-5 font-semibold text-center cursor-pointer flex flex-col items-center gap-1"
          style={{
            border: `2px dashed ${proof ? "var(--status-warning)" : "var(--brand-green)"}`,
            color: proof ? "var(--status-warning)" : "var(--brand-green)",
            opacity: pending ? 0.6 : 1,
            pointerEvents: pending ? "none" : "auto",
          }}
        >
          <span className="text-2xl leading-none">📷</span>
          {pending ? "Enviando…" : "Tirar foto"}
          <input
            key={`camera-${inputKey}`}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
            className="hidden"
          />
        </label>
        <label
          className="text-sm rounded-xl px-3 py-5 font-semibold text-center cursor-pointer flex flex-col items-center gap-1"
          style={{
            border: `2px dashed ${proof ? "var(--status-warning)" : "var(--brand-green)"}`,
            color: proof ? "var(--status-warning)" : "var(--brand-green)",
            opacity: pending ? 0.6 : 1,
            pointerEvents: pending ? "none" : "auto",
          }}
        >
          <span className="text-2xl leading-none">🖼️</span>
          {pending ? "Enviando…" : "Da galeria"}
          <input
            key={`gallery-${inputKey}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
