"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";

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
      const res = await fetch("/api/motorista/upload-photo", { method: "POST", body: formData });
      // Ver comentário equivalente em MontadorPhotoUpload.tsx -- inclui o
      // status HTTP na mensagem quando a resposta não é JSON (proxy barrando
      // antes de chegar na nossa rota), pra dar pista sem precisar de
      // devtools no celular do motorista.
      const raw = await res.text();
      let data: { error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // não era JSON -- segue com data vazio, cai no fallback abaixo
      }
      if (!res.ok) {
        throw new Error(data.error || `Não foi possível enviar a foto (erro ${res.status}).`);
      }
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
      {/* <label> envolvendo o input, não botão com ref.click() -- em
          navegadores embutidos (o do WhatsApp, principalmente) um clique
          disparado por JavaScript no input escondido é bloqueado por não
          contar como gesto "de verdade" do usuário, e o seletor nunca abre.
          O label é a forma nativa do HTML de associar um clique visível a um
          input de arquivo, sem depender de JS pra abrir o seletor -- funciona
          em muito mais lugares. Sem `capture`: forçar a câmera direto também
          costuma travar nesses navegadores; deixando livre, abre o seletor
          nativo (câmera OU galeria). Um clique só: escolher já envia, sem
          passo extra. */}
      <label
        className="text-base rounded-xl px-4 py-6 font-semibold text-center cursor-pointer flex flex-col items-center gap-1.5"
        style={{
          border: `2px dashed ${proof ? "var(--status-warning)" : "var(--brand-green)"}`,
          color: proof ? "var(--status-warning)" : "var(--brand-green)",
          opacity: pending ? 0.6 : 1,
          pointerEvents: pending ? "none" : "auto",
        }}
      >
        <span className="text-3xl leading-none">{proof ? "📝" : "📷"}</span>
        {pending ? "Enviando…" : proof ? "Foto do comprovante assinado" : "Tirar ou enviar foto"}
        <input
          key={inputKey}
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
  );
}
