"use client";

import { useState } from "react";
import { useQuickAction } from "./useQuickAction";
import { uploadPhotoRequest } from "@/lib/uploadPhotoClient";

// Reescrito 26/08/2026 -- pedido do Victor: "montador e assistencia estão
// dizendo que nao estao conseguindo adicionar fotos nas solicitações...
// veja a possibilidade de adicionar fotos diretamente da camera e nao só
// da galeria". Duas causas raiz, as duas já resolvidas antes pro mesmo
// problema em MontadorPhotoUpload.tsx/MotoristaPhotoUpload.tsx, só que
// nunca tinham sido aplicadas aqui:
// 1. Chamava addRequestPhoto (Server Action) direto -- Server Action carrega
//    um ID específico do build; um deploy novo (frequente nesta base)
//    invalida o ID de quem já estava com a tela aberta antes, e o clique
//    falha com "Failed to find Server Action... older or newer deployment"
//    (confirmado nos logs de produção). Virou POST comum em
//    /api/staff/upload-photo, mesmo padrão de montador/motorista.
// 2. `capture="environment"` no input forçava a câmera direto em muitos
//    navegadores mobile, SEM opção de escolher uma foto já existente da
//    galeria -- e se a câmera falhasse (permissão negada, app trava), não
//    tinha nenhum jeito de completar o envio.
//
// Ajustado de novo em 26/08/2026 -- achado no fluxo do motorista, mesma
// causa aqui: um único input "livre" (sem `capture`) na teoria abre o
// seletor nativo com câmera OU galeria, mas na prática, em pelo menos um
// navegador/aparelho, cai direto pra galeria/arquivos sem nunca oferecer
// câmera. Virou DOIS botões -- um com `capture="environment"` (força
// câmera de verdade) e outro sem `capture` (força a galeria) -- garantia
// de verdade em vez de depender do seletor "adivinhar" as duas opções.
export function RequestPhotoUpload({ requestId }: { requestId: string }) {
  const { pending, run } = useQuickAction();
  const [caption, setCaption] = useState("");
  const [inputKey, setInputKey] = useState(0);

  function upload(file: File) {
    const formData = new FormData();
    formData.set("photo", file);
    formData.set("caption", caption);
    formData.set("requestId", requestId);
    run(async () => {
      // POST comum, não addRequestPhoto (Server Action) -- ver comentário
      // acima. uploadPhotoRequest (uploadPhotoClient.ts) cuida do
      // fetch/timeout/leitura da resposta, compartilhado com
      // MontadorPhotoUpload.tsx/MotoristaPhotoUpload.tsx.
      await uploadPhotoRequest("/api/staff/upload-photo", formData);
      setCaption("");
      setInputKey((k) => k + 1);
    }, "Foto adicionada.");
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Legenda (opcional)"
        className="rounded border px-2 py-1 text-xs w-40"
        style={{ borderColor: "var(--border)" }}
      />
      {/* Dois botões (câmera / galeria) -- ver comentário no topo do
          arquivo. <label> envolvendo o input, não botão com ref.click()
          -- mesmo motivo de MontadorPhotoUpload.tsx: em navegadores
          embutidos (o do WhatsApp, principalmente) um clique disparado
          por JS num input escondido é bloqueado por não contar como
          gesto "de verdade" do usuário. */}
      <label
        className="text-xs rounded px-2 py-1 cursor-pointer"
        style={{
          background: "var(--brand-green)",
          color: "var(--brand-green-ink)",
          opacity: pending ? 0.6 : 1,
          pointerEvents: pending ? "none" : "auto",
        }}
      >
        {pending ? "Enviando…" : "📷 Tirar foto"}
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
        className="text-xs rounded px-2 py-1 cursor-pointer border"
        style={{
          borderColor: "var(--brand-green)",
          color: "var(--brand-green)",
          opacity: pending ? 0.6 : 1,
          pointerEvents: pending ? "none" : "auto",
        }}
      >
        {pending ? "Enviando…" : "🖼️ Da galeria"}
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
  );
}
